import { BotCommander, Logger, SharedData } from "@/components/basics";


export async function get_shared_data(LOGGER: Logger, COMMANDER: BotCommander): Promise<SharedData> {
	try {
		const response = await sendMessage(LOGGER, { type: MessageType.GET_STATE });
	
		if (!response.success || !response.data) {
			LOGGER.log("Failed to get state from background", response);
			throw new Error("Failed to get state from background", {cause: response });
		}
	
		return new SharedData(LOGGER, COMMANDER, response.data);
	} catch (error) {
		// probebly connection error because background is not ready yet, so we try again in 10 seconds
		return await new Promise(resolve => setTimeout(async () => {
			resolve(await get_shared_data(LOGGER, COMMANDER));
		}, 10000))
	}
}