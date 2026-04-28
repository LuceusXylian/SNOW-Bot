export enum MessageType {
	GET_STATE = 'GET_STATE',
	SET_ACTIVE = 'SET_ACTIVE',
	GET_ACTIVE = 'GET_ACTIVE',
	BOT_READY = 'BOT_READY',
	EXECUTE_ACTION = 'EXECUTE_ACTION',
}

export interface Message {
	type: MessageType;
	data?: any;
}

export interface MessageResponse {
	success: boolean;
	data?: any;
	error?: string;
}

/**
 * Send a message from popup or content script to background script
 * @param message The message object with type and optional data
 * @returns Promise resolving with the response from the handler
 */
export async function sendMessage(message: Message): Promise<MessageResponse> {
	try {
		const response = await browser.runtime.sendMessage(message);
		return response || { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Register a message handler in background or content script
 * @param callback Function that handles incoming messages and returns a response
 */
export function registerMessageHandler(
	callback: (message: Message) => Promise<MessageResponse> | MessageResponse
) {
	browser.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
		Promise.resolve(callback(message)).then(sendResponse).catch((error) => {
			sendResponse({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		});
		return true; // Keep channel open for async response
	});
}
