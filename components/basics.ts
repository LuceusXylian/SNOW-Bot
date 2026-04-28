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

export interface SharedDataInner {
	//** if false, it acts as a kill switch and stops any proccesses in "content.ts" */
	active: boolean,
}

/**
 * SharedData abstraction layer - provides type-safe getters/setters
 * All data mutations go through this class for consistency
 */
export class SharedData {
	private data: SharedDataInner;

	constructor(data: Partial<SharedDataInner> = {}) {
		this.data = {
			active: data.active ?? DEFAULT_ACTIVE,
		};
	}

	// Getters
	getActive(): boolean {
		return this.data.active;
	}

	// Setters
	async setActive(active: boolean): Promise<void> {
		await sendMessage({
			type: MessageType.SET_ACTIVE,
			data: { active }
		});
		this.data.active = active;
	}

	/**
	 * Internal method used by background to apply state changes without sending messages
	 * @internal
	 */
	_applyStateChange(update: Partial<SharedDataInner>): void {
		Object.assign(this.data, update);
	}

	// Serialization
	export(): SharedDataInner {
		return this.data;
	}
}