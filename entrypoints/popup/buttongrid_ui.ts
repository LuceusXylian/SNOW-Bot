import { create_element, create_text_element, create_modal, FadingChatModal } from '@/components/ui';


let button_edit_mode = false;
export function buttongrid_ui(shared: SharedData, LOGGER: Logger, COMMANDER: BotCommander, buttongrid_container: HTMLElement) {
	buttongrid_container.innerHTML = "";
	const SESSION_ID: number = new Date().getTime();
	const fading_chat_modal = new FadingChatModal();

	const options: { value: string, title: string }[] = [
		{ value: "new", title: "--- Create new Button Grid ---" }, 
		{ value: "-1", title: "All Scripts" }
	];
	for (let index = 0; index < shared.data.button_grids.length; index++) {
		const grid = shared.data.button_grids[index]!;
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
				
				shared.data.button_grids.push({ title: result.title!, buttons: [] });
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
			const scripts = shared.get_scripts_list();
			for (let b = 0; b < scripts.length; b++) {
				const script = scripts[b]!;
				const button = create_text_element(buttons_container, "button", button_text(script.name), { class: "fc fc-margin bgrid_button", style: fc_container_style });
				button.addEventListener("click", async () => {
					execute_script_bgrid(script);
				});
			}
		} else {
			// Custom Grid
			const grid = shared.data.button_grids[button_grid_index]!;
			
			for (let b = 0; b < cols*rows; b++) {
				const index = b;
				const entry = grid.buttons[b]!;
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

						const button_grid_button = shared.data.button_grids[button_grid_index]!.buttons[index]!;
						if (result.text === "") {
							const script = shared.get_script(result.script_id!);
							button_grid_button.text = script.name;
						} else {
							button_grid_button.text = result.text!;
						}
						button_grid_button.script_id = result.script_id!;
						await shared.applyStateChange({ button_grids: shared.data.button_grids });
						buttongrid_ui(shared, LOGGER, COMMANDER, buttongrid_container);
					} else if(entry && entry.script_id !== null) {
						const script = shared.get_script(entry.script_id);
						execute_script_bgrid(script);
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

	
	async function execute_script_bgrid(script: Script) {
		fading_chat_modal.fadeIn();
		const response = await execute_script(LOGGER, SESSION_ID, script.id);
		// show fading modal with command bubble
		try {
			if (!response.success) {
				fading_chat_modal.append_chat_bubble("error", "Response", response.error ?? `Failed to execute ${script.name}`, script.id);
			}
			fading_chat_modal.fadeOut();
		} catch (err) {
			console.error("show_fading_chat_modal failed", err);
		}
	}

	registerMessageHandler(async (message) => {
		if (message.type === MessageType.PROGRESS_REPORT) {
			if (message.data && message.data.session_id === SESSION_ID && message.data.message) {
				console.log("message.data", message.data);
				fading_chat_modal.set_chat_bubble(message.data.kind, message.data.kind, message.data.message, String(message.data.meta ?? ""));
			}
		}
		return { success: true };
	});
}

function button_text(text: string) {
	return text.split("_").join(" ");
}