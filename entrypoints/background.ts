import { LogFrom, Logger, SharedData, SharedDataInner, BotInstance, TemplateData, BotCommander, error_message, BotSelect, ScriptMessageContext } from "@/components/basics";
import { registerMessageHandler, Message, MessageResponse, MessageType, withTimeout } from "@/components/messaging";
import { KEY_SHARED_DATA, APP_NAME, TRIGGER_SESSION_ID } from "@/components/constants";
import { storage } from '#imports';
import { ActionKind, Condition, ConditionTargetType, ForeachContext, Script, testCondition } from "@/components/scripting";

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
	const global_variables: Record<string, string> = {};
	let shared: SharedData;

	function resolveActionArgument(value: string, local_variables: Record<string, string>): string {
		if (typeof value !== "string") return value;

		return value.replace(/\$\{(local|global|persistent):([a-zA-Z0-9_\-]+)\}/g, (_match, scope, name) => {
			const variableName = String(name);
			switch (scope) {
				case "local":
					return local_variables[variableName] ?? "";
				case "global":
					return global_variables[variableName] ?? "";
				case "persistent":
					return shared?.data?.persistent_variables?.[variableName] ?? "";
			}
			return "";
		});
	}

	async function play_audio(source: string, speaker_device: string) {
		const ctx = new AudioContext();
		if (ctx.state === 'suspended') {
			await ctx.resume();
		}
		if (speaker_device && speaker_device !== "default" && (ctx as any).setSinkId) {
			try {
				await (ctx as any).setSinkId(speaker_device);
			} catch(err) {
				// Unsupported or permission denied — fall back to default
				console.error(err);
			}
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
			osc.stop(ctx.currentTime + 2);
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
	}

	browser.tabs.onActivated.addListener((activeInfo) => {
		LOGGER.debug("Tab activated", activeInfo.tabId);
		COMMANDER.trackFocusedTab(activeInfo.tabId);
	});

	browser.tabs.onRemoved.addListener((tabId) => {
		COMMANDER.forgetTab(tabId);
	});

	initializeSharedData(COMMANDER).then(async (loadedShared) => {
		shared = loadedShared;
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
						if (!tabId) return error_message("Could not determine tab ID");
						const hostname = message.data.hostname;
						if (!message.data.hostname) return error_message("Could not determine hostname");

						const bot = COMMANDER.add_bot(tabId, hostname);
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
								void script_worker(session_id, script);
								return success_message({});
							}
							await progress_report(session_id, { name: String(script_id) } as Script, "error", "Invalid script with id " + script_id);
						}
						return error_message("Invalid script with id "+script_id);
					}
					
					case MessageType.TRIGGER_FIRED: {
						let { session_id, focus_bot, bot_id, trigger_id } = message.data || {};
						if (typeof session_id !== "number") session_id = null;
						const bot = focus_bot? await COMMANDER.getBotFocus() : await COMMANDER.getBot(bot_id);
						if(!trigger_id) return error_message("Invalid trigger with id "+trigger_id);
						const trigger = shared.get_trigger(trigger_id);
						if (!trigger) {
							await progress_report(session_id, { name: String(trigger_id) } as Script, "error", "Invalid trigger with id " + trigger_id);
							return error_message("Invalid trigger with id "+trigger_id);
						}
						const script = shared.get_script(trigger.script_id);
						if (!script) {
							await progress_report(session_id, { name: trigger.name } as Script, "error", "Trigger `"+trigger.name+"` references missing script `"+trigger.script_id+"`.");
							return error_message("Trigger #"+trigger_id+" references missing script");
						}

						if (trigger.conditions.length) {
							const result = await checkConditions(trigger.conditions, bot, (scope, name) => {
								if (scope === 'global') return global_variables[name] ?? null;
								if (scope === 'persistent') return shared?.data?.persistent_variables?.[name] ?? null;
								return null;
							});
							if(!result.success || !result.result) return error_message("Trigger #"+trigger_id+" conditions failed. "+result.error);
						}

						await progress_report(session_id, script, "progress", "Trigger `"+trigger.name+"` conditions fulfilled.");
						void script_worker(session_id, script, bot);
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
		async function progress_report(session_id: number|null, script: Script, kind: "progress" | "error" | "info" | "response", message: string) {
			LOGGER.log("PROGRESS_REPORT", message);
			if(session_id === null) return;

			try {
				await browser.runtime.sendMessage({
					type: MessageType.PROGRESS_REPORT,
					data: { session_id, kind, message, meta: script.name }
				});
			} catch (error) {
				LOGGER.log("PROGRESS_REPORT", error);
			}
		}

		async function report_script_issue(session_id: number|null, script: Script, context: string, error: unknown) {
			const errorText = error instanceof Error ? error.message : String(error);
			LOGGER.log(context, error);
			await progress_report(session_id, script, "error", `${context}: ${errorText}`);
		}

		async function checkConditions(conditions: Condition[], bot: BotInstance, getVariableFn: (scope: string, name: string) => string|null, foreach_context?: ForeachContext, script_context?: ScriptMessageContext): Promise<{ success: boolean; result: boolean; error: string; script_context?: ScriptMessageContext }> {
			const variableConditions: Condition[] = [];
			const otherConditions: Condition[] = [];
			for (let condIndex = 0; condIndex < conditions.length; condIndex++) {
				const condition = conditions[condIndex];
				if (condition.target.target_type === ConditionTargetType.VARIABLE) {
					variableConditions.push(condition);
				} else {
					otherConditions.push(condition);
				}
			}
			for (let condIndex = 0; condIndex < variableConditions.length; condIndex++) {
				const condition = variableConditions[condIndex];
				const scope = condition.target.variable_scope;
				const name = condition.target.variable_name;
				if (!scope || !name) {
					return { success: false, result: false, error: "Condition "+condIndex+": Variable condition missing scope or name" };
				}
				const value = getVariableFn(scope, name);
				if (!testCondition(condition.type, value, condition.string_value)) {
					return {
						success: true,
						result: false,
						error: `Condition ${condIndex}: Variable condition failed: ${scope}:${name} ${conditionType_toString(condition.type)} expected ${JSON.stringify(condition.string_value)} but got ${JSON.stringify(value)}`,
						script_context,
					};
				}
			}
			if (otherConditions.length > 0) {
				const messageData: Record<string, any> = { conditions: otherConditions };
				if (foreach_context) {
					messageData.foreach_selector = foreach_context.foreach_selector;
					messageData.foreach_index = foreach_context.foreach_index;
				}
				const response = await bot.sendMessage(MessageType.CHECK_CONDITIONS, messageData, script_context);
				return {
					success: response.success,
					result: response.data?.result ?? true,
					error: response.data?.error ?? "",
				};
			}
			return { success: true, result: true, error: "", script_context };
		}

		async function script_worker(session_id: number|null, script: Script, _bot?: BotInstance, foreach_context?: ForeachContext) {
			try {
				const bot = _bot  ?? await COMMANDER.getBotFocus();
				await progress_report(session_id, script, "progress", "Script `" + script.name + "` started");

				const local_variables: Record<string, string> = {};
				function setVariable(scope: string, name: string, value: string) {
					if (!name) return;
					switch (scope) {
						case 'local':
							local_variables[name] = value;
							break;
						case 'global':
							global_variables[name] = value;
							break;
						case 'persistent': {
							const persistent_variables = { ...shared.data.persistent_variables, [name]: value };
							shared.applyStateChange({ persistent_variables });
							break;
						}
					}
				}

				function getVariable(scope: string, name: string): string | null {
					switch (scope) {
						case 'local': return local_variables[name] ?? null;
						case 'global': return global_variables[name] ?? null;
						case 'persistent': return shared.data.persistent_variables[name] ?? null;
						default: return null;
					}
				}

				for (let index = 0; index < script.lines.length; index++) {
					const script_line = script.lines[index];
					let lineContext: ScriptMessageContext = { conditions: script_line.conditions };
					if (script_line.conditions.length) {
						const result = await checkConditions(script_line.conditions, bot, (scope, name) => getVariable(scope, name), foreach_context, lineContext);
						if (!result.success) {
							await progress_report(session_id, script, "error", "Script `"+script.name+"` line #"+index+" aborted. "+result.error);
							return;
						}
						if (!result.result) {
							await progress_report(session_id, script, "info", "Script `"+script.name+"`: line #"+index+" skipped — condition false: "+result.error);
							continue;
						}
						await progress_report(session_id, script, "progress", "Script `"+script.name+"`: All conditions are true.");
					}

					for (let actionIndex = 0; actionIndex < script_line.actions.length; actionIndex++) {
						const action = script_line.actions[actionIndex];
						try {
							switch (action.type.kind) {
								case ActionKind.SCRIPT: {
									if (!action.arguments.id) throw new Error("Error in script#" + script.id + ": script_id is invalid");
									const action_script = shared.get_script(action.arguments.id);
									if (!action_script) throw new Error("Error in script#"+script.id+": missing nested script `"+action.arguments.id+"`");
									await progress_report(session_id, script, "progress", "START Action: Script `"+action_script.name+"` from Script `"+script.name+"`.");
									await script_worker(session_id, action_script, bot);
									await progress_report(session_id, script, "progress", "DONE  Action: Script `"+action_script.name+"` from Script `"+script.name+"`.");
								break;
								}
								case ActionKind.SET_VARIABLE: {
									const scope = action.arguments.scope;
									const name = action.arguments.name;
									if (!scope) throw new Error("Error in script#" + script.id + ": variable scope is invalid");
									if (!name) throw new Error("Error in script#" + script.id + ": variable name is invalid");

									const value = resolveActionArgument(action.arguments.value ?? "", local_variables);
									setVariable(scope, name, value);
									break;
								}
								case ActionKind.ASSIGN_VARIABLE_ELEMENT_ATTRIBUTE: {
									const scope = action.arguments.scope;
									const name = action.arguments.name;
									if (!scope) throw new Error("Error in script#" + script.id + ": variable scope is invalid");
									if (!name) throw new Error("Error in script#" + script.id + ": variable name is invalid");

									const element_selector = resolveActionArgument(action.arguments.element_selector ?? "", local_variables);
									const attribute = resolveActionArgument(action.arguments.attribute ?? "", local_variables);
									if (!element_selector) throw new Error("Error in script#" + script.id + ": element_selector is invalid");
									if (!attribute) throw new Error("Error in script#" + script.id + ": attribute is invalid");

									const getAttrData: Record<string, any> = {
										element_selector,
										attribute,
									};
									if (foreach_context) {
										getAttrData.foreach_selector = foreach_context.foreach_selector;
										getAttrData.foreach_index = foreach_context.foreach_index;
									}
									const result = await withTimeout(
										bot.sendMessage(MessageType.GET_ELEMENT_ATTRIBUTE, getAttrData),
										5000,
										`Timed out while reading element attribute for selector ${element_selector}`
									);
									if (!result.success) {
										throw new Error("Failed to get element attribute: " + result.error);
									}
									const value = result.data?.value ?? "";
									setVariable(scope, name, value);
									break;
								}
								case ActionKind.MESSAGE_TYPE: {
									if (!action.type.message_type) throw new Error("Error in script#" + script.id + ": action.type.message_type is invalid");
									await progress_report(session_id, script, "progress", "START Action: " + action.type.name);

									switch (action.type.message_type) {
										case MessageType.INSERT_TEMPLATE: {
											if (!action.arguments.id) throw new Error("Error in script#" + script.id + ": id is invalid");
											if (!action.arguments.element_selector) throw new Error("Error in script#" + script.id + ": element_selector is invalid");
											const template = shared.get_template(action.arguments.id);
											if (!template) throw new Error("Error in script#"+script.id+": missing template `"+action.arguments.id+"`");

											const content = resolveActionArgument(template.content, local_variables);
											const insertData: Record<string, any> = {
												content: content,
												element_selector: action.arguments.element_selector,
												delete_insert: true,
											};
											if (foreach_context) {
												insertData.foreach_selector = foreach_context.foreach_selector;
												insertData.foreach_index = foreach_context.foreach_index;
											}
											const result = await bot.sendMessage(action.type.message_type, insertData, lineContext);
											if (!result.success) {
												await progress_report(session_id, script, "error", "Script `"+script.name+"` aborted. Action "+action.type.message_type+" failed. "+result.error);
												return;
											}
											break;
										}

										case MessageType.SET_ELEMENT_ATTRIBUTE: {
											if (!action.arguments.element_selector) throw new Error("Error in script#"+script.id+": element_selector is invalid");
											if (!action.arguments.attribute) throw new Error("Error in script#"+script.id+": attribute is invalid");
											const value = resolveActionArgument(action.arguments.value ?? "", local_variables);
											const setAttrData: Record<string, any> = {
												element_selector: action.arguments.element_selector,
												attribute: action.arguments.attribute,
												set_method: action.arguments.set_method,
												value: value,
											};
											if (foreach_context) {
												setAttrData.foreach_selector = foreach_context.foreach_selector;
												setAttrData.foreach_index = foreach_context.foreach_index;
											}
											const result = await bot.sendMessage(action.type.message_type, setAttrData, lineContext);
											if (!result.success) {
												await progress_report(session_id, script, "error", "Script `"+script.name+"` aborted. Action "+action.type.message_type+" failed. "+result.error);
												return;
											}
											break;
										}

										case MessageType.TRIGGER_ELEMENT_EVENT: {
											if (!action.arguments.element_selector) throw new Error("Error in script#"+script.id+": element_selector is invalid");
											if (!action.arguments.event_type) throw new Error("Error in script#"+script.id+": event_type is invalid");
											const triggerData: Record<string, any> = {
												element_selector: action.arguments.element_selector,
												event_type: action.arguments.event_type,
											};
											if (foreach_context) {
												triggerData.foreach_selector = foreach_context.foreach_selector;
												triggerData.foreach_index = foreach_context.foreach_index;
											}
											const result = await bot.sendMessage(action.type.message_type, triggerData, lineContext);
											if (!result.success) {
												await progress_report(session_id, script, "error", "Script `"+script.name+"` aborted. Action "+action.type.message_type+" failed. "+result.error);
												return;
											}
											break;
										}
										
										default:
											throw new Error("ActionKind.MESSAGE_TYPE:" + action.type.message_type + " is not supported");
									}
									await progress_report(session_id, script, "progress", "DONE  Action: " + action.type.name);
									break;
								}
								case ActionKind.NOTIFY: {
									if (!action.arguments.value) throw new Error("Error in script#" + script.id + ": action.arguments.value is invalid");
									const text = resolveActionArgument(action.arguments.value ?? "", local_variables);
									await progress_report(session_id, script, "info", "NOTIFY: " + text);
									try {
										await browser.notifications.create('notify-' + Date.now(), {
											type: 'basic',
											title: APP_NAME,
											message: text,
											iconUrl: browser.runtime.getURL('/icon-48.png'),
										});
									} catch (err) {
										await report_script_issue(session_id, script, "Notification error", err);
									}
									if (shared.data.allow_alert_notify) COMMANDER.sendMessageFocus(MessageType.ALERT, { text: text });
									break;
								}
							case ActionKind.PLAY_AUDIO: {
								const source = resolveActionArgument(action.arguments.source || shared.data.notify_sound_source, local_variables);
								await progress_report(session_id, script, "info", "PLAY_AUDIO: " + source);
								if (!shared.data.notify_sound_enabled) break;
								if (navigator.userAgent.includes("Firefox")) {
									await play_audio(source, shared.data.notify_speaker_device);
								} else {
									COMMANDER.sendMessageFocus(MessageType.PLAY_AUDIO, {
										source,
										speaker_device: shared.data.notify_speaker_device,
									});
								}
								break;
							}
								case ActionKind.OPEN_URL: {
								const url = resolveActionArgument(action.arguments.url ?? "", local_variables);
								if (!url) throw new Error("Error in script#" + script.id + ": url is invalid");
								const newTab = action.arguments.new_tab !== "false";
								await progress_report(session_id, script, "progress", "Opening URL: " + url + (newTab ? " (new tab)" : ""));
								if (newTab) {
									await browser.tabs.create({ url, active: true });
								} else {
									await browser.tabs.update(bot.tabId, { url });
								}
								break;
							}
							case ActionKind.WAIT: {
									if (!action.arguments.seconds) throw new Error("Error in script#" + script.id + ": action.arguments.seconds is invalid");
									await progress_report(session_id, script, "progress", "WAIT: " + action.arguments.seconds + " seconds");
									await new Promise(resolve => setTimeout(resolve, action.arguments.seconds! * 1000));
									break;
								}
								case ActionKind.FOREACH_ELEMENT: {
									const forEachSelector = resolveActionArgument(action.arguments.element_selector ?? "", local_variables);
									if (!forEachSelector) throw new Error("Error in script#" + script.id + ": element_selector is invalid");
									if (!action.arguments.id) throw new Error("Error in script#" + script.id + ": id is invalid");

									const foreachScript = shared.get_script(action.arguments.id);
									progress_report(session_id, script, "progress", "START Action: Execute Per Element with `" + foreachScript.name + "`");

									const countResult = await bot.sendMessage(MessageType.GET_ELEMENT_ATTRIBUTE, {
										element_selector: forEachSelector,
										attribute: "length",
										use_cache: true,
									});
									if (!countResult.success) {
										throw new Error("Failed to count elements: " + countResult.error);
									}
									const count = parseInt(countResult.data?.value ?? "0");

									try {
										for (let i = 0; i < count; i++) {
											setVariable("local", "foreach_index", String(i));
											setVariable("local", "foreach_count", String(count));
											setVariable("local", "foreach_selector", forEachSelector);
											await script_worker(session_id, foreachScript, bot, {
												foreach_selector: forEachSelector,
												foreach_index: i,
											});
										}
									} finally {
										await bot.sendMessage(MessageType.CLEAR_FOREACH_CACHE, {});
									}
									progress_report(session_id, script, "progress", "DONE  Action: Execute Per Element with `" + foreachScript.name + "`");
									break;
								}
								default:
									break;
							}
						} catch (error) {
							await report_script_issue(session_id, script, "Script action failed", error);
							return;
						}
					}
				}

				if (_bot === undefined) progress_report(session_id, script, "response", "Script `" + script.name + "` completed. All actions ended successfully.");
			} catch (error) {
				await report_script_issue(session_id, script, "Script execution failed", error);
			}
		}
	});
});
