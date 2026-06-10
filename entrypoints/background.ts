import { LogFrom, Logger, SharedData, SharedDataInner, BotInstance, TemplateData, BotCommander, error_message, BotSelect } from "@/components/basics";
import { registerMessageHandler, Message, MessageResponse, MessageType } from "@/components/messaging";
import { KEY_SHARED_DATA, APP_NAME, TRIGGER_SESSION_ID } from "@/components/constants";
import { storage } from '#imports';
import { ActionKind, Script } from "@/components/scripting";

const LOGGER = new Logger(LogFrom.background);
LOGGER.debug("start");

// Initialize shared data from localStorage or use defaults
async function initializeSharedData(COMMANDER: BotCommander): Promise<SharedData> {
	await LOGGER.init_background();
	const stored = await storage.getItem<SharedDataInner>(KEY_SHARED_DATA);
	if (stored) {
		try {
			return new SharedData(LOGGER, COMMANDER, stored);
		} catch (error) {
			LOGGER.log("Failed to parse stored SharedData, using defaults");
		}
	}

	return new SharedData(LOGGER, COMMANDER);
}

export default defineBackground(() => {
	// In-memory storage for active bot instances (reconstructed on start)
	const COMMANDER = new BotCommander(LOGGER);

	browser.tabs.onActivated.addListener((activeInfo) => {
		LOGGER.debug("Tab activated", activeInfo.tabId);
		COMMANDER.trackFocusedTab(activeInfo.tabId);
	});

	browser.tabs.onRemoved.addListener((tabId) => {
		COMMANDER.forgetTab(tabId);
	});

	initializeSharedData(COMMANDER).then(async (shared) => {
		LOGGER.log("Background script initialized", { id: browser.runtime.id });

		/**
		 * Message handler for all incoming messages
		 */
		async function handleMessage(message: Message, sender?: any): Promise<MessageResponse<any>> {
			LOGGER.debug(`Received message: ${message.type}`, message);

			try {
				switch (message.type) {
					case MessageType.GET_LOGS:
						// Return array of recent logs
						return success_message(LOGGER.log_array);
					
					case MessageType.SAVE_LOG:
						// Save a log entry from popup or background
						LOGGER.log_array.push(message.data);
						LOGGER.save();
						return success_message({});

					case MessageType.GET_STATE:
						// Return current shared data
						return success_message(shared.export());

					case MessageType.UPDATE_SHARED_DATA: {
						// Update active state
						const data = message.data;
						if (data) {
							return await shared.applyStateChange(data);
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
						LOGGER.log(`Bot is ready: ${bot.bot_id} on tab ${bot.tabId}, href: ${message.data.href}`);

						return success_message({ bot_id: bot.bot_id, acknowledged: true });
					}

					case MessageType.ELEMENT_SELECTOR: {
						// Broadcast start signal to all bots and wait for first successful selector reply
						const { session_id } = message.data || {};
						const promises: Promise<{ bot: BotInstance, selector: string }>[] = [];
						for (const botInstance of (COMMANDER as any).botInstances) {
							const p = botInstance.sendMessage(MessageType.ELEMENT_SELECTOR, { session_id, active: true })
								.then((resp: any) => {
									if (resp && resp.success && resp.data?.selector) {
										return { bot: botInstance, selector: resp.data.selector };
									}
									// treat non-selector replies as rejection so Promise.any will ignore them
									return Promise.reject(resp);
								})
								.catch((err: any) => Promise.reject(err));
							promises.push(p);
						}

						try {
							// Wait for the first bot that returns a selector
							const winner = await Promise.any(promises);
							// Tell all bots to stop selection mode (abort others)
							await COMMANDER.sendMessageAll(MessageType.ELEMENT_SELECTOR, { session_id, active: false });
							return success_message({ selector: winner.selector, bot_id: winner.bot.bot_id });
						} catch (error) {
							// No bot returned a selector — ensure all are aborted
							await COMMANDER.sendMessageAll(MessageType.ELEMENT_SELECTOR, { session_id, active: false });
							return error_message('No element selected');
						}
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
							const templates = shared.data.templates;
							shared.applyStateChange({
								templates: templates.filter(t => t.id !== templateId),
							});
							LOGGER.debug(`Template deleted: ${templateId}`);
							return success_message({});
						}

						if (template) {
							const templates = shared.data.templates;
							const index = templates.findIndex(t => t.id === template.id);

							if (index >= 0) {
								templates[index] = template;
							} else {
								templates.push(template);
							}

							shared.applyStateChange({ templates });
							LOGGER.debug(`Template saved: ${template.id}`);

							return success_message({});
						}

						return error_message("Invalid template data");
					}

					case MessageType.EXECUTE_SCRIPT: {
						let { session_id, script_id } = message.data || {};
						if (typeof session_id !== "number") session_id = null;

						if (script_id) {
							const script = shared.get_script(script_id);
							if (script) {
								script_worker(session_id, script);
								return success_message({});
							}
						}
						return error_message("Invalid script with id "+script_id);
					}
					
					case MessageType.TRIGGER_FIRED: {
						let { session_id, focus_bot, bot_id, trigger_id } = message.data || {};
						if (typeof session_id !== "number") session_id = null;
						const bot = focus_bot? await COMMANDER.getBotFocus() : await COMMANDER.getBot(bot_id);
						if(!trigger_id) return error_message("Invalid trigger with id "+trigger_id);
						const trigger = shared.get_trigger(trigger_id);
						const script = shared.get_script(trigger.script_id);

						if (trigger.conditions.length) {
							// Send conditions to bot (if it has some)
							const result = await bot.sendMessage(MessageType.CHECK_CONDITIONS, { conditions: trigger.conditions });
							if(!result.success) return error_message("Trigger #"+trigger_id+" conditions failed");
						}

						progress_report(session_id, "Trigger `"+trigger.name+"` conditions fulfilled.");
						script_worker(session_id, script, bot);
						return success_message({});
					}

					default:
						LOGGER.log(`Unknown message type: ${message.type}`);
						return error_message(`Unknown message type: ${message.type}`);
				}
			} catch (error) {
				LOGGER.log("Error processing message", error);
				return error_message(error instanceof Error ? error.message : String(error));
			}
		}

		// Register the message handler
		registerMessageHandler(handleMessage);

		// create function to send progress reports
		async function progress_report(session_id: number|null, message: string) {
			LOGGER.log("PROGRESS_REPORT", message);
			if(session_id === null) return;

			try {
				await browser.runtime.sendMessage({
					type: MessageType.PROGRESS_REPORT,
					data: { session_id, message }
				});
			} catch (error) {
				LOGGER.log("PROGRESS_REPORT", error);
			}
		}

		async function script_worker(session_id: number|null, script: Script, _bot?: BotInstance) {
			const bot = _bot?? await COMMANDER.getBotFocus();
			progress_report(session_id, "Script `"+script.name+"` started");

			for (let index = 0; index < script.lines.length; index++) {
				const script_line = script.lines[index];
				if (script_line.conditions.length) {
					// Send conditions to bot (if it has some)
					const result = await bot.sendMessage(MessageType.CHECK_CONDITIONS, { conditions: script_line.conditions });
					if(!result.success) {
						progress_report(session_id, "Script `"+script.name+"` aborted. One of the conditions is false.");
						return;
					}
					progress_report(session_id, "Script `"+script.name+"`: All conditions are true.");
				}

				// execute actions
				for (let index = 0; index < script_line.actions.length; index++) {
					const action = script_line.actions[index];
					switch (action.type.kind) {
						case ActionKind.SCRIPT: {
							if(!action.arguments.id) throw new Error("Error in script#"+script.id+": script_id is invalid");
							
							const action_script = shared.get_script(action.arguments.id);
							progress_report(session_id, "START Action: Script `"+action_script.name+"` from Script `"+script.name+"`.");
							await script_worker(session_id, action_script, bot);
							progress_report(session_id, "DONE  Action: Script `"+action_script.name+"` from Script `"+script.name+"`.");
							break;
						}
					
						case ActionKind.MESSAGE_TYPE: {
							if(!action.type.message_type) throw new Error("Error in script#"+script.id+": action.type.message_type is invalid");
							progress_report(session_id, "START Action: "+action.type.name);

							switch (action.type.message_type) {
								case MessageType.INSERT_TEMPLATE: {
									if(!action.arguments.id) throw new Error("Error in script#"+script.id+": id is invalid");
									if(!action.arguments.element_selector) throw new Error("Error in script#"+script.id+": element_selector is invalid");
									const template = shared.get_template(action.arguments.id);
									await bot.sendMessage(action.type.message_type, { content: template.content, element_selector: action.arguments.element_selector });
									break;
								}
							
								default: throw new Error("ActionKind.MESSAGE_TYPE:"+action.type.message_type+" is not supported");
							}
							progress_report(session_id, "DONE  Action: "+action.type.name);
							break;
						}
					
						case ActionKind.NOTIFY: {
							if(!action.arguments.text) throw new Error("Error in script#"+script.id+": action.arguments.text is invalid");
							progress_report(session_id, "NOTIFY: "+action.arguments.text);
							// create a simple browser notification
							try {
								await browser.notifications.create('notify-'+Date.now(), {
									type: 'basic',
									title: APP_NAME,
									message: action.arguments.text,
									iconUrl: browser.runtime.getURL('/icon-48.png')
								});
							} catch (err) {
								LOGGER.log('Notification error', err);
							}
							if(shared.data.allow_alert_notify) COMMANDER.sendMessageFocus(MessageType.ALERT, { text: action.arguments.text });
							break;
						}
					
						case ActionKind.WAIT: {
							if(!action.arguments.seconds) throw new Error("Error in script#"+script.id+": action.arguments.seconds is invalid");
							progress_report(session_id, "WAIT: "+action.arguments.seconds+" seconds");
							await new Promise(resolve => setTimeout(resolve, action.arguments.seconds! * 1000));
							break;
						}
					
						default:
							break;
					}
				}
			}

			if(_bot === undefined) progress_report(session_id, "Script `"+script.name+"` completed. All actions ended successfully.");
		}
	});
});
