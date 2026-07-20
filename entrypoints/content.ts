import { LogFrom, Logger, SharedData, ScriptMessageContext, dateToLocaleString, error_message, querySelector, querySelectorAll, success_message } from "@/components/basics";
import { registerMessageHandler, sendMessage, Message, MessageResponse, MessageType } from "@/components/messaging";
import { get_shared_data } from '@/components/client';
import { Trigger, Condition, ConditionTarget, ConditionTargetType, ConditionType, ActionSetMethod, conditionTargetType_toString, testCondition } from "@/components/scripting";
import { resolveTemplateContent } from "@/components/template-resolution";

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
	element_selector_abort_controller: AbortController[] = [];
	trigger_watchers: Array<() => void> = [];
	trigger_timestamp: number = 0;
	foreach_element_cache: Map<string, { elements: Element[]; elementIds: string[] | null }> | null = null;

	constructor(shared: SharedData, bot_id: number) {
		this.shared = shared;
		this.bot_id = bot_id;
	}

	private getForeachRoot(selector: string, index: string): HTMLElement | null {
		const cached = this.foreach_element_cache?.get(selector);
		if (!cached) {
			const elements = querySelectorAll(selector);
			return elements[parseInt(index)] as HTMLElement ?? null;
		}
		if (cached.elementIds) {
			const id = cached.elementIds[parseInt(index)];
			if (id) return document.getElementById(id) as HTMLElement;
			return null;
		}
		return cached.elements[parseInt(index)] as HTMLElement ?? null;
	}

	async handle(message: Message): Promise<MessageResponse<any>> {
		LOGGER.debug(`frameId:${(message as any).frameId} | ${document.title} | Received message: ${message.type}`, message);
	
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
					const { content, element_selector, delete_insert, foreach_selector, foreach_index, return_content } = message.data || {};
					if (!content) return error_message("No template content provided");
					if (return_content) {
						const resolvedContent = await this.resolveTemplateContent(content);
						return success_message({ resolvedContent: resolvedContent });
					}

					let target_element: HTMLTextAreaElement;
					let rootNode = document.body;
					if (foreach_selector && foreach_index !== undefined) {
						const foreachRoot = this.getForeachRoot(foreach_selector, foreach_index);
						if (!foreachRoot) return error_message("foreach element not found at index " + foreach_index);
						rootNode = foreachRoot;
					}
					
					if (element_selector) {
						target_element = querySelector(element_selector, rootNode)! as HTMLTextAreaElement;
						if(target_element === null) return error_message("target_element is null, because the element_selector `"+element_selector+"` is unable to find the element");
					} else if (lastFocusedElement) {
						target_element = lastFocusedElement as HTMLTextAreaElement;
					} else {
						LOGGER.debug("No focused element to insert template into");
						return error_message("No element focused");
					}

					const resolvedContent = await this.resolveTemplateContent(content);
					if (target_element instanceof HTMLInputElement || target_element instanceof HTMLTextAreaElement) {
						if (delete_insert) {
							target_element.value = resolvedContent;
						} else {
							const start = target_element.selectionStart || 0;
							const end = target_element.selectionEnd ?? target_element.value.length;
	
							target_element.value =
								target_element.value.slice(0, start) +
								resolvedContent +
								target_element.value.slice(end);
	
							const newPos = start + resolvedContent.length;
							target_element.setSelectionRange(newPos, newPos);
						}

						target_element.dispatchEvent(new Event("input", { bubbles: true }));
						target_element.dispatchEvent(new Event("change", { bubbles: true }));

						LOGGER.debug("Template inserted successfully", { resolvedContent });
						return success_message({ inserted: true, resolvedContent });
					}

					return error_message("Unsupported element type for template insertion");
				}

				case MessageType.SET_ELEMENT_ATTRIBUTE: {
					const { element_selector, attribute, value, set_method, foreach_selector, foreach_index } = message.data || {};
					if (!element_selector) return error_message("No element selector provided");
					if (!attribute) return error_message("No attribute provided");

					let rootNode = document.body;
					if (foreach_selector && foreach_index !== undefined) {
						const foreachRoot = this.getForeachRoot(foreach_selector, foreach_index);
						if (!foreachRoot) return error_message("foreach element not found at index " + foreach_index);
						rootNode = foreachRoot;
					}

					const target_element = querySelector(element_selector, rootNode);
					if (target_element === null) {
						return error_message("target_element is null, because the element_selector `"+element_selector+"` is unable to find the element");
					}

					LOGGER.debug("SET_ELEMENT_ATTRIBUTE set_method, value", set_method, value)
					LOGGER.debug("SET_ELEMENT_ATTRIBUTE typeof set_method", typeof set_method)
					const new_value = this.new_value_set_method(set_method, value);
					LOGGER.debug("SET_ELEMENT_ATTRIBUTE new_value", new_value)

					if (attribute === "value") {
						if (target_element instanceof HTMLInputElement || target_element instanceof HTMLTextAreaElement || target_element instanceof HTMLSelectElement) {
							target_element.value = new_value;
							target_element.dispatchEvent(new Event("input", { bubbles: true }));
							target_element.dispatchEvent(new Event("change", { bubbles: true }));
							return success_message({ updated: true });
						}
					}

					target_element.setAttribute(attribute, new_value);
					return success_message({ updated: true });
				}

				case MessageType.GET_ELEMENT_ATTRIBUTE: {
					const { element_selector, attribute, foreach_selector, foreach_index, use_cache } = message.data || {};
					if (!element_selector) return error_message("No element selector provided");
					if (!attribute) return error_message("No attribute provided");
					const attribute_lcase = (attribute as string).toLowerCase();

					let rootNode = document.body;
					if (foreach_selector && foreach_index !== undefined) {
						const foreachRoot = this.getForeachRoot(foreach_selector, foreach_index);
						if (!foreachRoot) return error_message("foreach element not found at index " + foreach_index);
						rootNode = foreachRoot;
					}

					if (attribute_lcase === "length") {
						const target_elements = querySelectorAll(element_selector, rootNode);
						LOGGER.log("MessageType.GET_ELEMENT_ATTRIBUTE length element_selector", element_selector)
						LOGGER.log("MessageType.GET_ELEMENT_ATTRIBUTE length target_elements", target_elements)
						if (use_cache) {
							const allIds = target_elements.every(el => el.id);
							this.foreach_element_cache = new Map();
							this.foreach_element_cache.set(element_selector, {
								elements: target_elements,
								elementIds: allIds ? target_elements.map(el => el.id) : null,
							});
						}
						return success_message({ value: target_elements.length });
					}

					const target_element = querySelector(element_selector, rootNode);
					if (target_element === null) {
						return error_message("target_element is null, because the element_selector `"+element_selector+"` is unable to find the element");
					}

					let attributeValue: string | null = null;
					if (attribute_lcase === "value" && (target_element instanceof HTMLInputElement || target_element instanceof HTMLTextAreaElement || target_element instanceof HTMLSelectElement)) {
						attributeValue = target_element.value;
					} else if(attribute_lcase === "innertext") {
						attributeValue = target_element.innerText;
					} else if(attribute_lcase === "innerhtml") {
						attributeValue = target_element.innerHTML;
					} else if(attribute_lcase === "outerhtml") {
						attributeValue = target_element.outerHTML;
					} else {
						attributeValue = target_element.getAttribute(attribute);
					}

					return success_message({ value: attributeValue ?? "" });
				}

				case MessageType.TRIGGER_ELEMENT_EVENT: {
					const { element_selector, event_type, foreach_selector, foreach_index } = message.data || {};
					if (!element_selector) return error_message("No element selector provided");
					if (!event_type) return error_message("No event type provided");

					let rootNode = document.body;
					if (foreach_selector && foreach_index !== undefined) {
						const foreachRoot = this.getForeachRoot(foreach_selector, foreach_index);
						if (!foreachRoot) return error_message("foreach element not found at index " + foreach_index);
						rootNode = foreachRoot;
					}

					const target_element = querySelector(element_selector, rootNode);
					if (target_element === null) {
						return error_message("target_element is null, because the element_selector `"+element_selector+"` is unable to find the element");
					}

					target_element.dispatchEvent(new Event(event_type, { bubbles: true, cancelable: true }));
					return success_message({ dispatched: true });
				}

				case MessageType.CHECK_CONDITIONS: {
					// All conditions need to be true
					const conditions = message.data.conditions as Condition[];
					const { foreach_selector, foreach_index } = message.data || {};
					let rootNode: ParentNode = document.body;
					if (foreach_selector && foreach_index !== undefined) {
						const foreachRoot = this.getForeachRoot(foreach_selector, foreach_index);
						if (foreachRoot) rootNode = foreachRoot;
					}
					for (let c = 0; c < conditions.length; c++) {
						const condition = conditions[c];
						const value1 = this.get_condition_target_value(condition.target, rootNode);
						const result = testCondition(condition.type, value1, condition.string_value);
						const target_type = condition.target.target_type;
						let target_label = conditionTargetType_toString(target_type);
						if(condition.target.element_selector) target_label += " " + condition.target.element_selector;
						if(condition.target.attribute) target_label += " " + condition.target.attribute;
						LOGGER.debug(`Condition ${c}: ${target_label} ${ConditionType[condition.type]} expected ${JSON.stringify(condition.string_value)} got ${JSON.stringify(value1)}`);
						if(!result) {
							return success_message({
								result: false,
								error: `Condition ${c}: ${target_label} ${ConditionType[condition.type]} expected ${JSON.stringify(condition.string_value)} but got ${JSON.stringify(value1)}`,
							});
						}
					}
					return success_message({ result: true });
				}
				
				case MessageType.ELEMENT_SELECTOR: {
					const { session_id, active } = message.data || {};

					if (active) {
						const selector = await this.startElementSelector();
						if (selector) {
							alert_modal("Element selected: "+selector);
							return success_message({ selector: selector });
						}
						return error_message("No element selected");
					} else {
						// a element has been selected from another content. we abort here
						for (let index = 0; index < this.element_selector_abort_controller.length; index++) {
							this.element_selector_abort_controller[index].abort();
						}
						return success_message({});
					}
				}
				
			case MessageType.ALERT: {
				const { text } = message.data || {};
				alert(text);
			}

			case MessageType.PLAY_AUDIO: {
				const { source, speaker_device } = message.data || {};
				this.play_audio(source, speaker_device).catch(() => {});
			}

			case MessageType.CLEAR_FOREACH_CACHE: {
					this.foreach_element_cache = null;
					return success_message({});
				}

				default: return error_message(`Unknown message type: ${message.type}`);
			}
		} catch (error) {
			LOGGER.log("Error handling message", error);
			return error_message(error instanceof Error ? error.message : String(error));
		}
	}

	async play_audio(source: string, speaker_device: string) {
		try {
			const ctx = new AudioContext();
			if (ctx.state === 'suspended') {
				await ctx.resume();
			}
			if (speaker_device && speaker_device !== "default" && (ctx as any).setSinkId) {
				try { await (ctx as any).setSinkId(speaker_device); } catch {}
			}
			if (source === "beep") {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = 'sine';
				osc.frequency.value = 800;
				gain.gain.value = 0.3;
				osc.connect(gain);
				gain.connect(ctx.destination);
				osc.start();
				osc.stop(ctx.currentTime + 0.15);
			} else if (source) {
				const url = browser.runtime.getURL(source as any);
				const response = await fetch(url);
				const arrayBuffer = await response.arrayBuffer();
				const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
				const bufSource = ctx.createBufferSource();
				bufSource.buffer = audioBuffer;
				bufSource.connect(ctx.destination);
				bufSource.start();
			}
		} catch {
			// Audio playback failed — silently degrade
		}
	}

	dispose_trigger_watchers() {
		for (const dispose of this.trigger_watchers) {
			dispose();
		}
		this.trigger_watchers = [];
	}

	setup_trigger_watchers() {
		console.log("setup_trigger_watchers", this.shared.data.triggers);
		
		this.dispose_trigger_watchers();
		if (!Array.isArray(this.shared.data.triggers)) return;
		console.log("setup_trigger_watchers RUN", this.shared.data.triggers);

		for (const trigger of this.shared.data.triggers) {
			if (trigger.every && trigger.every > 0 && window.top === window) {
				const intervalId = window.setInterval(() => {
					this.evaluate_trigger(trigger);
				}, trigger.every * 1000);
				this.trigger_watchers.push(() => window.clearInterval(intervalId));
			}

			for (const event of trigger.events) {
				if (!event.event_type || !event.element_selector) continue;
				const listener = async (ev: Event) => {
					console.log("listener");
					const target = ev.target;
					if (!(target instanceof Element)) return;
					if (target.closest(event.element_selector)) {
						await this.evaluate_trigger(trigger);
					}
				};
				document.addEventListener(event.event_type, listener, true);
				this.trigger_watchers.push(() => document.removeEventListener(event.event_type, listener, true));
				
				// Deep tracker
				for (const element of querySelectorAll(event.element_selector)) {
					element.addEventListener(event.event_type, listener, true);
					element.addEventListener("click", listener, true);
					console.log("setup_trigger_watchers element EVENT", element);
					console.log("event.event_type", event.event_type);

					this.trigger_watchers.push(() => element.removeEventListener(event.event_type, listener, true));
				}
			}
		}
	}

	async evaluate_trigger(trigger: Trigger) {
		if (!this.shared.data.active) return;
		if (!trigger.script_id) return;

		const timestamp_now = new Date().getTime();		
		if (timestamp_now - this.trigger_timestamp > TRIGGER_COOLDOWN) {
			this.trigger_timestamp = timestamp_now;
			await sendMessage(LOGGER, { type: MessageType.TRIGGER_FIRED, data: { bot_id: this.bot_id, trigger_id: trigger.id } });
			return;
		}
	}

	async resolveTemplateContent(template: string): Promise<string> {
		return resolveTemplateContent(template, {
			resolveLabelValue: (label) => this.queryLabelValue(label),
			allowPrompt: this.shared.data.allow_prompt,
			promptForValue: (label) => this.promptForTemplateValue(label),
		});
	}
	
	queryLabelValue(labelName: string): string | null {
		const normalizedLabel = normalizeText(labelName);
	
		// Search through all labels for a match.
		const labels = Array.from(querySelectorAll('label')) as HTMLLabelElement[];
		console.log("labels", labels);
		for (const label of labels) {
			const labelText = normalizeText(label.textContent || "");
			if (!labelText) {
				continue;
			}
	
			console.log("labels normalizedLabel", normalizedLabel);
			console.log("labels labelText", labelText);
			if (normalizedLabel === labelText) {
				// get formcontrol with attribute ´for´
				const formcontrol_id = label.getAttribute("for");
				console.log("labels labelText", formcontrol_id);
				if (formcontrol_id) {
					console.log("labels formcontrol_id", formcontrol_id);
					
					const formcontrol = document.getElementById(formcontrol_id);
					console.log("labels formcontrol", formcontrol);
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
		if (typeof window === "undefined" || typeof window.prompt !== "function") {
			throw new Error("Prompt is not available in this context");
		}
		const userValue = window.prompt(`Enter value for [${labelName}]`);
		return userValue?.trim() ?? "";
	}

	get_condition_target_value(target: ConditionTarget, rootNode: ParentNode = document.body): string|null {
		switch (target.target_type) {
			case ConditionTargetType.HOSTNAME: return location.hostname;
			case ConditionTargetType.URL: return location.href;
			case ConditionTargetType.ELEMENT: {
				if(!target.element_selector) throw new Error("Error in the script: ConditionTargetType.ELEMENT needs element_selector");
				const element = querySelector(target.element_selector, rootNode);
				if(element === null) return null;
				return element.innerText;
			}
			case ConditionTargetType.ELEMENT_ATTRIBUTE: {
				if(!target.element_selector) throw new Error("Error in the script: ConditionTargetType.ELEMENT_ATTRIBUTE needs element_selector");
				if(!target.attribute) throw new Error("Error in the script: ConditionTargetType.ELEMENT_ATTRIBUTE needs attribute");
				const element = querySelector(target.element_selector, rootNode);
				console.log("get_condition_target_value element", element);
				
				if(element === null) return null;
				console.log("get_condition_target_value (element as HTMLInputElement).value", (element as HTMLInputElement).value);
				if(target.attribute === "value") (element as HTMLInputElement).value;
				return element.getAttribute(target.attribute);
			}
		}
		throw new Error("Unknown ConditionTargetType:"+target.target_type);
	}

	new_value_set_method(set_method: ActionSetMethod, value: string) {
		switch (parseInt(set_method as any) as ActionSetMethod) {
			case ActionSetMethod.DATE_NOW_PLUS_DAYS: {
				const days = parseInt(value);
				if(isNaN(days)) throw new Error("value needs to be a number for DATE_NOW_PLUS_DAYS");
				const new_date = new Date(new Date().getTime() + 86400000 * days);
				return dateToLocaleString(new_date, this.shared.data.datetime_locale);
			}
			default: return String(value ?? "");
		}
	}

	async startElementSelector(): Promise<string | null> {
		const controller = new AbortController();
		const signal = controller.signal;

		const future = new Promise<string | null>((resolve) => {
			let previousElements: HTMLElement[] = [];
			const originalStyles = new WeakMap<HTMLElement, string>();
			let finished = false;

			const safeResolve = (value: string | null) => {
				if (finished) return;
				finished = true;
				try { resolve(value); } catch (e) { /* ignore */ }
			};

			const revertStyles = () => {
				for (let index = 0; index < previousElements.length; index++) {
					const element = previousElements[index];
					const originalStyle = originalStyles.get(element);
					if (originalStyle !== undefined) {
						element.style.cssText = originalStyle;
					} else {
						element.style.border = '';
					}
				}
			}

			const handleMouseOver = (event: MouseEvent) => {
				const target = event.target as HTMLElement;
				revertStyles();

				// Apply red border to current element
				originalStyles.set(target, target.style.cssText);
				target.style.border = '4px solid red';
				previousElements.push(target);
			};

			const handleClick = (event: MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();

				const target = event.target as HTMLElement;
				previousElements.push(target);
				revertStyles();
				
				// Generate CSS selector for the element
				const selector = this.generateSelector(target);
				
				// Clean up
				cleanup();
				
				LOGGER.debug(`Element selected: ${selector}`);
				safeResolve(selector);
			};

			const handleEscape = (event: KeyboardEvent) => {
				if (event.key === 'Escape') {
					cleanup();
					safeResolve(null);
				}
			};

			const onAbort = () => {
				cleanup();
				safeResolve(null);
			};

			const cleanup = () => {
				document.removeEventListener('mouseover', handleMouseOver, true);
				document.removeEventListener('click', handleClick, true);
				document.removeEventListener('keydown', handleEscape, true);
				signal.removeEventListener('abort', onAbort);
				revertStyles();
				
				// remove controller from array
				const idx = this.element_selector_abort_controller.indexOf(controller);
				if (idx !== -1) this.element_selector_abort_controller.splice(idx, 1);
			};

			// Enable selection mode
			document.addEventListener('mouseover', handleMouseOver, true);
			document.addEventListener('click', handleClick, true);
			document.addEventListener('keydown', handleEscape, true);
			signal.addEventListener('abort', onAbort);
			
			LOGGER.debug('Element selector mode started. Click an element to select, or press Escape to cancel.');
		});

		// we save the controller so we can abort it later
		this.element_selector_abort_controller.push(controller);
		return future;
	}

	generateSelector(element: HTMLElement): string {
		// Generate a CSS selector for the element
		const parts: string[] = [];
		let el: HTMLElement | null = element;

		while (el && el.nodeType === Node.ELEMENT_NODE) {
			let part = el.nodeName.toLowerCase();

			if (el.id) {
				part += `#${el.id}`;
				parts.unshift(part);
				break;
			}

			if (el.className) {
				const classes = Array.from(el.classList).join('.');
				part += `.${classes}`;
			}

			const siblings = Array.from(el.parentNode?.childNodes || []).filter(
				(node) => node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).nodeName === el!.nodeName
			) as HTMLElement[];

			if (siblings.length > 1) {
				const index = siblings.indexOf(el) + 1;
				part += `:nth-of-type(${index})`;
			}

			parts.unshift(part);
			el = el.parentElement;
		}

		return parts.join(' > ');
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
	matches: ["<all_urls>", 'https://siam.service-now.com/*', '*://*.service-now.com/*', "file:///*"],
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
		setInterval(function () {
			for (const element of querySelectorAll("textarea:not([focus_tracked])")) {
				console.log("focus_tracked", element.id);
				element.addEventListener('focus', (event) => {
					const target = event.target as HTMLTextAreaElement;
					lastFocusedElement = target;
					LOGGER.debug("Focused element tracked", "type:", target.constructor.name, "id:", target.id);
				}, true);
				element.setAttribute("focus_tracked", "1");
			}
		}, 5000);

		// Get bot_id from background, which creates a record for this content script instance
		const get_bot_id_response = await sendMessage<any>(LOGGER, { type: MessageType.GET_BOT_ID, data: {hostname: location.hostname} });
		const bot_id: number = get_bot_id_response.data?.bot_id;
		if (!get_bot_id_response.success) {
			LOGGER.log("Failed to get bot_id from background", get_bot_id_response);
			return;
		}

		// Register message handler with bot_id context
		const background_message_handler = new BackgroundMessageHandler(shared, bot_id);
		registerMessageHandler((message) => background_message_handler.handle(message));
		background_message_handler.setup_trigger_watchers();
		
		// SEND BOT_READY, set is_busy=false
		const response = await sendMessage(LOGGER, { type: MessageType.BOT_READY, data: {bot_id: bot_id, href: location.href} });
		LOGGER.debug("Content ready signal sent bot_id:", bot_id, "response:", response);

		
		if (window.top !== window) {
			console.log("Running inside an iframe");
		}
	},
});
