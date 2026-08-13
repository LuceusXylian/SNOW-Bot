import { SEND_MESSAGE_TIMEOUT_MS, DEFAULT_ACTIVE, DEFAULT_ALLOW_PROMPT, DEFAULT_PASTE_CLEANER_ENABLED, MAX_LOG_ENTRIES, DEFAULT_ALLOW_ALERT_NOTIFY, DEFAULT_DATETIME_LOCALE, DEFAULT_NOTIFY_SOUND_ENABLED, DEFAULT_NOTIFY_SOUND_SOURCE, DEFAULT_NOTIFY_SPEAKER_DEVICE, get_default_button_grid_cols } from "./constants";
import { MessageType, sendMessage } from "./messaging";
import { testCondition, ConditionTargetType, conditionType_toString, type Script, type Trigger } from "./scripting";

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

export interface ScriptMessageContext {
	conditions?: Condition[];
}

export function shouldSendMessageToFrame(frameUrl: string, scriptContext?: ScriptMessageContext): boolean {
	if (!scriptContext?.conditions?.length) return true;

	console.log("shouldSendMessageToFrame frameUrl ", frameUrl);
	console.log("shouldSendMessageToFrame scriptContext?.conditions ", scriptContext?.conditions);
	for (const condition of scriptContext.conditions) {
		let value1;
		if (condition.target.target_type === ConditionTargetType.HOSTNAME) {
			value1 = new URL(frameUrl).hostname;
		} else if (condition.target.target_type === ConditionTargetType.URL) {
			value1 = frameUrl;
		} else {
			continue;
		}

		const ret = testCondition(condition.type, value1, condition.string_value);
		console.log("shouldSendMessageToFrame testCondition", value1, conditionType_toString(condition.type), condition.string_value, " = ", ret);
		if (!ret) return false;
	}
	console.log("shouldSendMessageToFrame frameUrl TRUE", frameUrl);
	return true;
}

export interface BotInstance {
	bot_id: number;
	tabId: number;
	// frameIds: number[]; Idea: instead of sending to all frames, send only to registered frames, to avoid so send to dead frames
	hostname: string;
	is_busy: boolean;
	sendMessage: (message_type: MessageType, data: Object, options?: ScriptMessageContext) => Promise<any>
}

export enum BotSelect {
	BOT_ID = 0,
	ACTIVE_TAB = 1,
	ALL = 99,
}

export interface LogEntry {
	from: LogFrom,
	timestamp: number,
	text: string,
}

export class Logger {
	from: LogFrom;
	log_array: LogEntry[] = [];

	constructor(log_from: LogFrom) {
		this.from = log_from;
	}
	
	// For LogFrom.background, Logger needs to load old log entries
	async init_background() {
		this.log_array = await storage.getItem(LS_KEY_LOGS) || [];
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

		let text = prefix;
		for (const param of params) {
			text += " ";
			if (typeof param === "object") {
				text += JSON.stringify(params);
			} else {
				text += String(param);
			}
		}
		
		const new_log: LogEntry = {
			from: this.from,
			timestamp: new Date().getTime(),
			text,
		};
		if (this.from === LogFrom.background) {
			this.log_array.push(new_log);
			this.save();
		} else {
			// Send log to background to save it
			browser.runtime.sendMessage({
				type: MessageType.SAVE_LOG,
				data: new_log
			});
		}
	}

	save() {
		if (this.log_array.length > MAX_LOG_ENTRIES) {
			this.log_array.shift();
		}
		storage.setItem(LS_KEY_LOGS, this.log_array);
	}
}

export function success_message(data: Object) {
	return { success: true, data: data };
}
export function error_message(error: string) {
	return { success: false, error: error };
}

export interface ButtonGrid {
	title: string,
	buttons: ButtonGridButton[]
}

export interface ButtonGridButton {
	text: string,
	script_id: string|null
}

export interface SharedDataInner {
	configurator_mode: boolean;
	//** if false, it acts as a kill switch and stops any proccesses in "content.ts" */
	active: boolean,
	allow_prompt: boolean,
	paste_cleaner_enabled: boolean,
	allow_alert_notify: boolean,
	notify_sound_enabled: boolean,
	notify_sound_source: string,
	notify_speaker_device: string,
	templates: TemplateData[],
	scripts: Script[],
	triggers: Trigger[],
	button_grids: ButtonGrid[],
	button_grid_index: number,
	button_grid_cols: number;
	button_grid_min_rows: number;
	datetime_locale: string,
	persistent_variables: Record<string, string>,
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
	private recentTabIds: number[] = [];
	LOGGER: Logger;

	constructor(LOGGER: Logger) {
		this.LOGGER = LOGGER;
	}

	// @internal only for background
	add_bot(tabId: number, hostname: string): BotInstance {
		// Check if bot already exists for this tab
		let botInstance = this.botInstances.find(b => b.tabId === tabId);
		if (!botInstance) {
			const self = this;
			// Create new bot instance
			const bot_id = this.botInstances.length;
			botInstance = {
				bot_id,
				tabId,
				hostname,
				is_busy: false,
				sendMessage: async function (message_type: MessageType, data: Object, options?: ScriptMessageContext) {
					this.is_busy = true;
					
					try {
						const frames = await browser.webNavigation.getAllFrames({ tabId: this.tabId });
						if(frames === null) return self.remove_bot(bot_id, "it has no frames");
						
						const filtered_frames = (options?.conditions?.length)
							? frames.filter((frame) => shouldSendMessageToFrame(frame.url, options))
							: frames;

						if(filtered_frames.length === 0) throw new Error("No bot available with the current conditions");
						
						const firstFrame = filtered_frames[0]!;
						const first = await browser.tabs.sendMessage(this.tabId, {
								type: message_type,
								data: data,
								frameId: firstFrame.frameId
							}, { frameId: firstFrame.frameId });

						if (!first.success) {
							for (let f = 1; f < filtered_frames.length; f++) {
								const frame = filtered_frames[f]!;
								console.log("sendMessage frameIndex "+f, frame.url);
								
								try {
									const response = await browser.tabs.sendMessage(this.tabId, {
										type: message_type,
										data: data,
										frameId: frame.frameId
									}, { frameId: frame.frameId });

									console.log("sendMessage response", response);
									if (response.success) {
										this.is_busy = false;
										return response;
									}
									await sleep(100) //give a little breathing time for content so it can render, so it does not crash
								} catch (error) {
									self.LOGGER.log("sendMessage(", message_type, ", ", data, ") failed for tabId:"+this.tabId+" frameId:"+frame.frameId);
								}
							}
						}
						this.is_busy = false;
						return first;
					} catch (error) {
						this.is_busy = false;
						console.log("error", error);
						
						if (error === "Error: Could not establish connection. Receiving end does not exist.") {
							self.remove_bot(bot_id, `it failed to receive message of type:${message_type} on tab ${this.tabId}. data:`, data, "error:", error);
						}
						return error_message("Failed to send message: "+String(error));
					}
				}
			};
			this.botInstances[bot_id] = botInstance;
			this.LOGGER.debug(`New bot assigned: ${bot_id} on tab ${tabId}`);
		}

		this.trackFocusedTab(tabId);
		return botInstance;
	}

	remove_bot(bot_id: number, ...reason: any[]) {
		this.LOGGER.log("Bot #" + this.botInstances[bot_id]?.bot_id + " removed because ", reason)
		delete this.botInstances[bot_id];
	}

	// @internal only for background
	trackFocusedTab(tabId: number) {
		const existingIndex = this.recentTabIds.indexOf(tabId);
		if (existingIndex !== -1) {
			this.recentTabIds.splice(existingIndex, 1);
		}
		this.recentTabIds.unshift(tabId);
		if (this.recentTabIds.length > 6) {
			this.recentTabIds.splice(6);
		}
	}

	// @internal only for background
	forgetTab(tabId: number) {
		this.recentTabIds = this.recentTabIds.filter(id => id !== tabId);
	}

	// @internal only for background
	set_busy(bot_id: number, is_busy: boolean): BotInstance {
		this.botInstances[bot_id]!.is_busy = is_busy;
		return this.botInstances[bot_id]!;
	}

	async sendMessage(bot_id: number, message_type: MessageType, data: Object, options?: ScriptMessageContext) {
		if (this.LOGGER.from === LogFrom.popup) {
			// pass to background
			return await sendMessage(this.LOGGER, {
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
		return this.botInstances[bot_id]!.sendMessage(message_type, data, options);
	}

	/**
	 * @returns `BotInstance` that is not busy
	 */
	async getBot(id: number): Promise<BotInstance> {
		for (let z = this.botInstances.length -1; z >= 0; z--) {
			const bot = this.botInstances[z]!;
			this.LOGGER.debug("bot", bot);
			
			if (bot.bot_id === id) {
				if (!bot.is_busy) {
					return bot;
				}
				break;			
			}
		}
		throw new Error("No active bot instance found");
	}

	/**
	 * @returns `BotInstance` that is not busy and focused
	 */
	async getBotFocus(): Promise<BotInstance> {
		let focusedTabId: number|null = null;
		try {
			const focusedTabs = await browser.tabs.query({
				active: true,
				lastFocusedWindow: true,
			});
			if(focusedTabs[0]!.id !== undefined) focusedTabId = focusedTabs[0]!.id;
		} catch (error) {
			this.LOGGER.debug("Unable to query focused tab", error);
		}

		if (focusedTabId != null) {
			for (let z = this.botInstances.length -1; z >= 0; z--) {
				const botInstance = this.botInstances[z];
				if (botInstance?.tabId === focusedTabId) {
					if (botInstance.is_busy) {
						throw new Error("Found bot in focused tab:"+focusedTabId+", but it is busy");
					} else {
						return botInstance;
					}
				}
			}
		}

		for (const tabId of this.recentTabIds) {
			const botInstance = this.botInstances.find(b => b?.tabId === tabId && !b.is_busy);
			if (botInstance) {
				return botInstance;
			}
		}

		this.LOGGER.log("ERROR: No active tab bot instance found. focusedTabId:", focusedTabId, "botInstances:", this.botInstances, "recentTabIds:", this.recentTabIds)
		throw new Error("ERROR: No active tab bot instance found");
	}

	/**
	 * send message to a bot that is not busy and focus the current tab
	 */
	async sendMessageFocus(message_type: MessageType, data: Object, options?: ScriptMessageContext) {
		if (this.LOGGER.from === LogFrom.popup) {
			// pass to background
			return await sendMessage(this.LOGGER, {
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
		return bot.sendMessage(message_type, data, options);
	}

	/** Send message to all tabs and frames */
	async sendMessageAll(message_type: MessageType, data: Object) {
		if (this.LOGGER.from !== LogFrom.background) throw new Error("sendMessageAll can only be used from background");

		// LogFrom.background
		const promises = [];
		for (const botInstance of this.botInstances) {
			const tabId = botInstance.tabId;
			const frames = await browser.webNavigation.getAllFrames({ tabId });
			if(frames === null) {
				this.LOGGER.debug("MessageType.ELEMENT_SELECTOR: Unable to get frames for botInstance #"+botInstance.bot_id);
				continue;
			}

			for (const frame of frames) {
				const p = browser.tabs.sendMessage(
					tabId, {
						type: message_type,
						frameId: frame.frameId,
						data,
					}, { frameId: frame.frameId })
					.then((resp: any) => {
						if (resp && resp.success) {
							return resp;
						}
						// treat non-selector replies as rejection so Promise.any will ignore them
						return Promise.reject(resp);
					})
					.catch((err: any) => Promise.reject(err));
				promises.push(p);
			}
		}
		return await Promise.any(promises);
	}
}

/**
 * SharedData abstraction layer - provides type-safe getters/setters
 * All data mutations go through this class for consistency
 */
export class SharedData {
	/** @readonly out of SharedData only read operations are permitted. To write use the applyStateChange() method */
	data: SharedDataInner;
	LOGGER: Logger;
	COMMANDER: BotCommander;

	constructor(LOGGER: Logger, COMMANDER: BotCommander, data: Partial<SharedDataInner> = {}) {
		this.LOGGER = LOGGER;
		this.COMMANDER = COMMANDER;
		this.data = {
			active: data.active ?? DEFAULT_ACTIVE,
			configurator_mode: data.configurator_mode ?? true,
			allow_prompt: data.allow_prompt ?? DEFAULT_ALLOW_PROMPT,
			paste_cleaner_enabled: data.paste_cleaner_enabled ?? DEFAULT_PASTE_CLEANER_ENABLED,
			allow_alert_notify: data.allow_alert_notify ?? DEFAULT_ALLOW_ALERT_NOTIFY,
			notify_sound_enabled: data.notify_sound_enabled ?? DEFAULT_NOTIFY_SOUND_ENABLED,
			notify_sound_source: data.notify_sound_source ?? DEFAULT_NOTIFY_SOUND_SOURCE,
			notify_speaker_device: data.notify_speaker_device ?? DEFAULT_NOTIFY_SPEAKER_DEVICE,
			templates: data.templates ?? [],
			scripts: data.scripts ?? [],
			triggers: data.triggers ?? [],
			button_grids: data.button_grids ?? [],
			button_grid_index: data.button_grid_index ?? -1,
			button_grid_cols: data.button_grid_cols ?? get_default_button_grid_cols(),
			button_grid_min_rows: data.button_grid_min_rows ?? 4,
			datetime_locale: data.datetime_locale ?? DEFAULT_DATETIME_LOCALE,
			persistent_variables: data.persistent_variables ?? {},
		};
	}

	async setTemplate(template: TemplateData): Promise<void> {
		await sendMessage(this.LOGGER, {
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
		await sendMessage(this.LOGGER, {
			type: MessageType.SET_TEMPLATE,
			data: { action: 'delete', templateId }
		});
		this.data.templates = this.data.templates.filter(t => t.id !== templateId);
	}

	async setScript(template: Script) {
		const index = this.data.scripts.findIndex(t => t.id === template.id);
		if (index >= 0) {
			this.data.scripts[index] = template;
		} else {
			this.data.scripts.push(template);
		}
		return await this.applyStateChange({ scripts: this.data.scripts });
	}

	async deleteScript(scriptId: string) {
		return await this.applyStateChange({ scripts: this.data.scripts.filter(t => t.id !== scriptId) });
	}

	/**
	 * apply state changes and pass them on
	 */
	async applyStateChange(update: Partial<SharedDataInner>) {
		Object.assign(this.data, update);
		if (this.COMMANDER.LOGGER.from === LogFrom.popup) {
			// pass to background
			await sendMessage(this.LOGGER, {
				type: MessageType.UPDATE_SHARED_DATA,
				data: update
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
	 * Save shared data to extension storage
	 */
	save() {
		if(this.COMMANDER.LOGGER.from !== LogFrom.background) throw new Error("save() should only be run in background");
		
		storage.setItem(KEY_SHARED_DATA, this.data);
		this.COMMANDER.LOGGER.debug("SharedData persisted to extension storage");
	}

	get_template(id: string) {
		const template = this.data.templates.find((s) => s.id === id);
		if(!template) throw new Error("Template with ID:"+id+" does not exist");
		return template;
	}

	get_script(id: string) {
		const script = this.data.scripts.find((s) => s.id === id);
		if(!script) throw new Error("Script with ID:"+id+" does not exist");
		return script;
	}

	// Get scripts that are hide=false
	get_scripts_list(): Script[] {
		return this.data.scripts.filter((s) => !s.hide);
	}

	get_trigger(id: string) {
		const trigger = this.data.triggers.find((s) => s.id === id);
		if(!trigger) throw new Error("Trigger with ID:"+id+" does not exist");
		return trigger;
	}
}

/** document.querySelector(), but goes also through shadow DOMs */
export function old__querySelector(selector: string, rootNode=document.body): HTMLElement|null {
	// We ignore the "." delimiter for class because some weird websites uses it in id
	const selector_id = selector.split("#")[1]!;
	const elem = document.getElementById(selector_id);
	if(elem) return elem;

    const traverser = (node: HTMLElement): HTMLElement|null => {
        // 1. decline all nodes that are not elements
        if(node.nodeType !== Node.ELEMENT_NODE) {
            return null;
        }
        
        // 2. return the node to the array, if it matches the selector
        if(node.id === selector_id || node.matches(selector)) {
            return node as HTMLElement;
        }
        
        // 3. loop through the children
        const children = node.children
        if (children.length) {
            for(const child of children) {
                const ret = traverser(child as HTMLElement);
				if (ret !== null) return ret;
            }
        }
        
        // 4. check for shadow DOM, and loop through it's children
        const shadowRoot = node.shadowRoot
        if (shadowRoot) {
            const shadowChildren = shadowRoot.children
            for(const shadowChild of shadowChildren) {
                const ret = traverser(shadowChild as HTMLElement);
				if (ret !== null) return ret;
            }
        }
		return null;
    }
    
	return traverser(rootNode);
}

/** document.querySelector(), but also goes through shadow DOMs and slots */
export function querySelector(selector: string, rootNode: ParentNode = document.body): HTMLElement | null {
    const selectors = selector.split("|").map((value) => value.trim());
    const visited = new Set<Element>();

	for (const alt of selectors) {
		const result = __querySelector(alt, visited, rootNode);
		if (result) return result;
	}
	return null;
}
function __querySelector(selector: string, visited: Set<Element>, rootNode: ParentNode = document.body): HTMLElement | null {
    // We ignore the "." delimiter for class because some weird websites use it in IDs.
    const selector_id = selector.split("#")[1];
    const elem = selector_id ? document.getElementById(selector_id) : null;
    if (elem) return elem;

    const traverser = (node: Element): HTMLElement | null => {
        if (visited.has(node)) return null;
        visited.add(node);

        if (node.id === selector_id || node.matches(selector)) {
            return node as HTMLElement;
        }

        // Traverse slotted content.
        if (node instanceof HTMLSlotElement) {
            for (const assigned of node.assignedElements({ flatten: true })) {
                const ret = traverser(assigned);
                if (ret) return ret;
            }
        }

        // Traverse light DOM.
        for (const child of node.children) {
            const ret = traverser(child);
            if (ret) return ret;
        }

        // Traverse shadow DOM.
        if (node.shadowRoot) {
            for (const child of node.shadowRoot.children) {
                const ret = traverser(child);
                if (ret) return ret;
            }
        }

        return null;
    };

    if (rootNode instanceof Element) {
        return traverser(rootNode);
    }

    for (const child of rootNode.children) {
        const ret = traverser(child);
        if (ret) return ret;
    }

    return null;
}

/** document.querySelectorAll(), but also traverses shadow DOMs and slots */
export function querySelectorAll(selector: string, rootNode: ParentNode = document.body) {
    const selectors = selector.split("|").map((value) => value.trim());
    const visited = new Set<Element>();
	const elements: HTMLElement[] = [];
	for (const alt of selectors) {
		for (const element of __querySelectorAll(alt, visited, rootNode)) {
			elements.push(element);
		}
	}
	return elements;
}
function __querySelectorAll(selector: string, visited: Set<Element>, rootNode: ParentNode = document.body) {
    // We ignore the "." delimiter for class because some weird websites use it in ids.
    const selector_id = selector.split("#")[1];
    const arr: HTMLElement[] = [];

    const traverser = (node: Element) => {
        if (visited.has(node)) return;
        visited.add(node);

        // Add matching node
        if (node.id === selector_id || node.matches(selector)) {
            arr.push(node as HTMLElement);
        }

        // Traverse slotted content first to avoid re-entering the same nodes later.
        if (node instanceof HTMLSlotElement) {
            for (const assigned of node.assignedElements({ flatten: true })) {
                traverser(assigned);
            }
        }

        // Traverse light DOM.
        for (const child of node.children) {
            traverser(child);
        }

        // Traverse shadow DOM.
        if (node.shadowRoot) {
            for (const child of node.shadowRoot.children) {
                traverser(child);
            }
        }
    };

    if (rootNode instanceof Element) {
        traverser(rootNode);
    } else {
        for (const child of rootNode.children) {
            traverser(child);
        }
    }

    return arr;
}

/** returns Node[] with document and all shadowRoots childreen */
export function getAllNodeRoots(rootNode: ParentNode = document.body) {
    const arr: HTMLElement[] = [document as any];
    const visited = new Set<Element>();

    const traverser = (node: Element, is_container: boolean) => {
        if (visited.has(node)) return;
        visited.add(node);
		if(is_container) arr.push(node as HTMLElement);

        // Traverse light DOM.
        for (const child of node.children) {
            traverser(child, false);
        }

        // Traverse shadow DOM.
        if (node.shadowRoot) {
            for (const child of node.shadowRoot.children) {
                traverser(child, true);
            }
        }
    };

    if (rootNode instanceof Element) {
        traverser(rootNode, false);
    } else {
        for (const child of rootNode.children) {
            traverser(child, false);
        }
    }

    return arr;
}


/** Pads a number by 2 digits */
function pad2(n: number) {
	return n.toString().padStart(2, '0');
}

/** Converts a Date to ISO 8601 string format 'YYYY-MM-DD hh:mm:ss' */
export function dateToISOString(date: Date): string {
	const year = date.getFullYear();
	const month = pad2(date.getMonth() + 1);
	const day = pad2(date.getDate());
	const hours = pad2(date.getHours());
	const minutes = pad2(date.getMinutes());
	const seconds = pad2(date.getSeconds());
	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/** Converts a Date to locale string format like de_DE 'dd.MM.yyyy HH:mm:ss'. Defaults to ISO 8601 */
export function dateToLocaleString(date: Date, locale: string): string {
	switch (locale) {
		case "de_DE": { // dd.MM.yyyy HH:mm:ss
			const year = date.getFullYear();
			const month = pad2(date.getMonth() + 1);
			const day = pad2(date.getDate());
			const hours = pad2(date.getHours());
			const minutes = pad2(date.getMinutes());
			const seconds = pad2(date.getSeconds());
			return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
		}
	
		case "en_US": { // MM/dd/yyyy HH:mm:ss
			const year = date.getFullYear();
			const month = pad2(date.getMonth() + 1);
			const day = pad2(date.getDate());
			const hours = pad2(date.getHours());
			const minutes = pad2(date.getMinutes());
			const seconds = pad2(date.getSeconds());
			return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
		}
	
		default: return dateToISOString(date);
	}
}

/** Pauses execution for the specified number of milliseconds */
export async function sleep(milisecs: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milisecs));
}

export function is_numeric_char(text: string, index: number): boolean {
	const code = text.charCodeAt(index);
	return code >= 102 && code <= 111;
}