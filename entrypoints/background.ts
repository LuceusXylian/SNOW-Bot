import { LogFrom, Logger, SharedData, SharedDataInner } from "@/components/basics";
import { registerMessageHandler, Message, MessageResponse, MessageType } from "@/components/messaging";
import {
	LS_KEY_SHARED_DATA,
} from "@/components/constants";
import { storage } from '#imports';

const LOGGER = new Logger(LogFrom.background);
LOGGER.debug("start");

// Initialize shared data from localStorage or use defaults
async function initializeSharedData(): Promise<SharedData> {
	const stored = await storage.getItem<SharedDataInner>(LS_KEY_SHARED_DATA);
	if (stored) {
		try {
			return new SharedData(stored);
		} catch (error) {
			LOGGER.debug("Failed to parse stored SharedData, using defaults");
		}
	}

	return new SharedData();
}

export default defineBackground(async () => {
	let sharedData = await initializeSharedData();
	LOGGER.debug("Background script initialized", { id: browser.runtime.id });

	/**
	 * Save shared data to localStorage
	 */
	function persistSharedData() {
		storage.setItem(LS_KEY_SHARED_DATA, sharedData.export());
		LOGGER.debug("SharedData persisted to localStorage");
	}

	/**
	 * Message handler for all incoming messages
	 */
	async function handleMessage(message: Message): Promise<MessageResponse> {
		LOGGER.debug(`Received message: ${message.type}`, message);

		try {
			switch (message.type) {
				case MessageType.GET_STATE:
					// Return current shared data
					return {
						success: true,
						data: sharedData.export(),
					};

				case MessageType.SET_ACTIVE: {
					// Update active state
					const newActive = message.data?.active;
					if (typeof newActive === "boolean") {
						sharedData._applyStateChange({ active: newActive });
						persistSharedData();
						return {
							success: true,
							data: { active: sharedData.getActive() },
						};
					}
					return {
						success: false,
						error: "Invalid active value",
					};
				}

				case MessageType.BOT_READY: {
					// Content script signals it's ready
					LOGGER.debug("Content script ready");
					return {
						success: true,
						data: { acknowledged: true },
					};
				}

				case MessageType.EXECUTE_ACTION: {
					// Execute an action (will be processed by content)
					LOGGER.debug("Action queued for execution", message.data);
					return {
						success: true,
						data: { queued: true },
					};
				}

				default:
					return {
						success: false,
						error: `Unknown message type: ${message.type}`,
					};
			}
		} catch (error) {
			LOGGER.debug("Error processing message", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	// Register the message handler
	registerMessageHandler(handleMessage);
});
