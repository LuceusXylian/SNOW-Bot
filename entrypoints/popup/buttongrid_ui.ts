import { create_element, create_text_element, create_modal } from '@/components/ui';


let button_edit_mode = false;
export function buttongrid_ui(shared: SharedData, LOGGER: Logger, COMMANDER: BotCommander, buttongrid_container: HTMLElement) {
	buttongrid_container.innerHTML = "";

	const options: { value: string, title: string }[] = [
		{ value: "new", title: "--- Create new Button Grid ---" }, 
		{ value: "-1", title: "All Scripts" }
	];
	for (let index = 0; index < shared.data.button_grids.length; index++) {
		const grid = shared.data.button_grids[index];
		options.push({ value: index.toString(), title: grid.title });
	}

	const buttongrid_select = create_formcontrol(buttongrid_container, "select", "buttongrid_select", "Profile", {options: options, value: shared.data.button_grid_index.toString() });
	buttongrid_select.parentElement!.style = "margin: 0 6px 0 0; display: inline-block; vertical-align: top; width: calc(100% - 50px - 6px);";
	const edit_mode_toggler_text = "Edit";
	const edit_mode_toggler = create_text_element(buttongrid_container, "button", edit_mode_toggler_text, { class: "fc fc-small" });
	edit_mode_toggler.style.cssText = "display: inline-block; vertical-align: top; width: 50px; line-height: 1.1; height: "+buttongrid_select.parentElement!.clientHeight+"px";
	const button_grid_cols_fc = create_formcontrol(buttongrid_container, "number", "button_grid_cols", "Count of Columns", { value: shared.data.button_grid_cols.toString(), class: "fc-col" });
	button_grid_cols_fc.parentElement!.style = "display: inline-block; width: 120px;";
	const button_grid_rows_fc = create_formcontrol(buttongrid_container, "number", "button_grid_rows", "Minimum of Rows", { value: shared.data.button_grid_min_rows.toString(), class: "fc-col" });
	button_grid_rows_fc.parentElement!.style = "display: inline-block; width: 120px;";

	const set_text_mode_toggler = () => {
		if (button_edit_mode) {
			edit_mode_toggler.innerText = edit_mode_toggler_text + " (active)";
		} else {
			edit_mode_toggler.innerText = edit_mode_toggler_text;
		}
		button_grid_cols_fc.parentElement!.style.display = button_edit_mode? "" : "none";
		button_grid_rows_fc.parentElement!.style.display = button_edit_mode && buttongrid_select.value !== "-1"? "" : "none";
	};
	set_text_mode_toggler();
	edit_mode_toggler.addEventListener("click", () => {
		button_edit_mode = !button_edit_mode;
		set_text_mode_toggler();
	});

	const buttons_container = create_element(buttongrid_container, "div", { class: "button_grid", style:"margin-top: 20px;" });
	const create_buttons = async () => {
		if (buttongrid_select.value === "new") {
			try {
				const result = await create_modal((container) => {
					create_formcontrol(container, "text", "title", "ButtonGrid title", { autocomplete_off: true }).focus();
				});
				
				shared.data.button_grids.push({ title: result.title, buttons: [] });
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

		let button_grid_index = parseInt(buttongrid_select.value);
		if(Number.isNaN(button_grid_index)) button_grid_index = -1;
		buttons_container.innerHTML = "";
		const cols = Math.min(Math.max(parseInt(button_grid_cols_fc.value) || 1, 1), 10);
		button_grid_cols_fc.value = cols.toString();
		const rows = Math.min(Math.max(parseInt(button_grid_rows_fc.value) || 1, 1), 100);
		button_grid_rows_fc.value = rows.toString();
		shared.applyStateChange({ button_grid_index: button_grid_index, button_grid_cols: cols, button_grid_min_rows: rows });
		const fc_container_style = "width: calc("+(100/cols)+"% - .4rem * 2)";

		if (button_grid_index === -1) {
			// Get all scripts as buttons
			for (let b = 0; b < shared.data.scripts.length; b++) {
				const script = shared.data.scripts[b];
				const button = create_text_element(buttons_container, "button", button_text(script.name), { class: "fc fc-margin bgrid_button", style: fc_container_style });
				button.addEventListener("click", () => {
					sendMessage(LOGGER, { type: MessageType.EXECUTE_SCRIPT, data: {
						script_id: script.id
					}});
				});
			}
		} else {
			// Custom Grid
			const grid = shared.data.button_grids[button_grid_index];
			
			for (let b = 0; b < cols*rows; b++) {
				const index = b;
				const entry = grid.buttons[b];
				const text = entry?.text? button_text(entry.text) : "";
				const button = create_text_element(buttons_container, "button", text, { class: "fc fc-margin bgrid_button", style: fc_container_style });
				button.addEventListener("click", async () => {
					if (button_edit_mode) {
						// start modal to prompt for ButtonGrid title and Script
						const result = await create_modal((container) => {
							create_formcontrol(container, "text", "text", "Button text", { value: text });
							const script_options: { value: string, title: string }[] = [];
							for (const script of shared.data.scripts) {
								script_options.push({ value: script.id.toString(), title: script.name });
							}
							create_formcontrol(container, "select", "script_id", "Script", { value: entry.script_id?.toString()??"", options: script_options });
						});

						if (result.text === "") {
							const script = shared.get_script(result.script_id);
							shared.data.button_grids[button_grid_index].buttons[index].text = script.name;
						} else {
							shared.data.button_grids[button_grid_index].buttons[index].text = result.text;
						}
						shared.data.button_grids[button_grid_index].buttons[index].script_id = result.script_id;
						await shared.applyStateChange({ button_grids: shared.data.button_grids });
						buttongrid_ui(shared, LOGGER, COMMANDER, buttongrid_container);
					} else if(entry && entry.script_id !== null) {
						sendMessage(LOGGER, { type: MessageType.EXECUTE_SCRIPT, data: {
							script_id: entry.script_id
						}});
					}
				});
			}
		}
	};
	buttongrid_select.addEventListener("change", () => {
		set_text_mode_toggler();
		create_buttons();
	});
	button_grid_cols_fc.addEventListener("change", create_buttons);
	button_grid_cols_fc.addEventListener("keyup", create_buttons);
	button_grid_rows_fc.addEventListener("change", create_buttons);
	button_grid_rows_fc.addEventListener("keyup", create_buttons);
	create_buttons();
}

function button_text(text: string) {
	return text.split("_").join(" ");
}