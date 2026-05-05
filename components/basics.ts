import { DEFAULT_ACTIVE } from "./constants";
import { MessageType, sendMessage } from "./messaging";

export enum LogFrom {
	popup = 0,
	background = 1,
	content = 2,
}
function log_from_to_string(log_from: LogFrom): string {
	switch (log_from) {
		case LogFrom.popup: return "popup";
		case LogFrom.background: return "background";
		case LogFrom.content: return "content";
	}
}

export interface LogEntry {
	from: LogFrom,
	text: string,
}

export interface TemplateData {
	id: string;
	name: string;
	content: string;
	createdAt: number;
}

export interface BotInstance {
	bot_id: number;
	tabId: number;
	is_busy: boolean;
	sendMessage: (message_type: MessageType, data: Object) => Promise<any>
}

export enum BotSelect {
	BOT_ID = 0,
	ACTIVE_TAB = 1,
	ALL = 99,
}

export class Logger {
	from: LogFrom;

	constructor(log_from: LogFrom) {
		this.from = log_from;
	}

	// debug only sends to console.log
	debug(...params: any[]) {
		const prefix = "[" + log_from_to_string(this.from) + "]";
		console.log(prefix, ...params);
	}

	// log sends to console.log and to "background.ts" to save it permemently in localStorage
	log(...params: any[]) {
		const prefix = "[" + log_from_to_string(this.from) + "]";
		console.log(prefix, ...params);
	}
}

export function success_message(data: Object) {
	return { success: true, data: data };
}
export function error_message(error: string) {
	return { success: false, error: error };
}

export interface SharedDataInner {
	//** if false, it acts as a kill switch and stops any proccesses in "content.ts" */
	active: boolean,
	templates: TemplateData[],
}


/**
 * BotCommander includes botInstances and methods to send commands to "content.ts" the bot.
 * Its main usage is from background.
 * If it is beeing used from popup, then the command is relayed to background.
 * It can not be used from content.
 */
export class BotCommander {
	// Key is bot_id (number), value is BotInstance
	private botInstances: BotInstance[] = [];
	LOGGER: Logger;

	constructor(LOGGER: Logger) {
		this.LOGGER = LOGGER;
	}

	// @internal only for background
	add_bot(tabId: number): BotInstance {
		// Check if bot already exists for this tab
		let botInstance = this.botInstances.find(b => b.tabId === tabId);
		if (!botInstance) {
			const self = this;
			// Create new bot instance
			const bot_id = this.botInstances.length;
			botInstance = {
				bot_id,
				tabId,
				is_busy: false,
				sendMessage: async function (message_type: MessageType, data: Object) {
					this.is_busy = true;
					
					try {
						const response = await browser.tabs.sendMessage(this.tabId, {
							type: message_type,
							data: data,
						});
						this.is_busy = false;
						return response;
					} catch (error) {
						this.is_busy = false;
						self.LOGGER.debug(`Failed to send message of type:${message_type} to bot ${this.bot_id} on tab ${this.tabId}. data:`, data, "error:", error);
						return error_message("Failed to send message: "+String(error));
					}
				}
			};
			this.botInstances[bot_id] = botInstance;
			this.LOGGER.debug(`New bot assigned: ${bot_id} on tab ${tabId}`);
		}

		return botInstance;
	}

	// @internal only for background
	set_busy(bot_id: number, is_busy: boolean) {
		this.botInstances[bot_id].is_busy = is_busy;
		return this.botInstances[bot_id];
	}

	async sendMessage(bot_id: number, message_type: MessageType, data: Object) {
		if (this.LOGGER.from === LogFrom.popup) {
			// pass to background
			return await sendMessage({
				type: MessageType.RELAY_COMMAND,
				data: {
					bot_select: BotSelect.BOT_ID,
					bot_id: bot_id,
					type: message_type,
					data: data
				}
			});
		}

		// LogFrom.background
		return this.botInstances[bot_id].sendMessage(message_type, data);
	}

	/**
	 * @returns BotInstance that is not busy
	 * and sets it to busy, because we exepect it will be busy to prevent that another thread tries to accoupy this bot
	 */
	private async getBot(): Promise<BotInstance> {
		for (let z = this.botInstances.length -1; z >= 0; z--) {
			if (!this.botInstances[z].is_busy) {
				return this.botInstances[z];
			}			
		}
		throw new Error("No active bot instance found");
	}

	/**
	 * @returns BotInstance that is not busy and focused
	 * and sets it to busy, because we exepect it will be busy to prevent that another thread tries to accoupy this bot
	 */
	private async getBotFocus(): Promise<BotInstance> {
		const [focusedTab] = await browser.tabs.query({
			active: true,
			lastFocusedWindow: true,
		});
		const focusedTab_id = focusedTab.id;
		
		for (let z = this.botInstances.length -1; z >= 0; z--) {
			if (this.botInstances[z].tabId === focusedTab_id) {
				if (this.botInstances[z].is_busy) {
					throw new Error("Found bot in focused tab:"+focusedTab.id+", but it is busy");
				} else {
					return this.botInstances[z];
				}			
			}
		}
		this.LOGGER.debug("No active tab bot instance found. focusedTab:", focusedTab)
		this.LOGGER.debug("No active tab bot instance found. focusedTab:", focusedTab_id)
		this.LOGGER.debug("No active tab bot instance found. this.botInstances:", this.botInstances)
		throw new Error("No active tab bot instance found");
	}

	/**
	 * send message to a bot that is not busy and focus the current tab
	 */
	async sendMessageFocus(message_type: MessageType, data: Object) {
		if (this.LOGGER.from === LogFrom.popup) {
			// pass to background
			return await sendMessage({
				type: MessageType.RELAY_COMMAND,
				data: {
					bot_select: BotSelect.ACTIVE_TAB,
					type: message_type,
					data: data
				}
			});
		}

		// LogFrom.background
		const bot = await this.getBotFocus();
		return bot.sendMessage(message_type, data);
	}

	async sendMessageAll(message_type: MessageType, data: Object) {
		if (this.LOGGER.from === LogFrom.popup) {
			// pass to background
			return await sendMessage({
				type: MessageType.RELAY_COMMAND,
				data: {
					bot_select: BotSelect.ALL,
					type: message_type,
					data: data
				}
			});
		}

		// LogFrom.background
		let success = true;
		let promises = [];

		for (const botInstance of this.botInstances) {
			promises[promises.length] = browser.tabs.sendMessage(botInstance.tabId, {
				type: message_type,
				data: data,
			}).catch((error) => {
				this.LOGGER.debug(`Failed to send message of type:${message_type} to bot ${botInstance.bot_id} on tab ${botInstance.tabId}. data:`, data, "error:", error);
			});
		}

		for (let i = 0; i < promises.length; i++) {
			try {
				await promises[i];
			} catch (error) {
				success = false;
			}			
		}
		
		if (success) {
			return success_message({});
		} else {
			return error_message("Failed to notify all bots of state change: "+String(this));
		}
	}
}

/**
 * SharedData abstraction layer - provides type-safe getters/setters
 * All data mutations go through this class for consistency
 */
export class SharedData {
	private data: SharedDataInner;
	LOGGER: Logger;
	COMMANDER: BotCommander;

	constructor(LOGGER: Logger, COMMANDER: BotCommander, data: Partial<SharedDataInner> = {}) {
		this.LOGGER = LOGGER;
		this.COMMANDER = COMMANDER;
		this.data = {
			active: data.active ?? DEFAULT_ACTIVE,
			templates: data.templates ?? [],
		};
	}

	// Getters
	getActive(): boolean {
		return this.data.active;
	}

	getTemplates(): TemplateData[] {
		return this.data.templates;
	}

	// Setters
	async setTemplate(template: TemplateData): Promise<void> {
		await sendMessage({
			type: MessageType.SET_TEMPLATE,
			data: { template }
		});
		const index = this.data.templates.findIndex(t => t.id === template.id);
		if (index >= 0) {
			this.data.templates[index] = template;
		} else {
			this.data.templates.push(template);
		}
	}

	async deleteTemplate(templateId: string): Promise<void> {
		await sendMessage({
			type: MessageType.SET_TEMPLATE,
			data: { action: 'delete', templateId }
		});
		this.data.templates = this.data.templates.filter(t => t.id !== templateId);
	}

	/**
	 * apply state changes and pass them on
	 */
	async applyStateChange(update: Partial<SharedDataInner>) {
		Object.assign(this.data, update);
		if (this.COMMANDER.LOGGER.from === LogFrom.popup) {
			// pass to background
			await sendMessage({
				type: MessageType.UPDATE_SHARED_DATA,
				data: this.data
			});
		} else if (this.COMMANDER.LOGGER.from === LogFrom.background) {
			this.save();
			return this.COMMANDER.sendMessageAll(MessageType.UPDATE_SHARED_DATA, this.data);
		}
		return success_message({});
	}

	export(): SharedDataInner {
		return this.data;
	}

	/**
	 * Save shared data to extention storage
	 */
	save() {
		if(this.COMMANDER.LOGGER.from !== LogFrom.background) throw new Error("save() should only be run in background");
		
		storage.setItem(KEY_SHARED_DATA, this.data);
		this.COMMANDER.LOGGER.debug("SharedData persisted to extention storage");
	}
}