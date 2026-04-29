import { LogFrom, Logger, SharedData, SharedDataInner, BotInstance, TemplateData } from "@/components/basics";
import { registerMessageHandler, Message, MessageResponse, MessageType } from "@/components/messaging";
import {
	LS_KEY_SHARED_DATA,
} from "@/components/constants";
import { storage } from '#imports';

const LOGGER = new Logger(LogFrom.background);
LOGGER.debug("start");

// Generate unique bot_id
let prev_bot_id = 0;
function generateBotId(): number {
	prev_bot_id++;
	let bot_id = prev_bot_id;
	return bot_id;
}

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

	// In-memory storage for active bot instances (reconstructed on start)
	// Key is bot_id (number), value is BotInstance
	let botInstances: Record<number, BotInstance> = {};

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
	async function handleMessage(message: Message, sender?: any): Promise<MessageResponse> {
		LOGGER.debug(`Received message: ${message.type}`, message, { tabId: sender?.tab?.id });

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
						// TODO: send change to all bots
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
				
				case MessageType.GET_BOT_ID: {
					// Content script requests its bot_id
					const tabId = sender?.tab?.id;
					if (!tabId) {
						return {
							success: false,
							error: "Could not determine tab ID",
						};
					}

					// Check if bot already exists for this tab
					let botInstance = Object.values(botInstances).find(b => b.tabId === tabId);

					if (!botInstance) {
						// Create new bot instance
						const bot_id = generateBotId();
						botInstance = {
							bot_id,
							tabId,
							active: false,
						};
						botInstances[bot_id] = botInstance;
						LOGGER.debug(`New bot assigned: ${bot_id} on tab ${tabId}`);
					}

					return {
						success: true,
						data: { bot_id: botInstance.bot_id },
					};
				}

				case MessageType.BOT_READY: {
					// Content script signals it's ready - set active to true
					const bot_id: number = message.data.bot_id;
					botInstances[bot_id].active = true;

					LOGGER.debug(`Bot is ready: ${bot_id} on tab ${botInstances[bot_id].tabId}`);

					return {
						success: true,
						data: { bot_id, acknowledged: true },
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

				case MessageType.SET_TEMPLATE: {
					// Handle template creation/update/deletion
					const { template, action, templateId } = message.data || {};

					if (action === 'delete' && templateId) {
						const templates = sharedData.getTemplates();
						sharedData._applyStateChange({
							templates: templates.filter(t => t.id !== templateId),
						});
						persistSharedData();
						LOGGER.debug(`Template deleted: ${templateId}`);
						return {
							success: true,
							data: { deleted: true },
						};
					}

					if (template) {
						const templates = sharedData.getTemplates();
						const index = templates.findIndex(t => t.id === template.id);

						if (index >= 0) {
							templates[index] = template;
						} else {
							templates.push(template);
						}

						sharedData._applyStateChange({ templates });
						persistSharedData();
						LOGGER.debug(`Template saved: ${template.id}`);

						return {
							success: true,
							data: { saved: true },
						};
					}

					return {
						success: false,
						error: "Invalid template data",
					};
				}

				case MessageType.INSERT_TEMPLATE: {
					// Route template insertion to active bot instance
					const { content } = message.data || {};
					if (!content) {
						return {
							success: false,
							error: "No template content provided",
						};
					}

					// Find active bot instance for this tab
					const activeBots = Object.values(botInstances).filter(b => b.active);
					if (activeBots.length === 0) {
						return {
							success: false,
							error: "No active bot instance found",
						};
					}

					// Get the most recently active bot
					const activeBotInstance = activeBots[activeBots.length - 1];
					LOGGER.debug(`Routing template insertion to bot ${activeBotInstance.bot_id} on tab ${activeBotInstance.tabId}`);

					return {
						success: true,
						data: { routed: true, bot_id: activeBotInstance.bot_id },
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
