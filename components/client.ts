import { Logger, SharedData } from "@/components/basics";


export async function get_shared_data(LOGGER: Logger): Promise<SharedData> {
	try {
		const response = await sendMessage({ type: MessageType.GET_STATE });
	
		if (!response.success || !response.data) {
			LOGGER.debug("Failed to get state from background", response);
			throw new Error("Failed to get state from background", {cause: response });
		}
	
		return new SharedData(response.data);
	} catch (error) {
		// probebly connection error because background is not ready yet, so we try again in 10 seconds
		return await new Promise(resolve => setTimeout(async () => {
			resolve(await get_shared_data(LOGGER));
		}, 10000))
	}
}