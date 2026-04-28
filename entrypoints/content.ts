import { LogFrom, Logger, SharedData } from "@/components/basics";
import { registerMessageHandler, sendMessage, Message, MessageResponse, MessageType } from "@/components/messaging";
import { get_shared_data } from '@/components/client';

const LOGGER = new Logger(LogFrom.content);

/**
 * Handler for messages from background script
 */
async function handleBackgroundMessage(message: Message, shared: SharedData): Promise<MessageResponse> {
	LOGGER.debug(`Received message: ${message.type}`, message);

	try {
		switch (message.type) {
			case "EXECUTE_ACTION": {
				// Handle mass actions on serial numbers
				const { action, serialnumbers } = message.data || {};
				if (action === 'mass_hardware_actions' && serialnumbers) {
					LOGGER.debug("Executing mass hardware actions", serialnumbers);
					// TODO: Implement actual bot logic for mass actions
					return {
						success: true,
						data: { executed: true, count: serialnumbers.length },
					};
				}
				return {
					success: false,
					error: "Invalid action parameters",
				};
			}

			case "SET_ACTIVE": {
				// Handle active state change
				const { active } = message.data || {};
				if (typeof active === "boolean") {
					LOGGER.debug(`Bot ${active ? 'enabled' : 'disabled'}`);
					// TODO: Start/stop bot observers
					return {
						success: true,
						data: { active },
					};
				}
				return {
					success: false,
					error: "Invalid active value",
				};
			}

			default:
				return {
					success: false,
					error: `Unknown message type: ${message.type}`,
				};
		}
	} catch (error) {
		LOGGER.debug("Error handling message", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
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
		const shared = await get_shared_data(LOGGER);
		paste_cleaner(shared);

		// Register message handler
		registerMessageHandler((message) => handleBackgroundMessage(message, shared));

		const response = await sendMessage({ type: MessageType.BOT_READY });
		LOGGER.debug("Content ready signal sent", response);
	},
});
