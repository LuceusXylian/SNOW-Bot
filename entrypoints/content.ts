import { LogFrom, Logger, SharedData, error_message, querySelector, querySelectorAll, success_message } from "@/components/basics";
import { registerMessageHandler, sendMessage, Message, MessageResponse, MessageType } from "@/components/messaging";
import { get_shared_data } from '@/components/client';
import { Condition, ConditionTarget, ConditionTargetType, ConditionType } from "@/components/scripting";

const LOGGER = new Logger(LogFrom.content);
// Track last focused input/textarea/select element
let lastFocusedElement: HTMLElement | null = null;
const SHORTCODE_REGEX = /\[(.+?)\]/g;


/**
 * Handler for messages from background script
 */
class BackgroundMessageHandler {
	shared: SharedData;
	bot_id: number;

	constructor(shared: SharedData, bot_id: number) {
		this.shared = shared;
		this.bot_id = bot_id;
	}

	async handle(message: Message): Promise<MessageResponse<any>> {
		LOGGER.debug(`Received message: ${message.type}`, message);
	
		try {
			if (message.type === MessageType.UPDATE_SHARED_DATA) {
				// Handle active state change
				const { active } = message.data || {};
				if (typeof active === "boolean") {
					LOGGER.debug(`Bot ${active ? 'enabled' : 'disabled'}`);
					this.shared.applyStateChange({ active });
					LOGGER.debug(`Bot ${this.shared.data.active ? 'enabled' : 'disabled'}`);
					return success_message({ active });
				}
				return error_message("Invalid active value");
			}

			// check if bot is enabled before any bot action
			if(!this.shared.data.active) error_message("Bot is disabled");

			switch (message.type) {
				case MessageType.INSERT_TEMPLATE: {
					const { content, target_selector } = message.data || {};
					if (!content) return error_message("No template content provided");
					let target_element: HTMLElement;
					if (target_selector) {
						target_element = querySelector(target_selector)!;
						if(target_element === null) return error_message("target_element is null, because the target_selector is unable to find the element");
					} else if (lastFocusedElement) {
						target_element = lastFocusedElement;
					} else {
						LOGGER.debug("No focused element to insert template into");
						return error_message("No element focused");
					}
	
					const resolvedContent = await this.resolveTemplateContent(content);
	
					if (target_element instanceof HTMLInputElement || target_element instanceof HTMLTextAreaElement) {
						const start = target_element.selectionStart || 0;
						const end = target_element.selectionEnd ?? target_element.value.length;
	
						target_element.value =
							target_element.value.slice(0, start) +
							resolvedContent +
							target_element.value.slice(end);
	
						const newPos = start + resolvedContent.length;
						target_element.setSelectionRange(newPos, newPos);
	
						target_element.dispatchEvent(new Event("input", { bubbles: true }));
						target_element.dispatchEvent(new Event("change", { bubbles: true }));
	
						LOGGER.debug("Template inserted successfully", { resolvedContent });
						return success_message({ inserted: true, resolvedContent });
					}
	
					return error_message("Unsupported element type for template insertion");
				}
				
				case MessageType.CHECK_CONDITIONS: {
					// All conditions need to be true
					const conditions = message.data.conditions as Condition[];
					for (let c = 0; c < conditions.length; c++) {
						const condition = conditions[c];
						const value1 = this.get_condition_target_value(condition.target);
						if(value1 === null) return error_message("Unable to get value1, abort");
						const result = this.test_condition(condition.type, value1, condition.static_value);
						if(!result) return error_message("Condition is false, abort");
					}
					return success_message({ result: true });
				}

				default: return error_message(`Unknown message type: ${message.type}`);
			}
		} catch (error) {
			LOGGER.log("Error handling message", error);
			return error_message(error instanceof Error ? error.message : String(error));
		}
	}

	async resolveTemplateContent(template: string): Promise<string> {
		const matches = Array.from(template.matchAll(SHORTCODE_REGEX));
		if (matches.length === 0) {
			return template;
		}
	
		const resolved = new Map<string, string>();
	
		for (const match of matches) {
			const label = match[1].trim();
			
			if (!label) {
				continue;
			}
	
			if (resolved.has(label)) {
				continue;
			}
	
			const value = this.queryLabelValue(label);
			if (value !== null) {
				resolved.set(label, value);
			} else if(this.shared.data.allow_prompt) {
				// last resort: prompt() user for value
				const value = this.promptForTemplateValue(label);
				resolved.set(label, value);
			}
		}
	
		return template.replace(SHORTCODE_REGEX, (_full, label) => {
			const normalized = label.trim();
			return resolved.get(normalized) ?? "";
		});
	}
	
	queryLabelValue(labelName: string): string | null {
		const normalizedLabel = normalizeText(labelName);
	
		// Search through all labels for a match.
		const labels = Array.from(querySelectorAll('label')) as HTMLLabelElement[];
		for (const label of labels) {
			const labelText = normalizeText(label.textContent || "");
			if (!labelText) {
				continue;
			}
	
			if (normalizedLabel === labelText) {
				// get formcontrol with attribute ´for´
				const formcontrol_id = label.getAttribute("for");
				if (formcontrol_id) {
					const formcontrol = document.getElementById(formcontrol_id);
					if (formcontrol) {
						if (formcontrol instanceof HTMLInputElement) {
							if (formcontrol.type === "checkbox") {
								return formcontrol.checked.toString();
							}
							if (formcontrol.type === "radio") {
								return formcontrol.value.trim() || null;
							}
							return formcontrol.value.trim() || null;
						}
						if (formcontrol instanceof HTMLTextAreaElement || formcontrol instanceof HTMLSelectElement) {
							return formcontrol.value.trim() || null;
						}
						return formcontrol.textContent?.trim() || null;
					}
				}
				break;
			}
		}
	
		// Fallback: try to locate a label-text span directly.
		const spans = Array.from(querySelectorAll('span.label-text')) as HTMLElement[];
		for (const span of spans) {
			const spanText = normalizeText(span.textContent || "");
			if (spanText.includes(normalizedLabel) || normalizedLabel.includes(spanText)) {
				return span.textContent?.trim() || null;
			}
		}
	
		return null;
	}
	
	promptForTemplateValue(labelName: string): string {
		const userValue = window.prompt(`Enter value for [${labelName}]`);
		return userValue?.trim() ?? "";
	}

	get_condition_target_value(target: ConditionTarget): string|null {
		switch (target.target_type) {
			case ConditionTargetType.DOMAIN: return location.hostname;
			case ConditionTargetType.URL: return location.href;
			case ConditionTargetType.ELEMENT: {
				if(!target.element_selector) throw new Error("Error in the script: ConditionTargetType.ELEMENT needs element_selector");
				const element = document.querySelector(target.element_selector);
				if(element === null) return null;
				return element.outerHTML;
			}
		}
		throw new Error("Unknown ConditionTargetType:"+target.target_type);
	}

	test_condition(type: ConditionType, value1: string, value2: string): boolean {
		LOGGER.log("test_condition", type, "value1", value1, "value2", value2, "RESULT:", value1.includes(value2))

		switch (type) {
			case ConditionType.EXISTS: return true;
			case ConditionType.IS: return value1 === value2;
			case ConditionType.IS_NOT: return value1 !== value2;
			case ConditionType.CONTAINS: return value1.includes(value2);
			case ConditionType.CONTAINS_NOT: return !value1.includes(value2);
		}
		throw new Error("Unknown ConditionType:"+type);
	}
}

function normalizeText(text: string): string {
	return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

//** Helpful functions for manuel work*/
function clean_textarea_strings(text: string) {
	let ends_with_space = false;
	for (let index = text.length - 1; index >= 0; index--) {
		const char = text.charAt(index);
		const pre_char = text.charAt(index - 1);
		
    	if(pre_char !== "\r" && pre_char !== "\n" && pre_char !== " ") {
			if (char === " ") {
				ends_with_space = true;
			}
			break;
		}
	}

	// 1. Remove starting quote
	if (text.startsWith('"')) {
		text = text.slice(1);
	}

	// 2. Remove ending quote
	text = text.trimEnd();
	if (text.endsWith('"')) {
		text = text.slice(0, -1);
	}

	// 3. Trim (done last)
	text = text.trimEnd();
	if (ends_with_space) {
		text += " ";
	}
	return text;
}

function paste_cleaner(shared: SharedData) {
	document.addEventListener('paste', function (event) {
		if(shared.data.active === false || shared.data.paste_cleaner_enabled === false) return;
        const target = event.target;

        // Only apply to input and textarea
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        event.preventDefault();

        // Get pasted text
		if(event.clipboardData === null) return;
        let text = clean_textarea_strings(event.clipboardData.getData('text'));

        // Insert text at caret position
        const start = target.selectionStart || 0;
        const end = target.selectionEnd || start; // if no selectionEnd use selectionStart

        target.value =
            target.value.slice(0, start) +
            text +
            target.value.slice(end);

        // Move caret to end of pasted text
        const newPos = start + text.length;
        target.setSelectionRange(newPos, newPos);

        // Trigger change to resize textarea
        if (target instanceof HTMLTextAreaElement) {
            target.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }, true);
}

export default defineContentScript({
	matches: ['https://siam.service-now.com/*', '*://*.service-now.com/*', "file:///*"],
	allFrames: true,
	async main() {
		LOGGER.debug('Content script started in', window.location.href);
		const COMMANDER = new BotCommander(LOGGER);
		const shared = await get_shared_data(LOGGER, COMMANDER);
		paste_cleaner(shared);

		// Track focused elements for template insertion
		document.addEventListener('focus', (event) => {
			const target = event.target;
			if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
				lastFocusedElement = target;
				LOGGER.debug("Focused element tracked", { type: target.constructor.name });
			}
		}, true);

		// Tracker 2
		setTimeout(function () {
			for (const element of querySelectorAll("textarea")) {
				element.addEventListener('focus', (event) => {
					const target = event.target;
					if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
						lastFocusedElement = target;
						LOGGER.debug("Focused element tracked", { type: target.constructor.name });
					}
				}, true);
			}
		}, 100);

		// Get bot_id from background, which creates a record for this content script instance
		const get_bot_id_response = await sendMessage<any>(LOGGER, { type: MessageType.GET_BOT_ID });
		const bot_id: number = get_bot_id_response.data?.bot_id;
		if (!get_bot_id_response.success) {
			LOGGER.log("Failed to get bot_id from background", get_bot_id_response);
			return;
		}

		// Register message handler with bot_id context
		const background_message_handler = new BackgroundMessageHandler(shared, bot_id);
		registerMessageHandler((message) => background_message_handler.handle(message));
		
		// SEND BOT_READY, set is_busy=false
		const response = await sendMessage(LOGGER, { type: MessageType.BOT_READY, data: {bot_id: bot_id, href: location.href} });
		LOGGER.debug("Content ready signal sent bot_id:", bot_id, "response:", response);

		
		if (window.top !== window) {
			console.log("Running inside an iframe");
		}
	},
});
