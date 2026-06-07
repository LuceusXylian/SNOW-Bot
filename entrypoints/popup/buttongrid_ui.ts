import { create_element, create_text_element, create_modal } from '@/components/ui';


export function buttongrid_ui(shared: SharedData, LOGGER: Logger, COMMANDER: BotCommander, buttongrid_container: HTMLElement) {
	buttongrid_container.innerHTML = "";
	let button_edit_mode = false;

	const options: { value: string, title: string }[] = [
		{ value: "new", title: "--- Create new Button Grid ---" }, 
		{ value: "-1", title: "All Scripts" }
	];
	for (let index = 0; index < shared.data.button_grids.length; index++) {
		const grid = shared.data.button_grids[index];
		console.log("gridgridgrid", grid);
		
		options.push({ value: index.toString(), title: grid.title });
	}
	const buttongrid_select = create_formcontrol(buttongrid_container, "select", "buttongrid_select", "Profile", {options: options, value: shared.data.button_grid_index });
	buttongrid_select.parentElement!.style = "margin: 0 6px 0 0; display: inline-block; vertical-align: top; width: calc(100% - 50px - 6px);";
	const edit_mode_toggler_text = "Edit";
	const edit_mode_toggler = create_text_element(buttongrid_container, "button", edit_mode_toggler_text, { class: "fc fc-small" });
	edit_mode_toggler.style.cssText = "display: inline-block; vertical-align: top; width: 50px; line-height: 1.1; height: "+buttongrid_select.parentElement!.clientHeight+"px";
	edit_mode_toggler.addEventListener("click", () => {
		button_edit_mode = !button_edit_mode;
		if (button_edit_mode) {
			edit_mode_toggler.innerText = edit_mode_toggler_text + " (active)";
		} else {
			edit_mode_toggler.innerText = edit_mode_toggler_text;
		}
	});
	const buttons_container = create_element(buttongrid_container, "div", { style:"margin-top: 20px;" });

	const create_buttons = async () => {
		if (buttongrid_select.value === "new") {
			try {
				const result = await create_modal((container) => {
					create_formcontrol(container, "text", "title", "ButtonGrid title", { autocomplete_off: true }).focus();
				});
				
				const new_buttons: ButtonGridButton[] = [];
				for (let a = 0; a < 16; a++) {
					new_buttons.push({ text: "", script_id: null })
				}
				shared.data.button_grids.push({ title: result.title, buttons: new_buttons });
				shared.applyStateChange({
					button_grids: shared.data.button_grids,
					button_grid_index: shared.data.button_grids.length -1,
				})
	
				buttongrid_ui(shared, LOGGER, COMMANDER, buttongrid_container);
			} catch (error) {
				console.error(error);
				buttongrid_select.value = shared.data.button_grid_index.toString();
			}
			return;
		}

		const button_grid_index = parseInt(buttongrid_select.value);
		shared.applyStateChange({ button_grid_index: button_grid_index });
		buttons_container.innerHTML = "";

		if (button_grid_index === -1) {
			// Get all scripts as buttons
			for (let b = 0; b < shared.data.scripts.length; b++) {
				const script = shared.data.scripts[b];
				const button = create_text_element(buttons_container, "button", script.name, { class: "fc fc-margin fc-container-4" });
				button.addEventListener("click", () => {
					sendMessage(LOGGER, { type: MessageType.EXECUTE_SCRIPT, data: {
						script_id: script.id
					}});
				});
			}
		} else {
			// Custom Grid
			const grid = shared.data.button_grids[button_grid_index];
			
			for (let b = 0; b < grid.buttons.length; b++) {
				const index = b;
				const entry = grid.buttons[b];
				const button = create_text_element(buttons_container, "button", entry.text, { class: "fc fc-margin fc-container-4" });
				button.addEventListener("click", async () => {
					if (button_edit_mode) {
						// start modal to prompt for ButtonGrid title and Script
						const result = await create_modal((container) => {
							create_formcontrol(container, "text", "text", "Button text", { value: entry.text });
							const script_options: { value: string, title: string }[] = [];
							for (const script of shared.data.scripts) {
								script_options.push({ value: script.id.toString(), title: script.name });
							}
							create_formcontrol(container, "select", "script_id", "Script", { value: entry.script_id?.toString()??"", options: script_options });
						});
						shared.data.button_grids[button_grid_index].buttons[index].text = result.text;
						shared.data.button_grids[button_grid_index].buttons[index].script_id = result.script_id;
						await shared.applyStateChange({ button_grids: shared.data.button_grids });
						buttongrid_ui(shared, LOGGER, COMMANDER, buttongrid_container);
					} else if(entry.script_id !== null) {
						sendMessage(LOGGER, { type: MessageType.EXECUTE_SCRIPT, data: {
							script_id: entry.script_id
						}});
					}
				});
			}
		}
	};
	buttongrid_select.addEventListener("change", create_buttons);
	create_buttons();
}