import { LogFrom, Logger, SharedData, SharedDataInner, BotInstance, TemplateData, BotCommander, error_message, BotSelect } from "@/components/basics";
import { registerMessageHandler, Message, MessageResponse, MessageType } from "@/components/messaging";
import { KEY_SHARED_DATA } from "@/components/constants";
import { storage } from '#imports';

const LOGGER = new Logger(LogFrom.background);
LOGGER.debug("start");

// Initialize shared data from localStorage or use defaults
async function initializeSharedData(COMMANDER: BotCommander): Promise<SharedData> {
	const stored = await storage.getItem<SharedDataInner>(KEY_SHARED_DATA);
	if (stored) {
		try {
			return new SharedData(LOGGER, COMMANDER, stored);
		} catch (error) {
			LOGGER.debug("Failed to parse stored SharedData, using defaults");
		}
	}

	return new SharedData(LOGGER, COMMANDER);
}

export default defineBackground(() => {
	// In-memory storage for active bot instances (reconstructed on start)
	const COMMANDER = new BotCommander(LOGGER);
	initializeSharedData(COMMANDER).then(async (sharedData) => {
		LOGGER.debug("Background script initialized", { id: browser.runtime.id });

		/**
		 * Message handler for all incoming messages
		 */
		async function handleMessage(message: Message, sender?: any): Promise<MessageResponse> {
			LOGGER.debug(`Received message: ${message.type}`, message, { tabId: sender?.tab?.id });

			try {
				switch (message.type) {
					case MessageType.GET_STATE:
						// Return current shared data
						return success_message(sharedData.export());

					case MessageType.UPDATE_SHARED_DATA: {
						// Update active state
						const data = message.data;
						if (data) {
							return await sharedData.applyStateChange(data);
						}
						return error_message("Invalid new sharedData");
					}

					case MessageType.GET_BOT_ID: {
						// Content script requests its bot_id
						const tabId = sender?.tab?.id;
						if (!tabId) {
							return error_message("Could not determine tab ID");
						}

						const bot = COMMANDER.add_bot(tabId);
						return success_message({ bot_id: bot.bot_id });
					}

					case MessageType.BOT_READY: {
						// Content script signals it's ready / no longer busy
						const bot = COMMANDER.set_busy(message.data.bot_id, false);
						LOGGER.debug(`Bot is ready: ${bot.bot_id} on tab ${bot.tabId}`);

						return success_message({ bot_id: bot.bot_id, acknowledged: true });
					}

					case MessageType.RELAY_COMMAND: {
						// Execute an action (will be processed by content)
						// we also gather the bot selection method from popup
						LOGGER.debug("Action queued for execution", message.data);

						const bot_select = message.data.bot_select as BotSelect;
						switch (bot_select) {
							case BotSelect.BOT_ID: return COMMANDER.sendMessage(message.data.bot_id, message.data.type, message.data.data);
							case BotSelect.ACTIVE_TAB: return COMMANDER.sendMessageFocus(message.data.type, message.data.data);
							case BotSelect.ALL: return COMMANDER.sendMessageAll(message.data.type, message.data.data);
							default: return error_message("RELAY_COMMAND: Unknown BotSelect:" + bot_select);
						}
					}

					case MessageType.SET_TEMPLATE: {
						// Handle template creation/update/deletion
						const { template, action, templateId } = message.data || {};

						if (action === 'delete' && templateId) {
							const templates = sharedData.getTemplates();
							sharedData.applyStateChange({
								templates: templates.filter(t => t.id !== templateId),
							});
							LOGGER.debug(`Template deleted: ${templateId}`);
							return success_message({});
						}

						if (template) {
							const templates = sharedData.getTemplates();
							const index = templates.findIndex(t => t.id === template.id);

							if (index >= 0) {
								templates[index] = template;
							} else {
								templates.push(template);
							}

							sharedData.applyStateChange({ templates });
							LOGGER.debug(`Template saved: ${template.id}`);

							return success_message({});
						}

						return error_message("Invalid template data");
					}

					default:
						return error_message(`Unknown message type: ${message.type}`);
				}
			} catch (error) {
				LOGGER.debug("Error processing message", error);
				return error_message(error instanceof Error ? error.message : String(error));
			}
		}

		// Register the message handler
		registerMessageHandler(handleMessage);
	})
});
