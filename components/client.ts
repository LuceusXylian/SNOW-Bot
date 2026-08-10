import { BotCommander, Logger, SharedData } from "@/components/basics";


export async function get_shared_data(LOGGER: Logger, COMMANDER: BotCommander, retry_in: number): Promise<SharedData> {
	try {
		const response = await sendMessage(LOGGER, { type: MessageType.GET_STATE });
	
		if (!response.success || !response.data) {
			LOGGER.log("Failed to get state from background", response);
			throw new Error("Failed to get state from background", {cause: response });
		}
	
		return new SharedData(LOGGER, COMMANDER, JSON.parse(response.data as string));
	} catch (error) {
		// probebly connection error because background is not ready yet, so we try again later
		return await new Promise(resolve => setTimeout(async () => {
			resolve(await get_shared_data(LOGGER, COMMANDER, retry_in));
		}, retry_in))
	}
}

export async function play_audio(source: string | ArrayBuffer, speaker_device: string) {
	console.log("play_audio source", source);

	const ctx = new AudioContext();
	if (ctx.state === 'suspended') {
		await ctx.resume();
	}
	if (speaker_device && speaker_device !== "default" && (ctx as any).setSinkId) {
		try { await (ctx as any).setSinkId(speaker_device); } catch {}
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
		osc.stop(ctx.currentTime + 0.15);
	} else if (source) {
		const arrayBuffer = source as ArrayBuffer;

		const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
		const bufSource = ctx.createBufferSource();
		bufSource.buffer = audioBuffer;
		bufSource.connect(ctx.destination);
		bufSource.start();
	}
}