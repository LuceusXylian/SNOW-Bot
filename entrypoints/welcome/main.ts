import { SharedData, Logger, LogFrom, BotCommander } from '@/components/basics';
import { get_shared_data } from '@/components/client';
import { load_file_to_string } from '@/components/ui';
import { IS_POPUP_QUERY_STRING } from '@/components/constants';

const LOGGER = new Logger(LogFrom.popup);
LOGGER.debug("Welcome page started");

const importBtn = document.getElementById("import-btn")!;
const importInput = document.getElementById("import-input") as HTMLInputElement;
const skipBtn = document.getElementById("skip-btn")!;
const statusDiv = document.getElementById("status")!;

function redirectToSettings() {
	const base = browser.runtime.getURL("/popup.html");
	location.href = base + "?" + IS_POPUP_QUERY_STRING + "#settings";
}

skipBtn.addEventListener("click", () => {
	redirectToSettings();
});

(async () => {
	try {
		const COMMANDER = new BotCommander(LOGGER);
		const shared = await get_shared_data(LOGGER, COMMANDER, 1000);

		importBtn.addEventListener("click", () => {
			importInput.click();
		});

		importInput.addEventListener("change", async (event) => {
			const target = event.target as HTMLInputElement;
			const files = target.files;
			if (!files || files.length === 0) return;

			try {
				const fileContent = await load_file_to_string(files[0]!);
				const imported = JSON.parse(fileContent);
				await shared.applyStateChange(imported);
				LOGGER.debug("Settings imported successfully", imported);
				statusDiv.textContent = "Configuration imported successfully!";
				redirectToSettings();
			} catch (error) {
				LOGGER.log("Failed to import settings", error);
				statusDiv.textContent = "Failed to import configuration. Please check the file format.";
			} finally {
				importInput.value = '';
			}
		});
	} catch (error) {
		LOGGER.log("Failed to initialize welcome page", error);
		statusDiv.textContent = "Failed to connect to background. Please try again.";
	}
})();
