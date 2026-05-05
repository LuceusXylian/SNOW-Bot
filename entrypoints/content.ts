import { LogFrom, Logger, SharedData } from "@/components/basics";
import { registerMessageHandler, sendMessage, Message, MessageResponse, MessageType } from "@/components/messaging";
import { get_shared_data } from '@/components/client';

const LOGGER = new Logger(LogFrom.content);
// Track last focused input/textarea/select element
let lastFocusedElement: HTMLElement | null = null;

/**
 * Handler for messages from background script
 */
async function handleBackgroundMessage(message: Message, shared: SharedData, bot_id: number): Promise<MessageResponse> {
	LOGGER.debug(`Received message: ${message.type}`, message);

	try {
		switch (message.type) {
			case MessageType.UPDATE_SHARED_DATA: {
				// Handle active state change
				const { active } = message.data || {};
				if (typeof active === "boolean") {
					LOGGER.debug(`Bot ${active ? 'enabled' : 'disabled'}`);
					shared.applyStateChange({ active });
					LOGGER.debug(`Bot ${shared.getActive() ? 'enabled' : 'disabled'}`);
					// TODO: Start/stop bot observers
					return success_message({ active });
				}
				return error_message("Invalid active value");
			}

			case MessageType.INSERT_TEMPLATE: {
				// Handle template insertion into last focused element
				const { content } = message.data || {};
				if (!content) return error_message("No template content provided");
				
				if (!lastFocusedElement) {
					LOGGER.debug("No focused element to insert template into");
					return error_message("No element focused");
				}

				// Insert template content into focused element
				if (lastFocusedElement instanceof HTMLInputElement || lastFocusedElement instanceof HTMLTextAreaElement) {
					const start = lastFocusedElement.selectionStart || 0;
					const end = lastFocusedElement.selectionEnd || lastFocusedElement.value.length;

					lastFocusedElement.value =
						lastFocusedElement.value.slice(0, start) +
						content +
						lastFocusedElement.value.slice(end);

					// Move caret to end of inserted text
					const newPos = start + content.length;
					lastFocusedElement.setSelectionRange(newPos, newPos);

					// Trigger change/input events
					lastFocusedElement.dispatchEvent(new Event("input", { bubbles: true }));
					lastFocusedElement.dispatchEvent(new Event("change", { bubbles: true }));

					LOGGER.debug("Template inserted successfully");
					return success_message({ inserted: true });
				}

				return error_message("Unsupported element type for template insertion");
			}
			
			default: return error_message(`Unknown message type: ${message.type}`);
		}
	} catch (error) {
		LOGGER.debug("Error handling message", error);
		return error_message(error instanceof Error ? error.message : String(error));
	}
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

function paste_cleaner(shared_data: SharedData) {
	document.addEventListener('paste', function (event) {
		console.log("paste_cleaner shared_data.getActive()", shared_data.getActive());
		
		if(shared_data.getActive() === false) return;
		console.log("paste_cleaner shared_data.getActive()", shared_data.getActive());
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
        const end = target.selectionEnd || target.value.length;

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
		console.log("paste_cleaner shared_data.getActive()", shared_data.getActive());

    }, true);
}

export default defineContentScript({
	matches: ['*://*.service-now.com/*', "file:///*"],
	async main() {
		LOGGER.debug('Content script started');
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

		// Get bot_id from background, which creates a record for this content script instance
		const get_bot_id_response = await sendMessage({ type: MessageType.GET_BOT_ID });
		const bot_id: number = get_bot_id_response.data?.bot_id;
		if (!get_bot_id_response.success) {
			LOGGER.debug("Failed to get bot_id from background", get_bot_id_response);
			return;
		}

		// Register message handler with bot_id context
		registerMessageHandler((message) => handleBackgroundMessage(message, shared, bot_id));
		
		// SEND BOT_READY, set is_busy=false
		const response = await sendMessage({ type: MessageType.BOT_READY, data: {bot_id: bot_id} });
		LOGGER.debug("Content ready signal sent bot_id:", bot_id, "response:", response);
	},
});
