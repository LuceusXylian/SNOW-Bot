import type { Logger, ScriptMessageContext } from "@/components/basics";

export enum MessageType {
	GET_STATE = 'GET_STATE',
	BOT_READY = 'BOT_READY',
	UPDATE_SHARED_DATA = 'UPDATE_SHARED_DATA',
	RELAY_COMMAND = 'RELAY_COMMAND',
	GET_BOT_ID = 'GET_BOT_ID',
	SET_TEMPLATE = 'SET_TEMPLATE',
	INSERT_TEMPLATE = 'INSERT_TEMPLATE',
	SET_ELEMENT_ATTRIBUTE = "SET_ELEMENT_ATTRIBUTE",
	GET_ELEMENT_ATTRIBUTE = "GET_ELEMENT_ATTRIBUTE",
	TRIGGER_ELEMENT_EVENT = "TRIGGER_ELEMENT_EVENT",
	GET_LOGS = 'GET_LOGS',
	SAVE_LOG = 'SAVE_LOG',
	EXECUTE_SCRIPT = "EXECUTE_SCRIPT",
	PROGRESS_REPORT = "PROGRESS_REPORT",
	CHECK_CONDITIONS = "CHECK_CONDITIONS",
	TRIGGER_FIRED = "TRIGGER_FIRED",
	ELEMENT_SELECTOR = "ELEMENT_SELECTOR",
	ALERT = "ALERT",
	PLAY_AUDIO = "PLAY_AUDIO",
	CLEAR_FOREACH_CACHE = "CLEAR_FOREACH_CACHE",
}

export interface Message {
	type: MessageType;
	data?: any;
	script_context?: ScriptMessageContext;
}

export interface MessageResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Send a message from popup or content script to background script
 * @param message The message object with type and optional data
 * @returns Promise resolving with the response from the handler
 */
export async function sendMessage<T>(LOGGER: Logger, message: Message): Promise<MessageResponse<T>> {
	LOGGER.debug(message);
	try {
		const response = await browser.runtime.sendMessage(message);
		return response || { success: true };
	} catch (error) {
		LOGGER.log(error);
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
			}),
		]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
}

/**
 * Register a message handler in background or content script
 * @param callback Function that handles incoming messages and returns a response
 */
export function registerMessageHandler<T>(
	callback: (message: Message, sender?: any) => Promise<MessageResponse<T>> | MessageResponse<T>
) {
	// @ts-ignore noImplicitAny
	browser.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
		Promise.resolve(callback(message, sender)).then(sendResponse).catch((error) => {
			sendResponse({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		});
		return true; // Keep channel open for async response
	});
}
