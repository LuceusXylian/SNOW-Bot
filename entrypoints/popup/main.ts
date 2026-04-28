import { SharedData, LogFrom, Logger } from '@/components/basics';
import { sendMessage, MessageType } from '@/components/messaging';
import { get_shared_data } from '@/components/client';

const LOGGER = new Logger(LogFrom.popup);
LOGGER.debug("Popup started");

// Fetch state from background and initialize UI
(async () => {
	try {
		const shared = await get_shared_data(LOGGER);
		init(shared);
	} catch (error) {
		LOGGER.debug("Failed to initialize popup", error);
	}
})();

function init(shared: SharedData) {
	// Active Toggler
	const active_toggler = document.getElementById("active-toggler")!;

	function set_active_toggler_state(_active: boolean) {
		if (_active) {
			active_toggler.classList.add("active");
			active_toggler.title = "Bot is running";
		} else {
			active_toggler.classList.remove("active");
			active_toggler.title = "Bot is disabled";
		}

		LOGGER.debug(shared)
	}

	// Set initial state
	set_active_toggler_state(shared.getActive());

	active_toggler.addEventListener("click", async () => {
		await shared.setActive(!shared.getActive());
		set_active_toggler_state(shared.getActive());
	});


	// Menu
	const header = document.getElementById("header")!;
	const controller_goback = document.getElementById("controller-goback")!;
	const menu = document.getElementById("menu")!;
	const menu_items = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName("menu-item");
	var menu_item_selected: HTMLDivElement | null = null;

	for (let i = 0; i < menu_items.length; i++) {
		const item = menu_items[i];
		item.addEventListener("click", () => {
			if (menu_item_selected === null) {
				menu.classList.add("deeper");
				item.classList.add("selected");
				header.classList.remove("goback-hidden");
				menu_item_selected = item;
			}
		});
	}


	controller_goback.addEventListener("click", () => {
		if (menu_item_selected !== null) {
			menu.classList.remove("deeper");
			menu_item_selected.classList.remove("selected");
			header.classList.add("goback-hidden");
			menu_item_selected = null;
		}
	});


	// Serialnumbers
	const serialnumbers_textarea = document.getElementById("serialnumbers-textarea") as HTMLTextAreaElement;
	const serialnumbers_submit = document.getElementById("serialnumbers-submit")!;

	serialnumbers_submit.addEventListener("click", async () => {
		// Send command to background to execute mass action on serial numbers
		const serialnumbers = serialnumbers_textarea.value.trim().split('\n').filter((s: string) => s);
		const response = await sendMessage({
			type: MessageType.EXECUTE_ACTION,
			data: {
				action: 'mass_hardware_actions',
				serialnumbers,
			}
		});

		if (response.success) {
			LOGGER.debug("Mass action command sent", response);
		} else {
			LOGGER.debug("Failed to send mass action command", response);
		}
	});
}