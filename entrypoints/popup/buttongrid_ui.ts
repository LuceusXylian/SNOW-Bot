import { create_element, create_text_element, create_modal, FadingChatModal, create_formcontrol } from '@/components/ui';
import type { FunctionArgument } from '@/components/scripting';
import type { SharedData } from '@/components/basics';


let button_edit_mode = false;
export class ProfileSelector {
	profile_select: HTMLSelectElement;
	shared: SharedData;
	bg_mode: boolean;
	constructor(shared: SharedData, parent: HTMLElement, bg_mode: boolean) {
		this.shared = shared;
		this.bg_mode = bg_mode;
		
		const value = bg_mode || (shared.data.button_grid_index && shared.data.button_grid_index !== -1)? shared.data.button_grid_index : 0;
		this.profile_select = create_formcontrol(parent, "select", "buttongrid_select", "Profile", {empty_is_value: true });
		this.render_options();
		this.profile_select.value = value.toString();
		this.profile_select.parentElement!.style = "margin: 0 6px 0 0; display: inline-block; vertical-align: top; width: calc(100% - 50px - 6px); min-width: 100px;";
	}

	push_option(value: string, title: string) {
		const option = document.createElement("option");
		option.value = value;
		option.innerText = title;
		this.profile_select.append(option);
	}

	render_options() {
		this.profile_select.innerHTML = "";
		let options: { value: string, title: string }[];
		if(this.bg_mode) {
			this.push_option("new", "--- Create new Button Grid ---");
			this.push_option("-1", "All Scripts");
		} else {
			this.push_option("new", "--- Create new Profile ---");
		}
		console.log("shared.data.button_grids", this.shared.data.button_grids);
		
		for (let index = 0; index < this.shared.data.button_grids.length; index++) {
			const grid = this.shared.data.button_grids[index]!;
			this.push_option(index.toString(), grid.title);
		}
	}

	async profile_select_onchange(shared: SharedData, onAdded: (index: number)=>void, onChange: (index: number)=>void) {
		if (this.profile_select.value === "new") {
			try {
				const result = await create_modal((container) => {
					create_formcontrol(container, "text", "title", "ButtonGrid title", { autocomplete_off: true }).focus();
				});
				
				const index = shared.data.button_grids.push({ title: result.title!, buttons: [] }) - 1;
				console.log("profile_select_onchange new index", index)
				shared.applyStateChange({
					button_grids: shared.data.button_grids,
					button_grid_index: index,
				})
				this.render_options();
				this.profile_select.value = index.toString();
				onAdded(index);
			} catch (error) {
				console.error(error);
				this.profile_select.value = shared.data.button_grid_index.toString();
			}
			return;
		}
	
		let index = parseInt(this.profile_select.value);
		if(Number.isNaN(index)) index = -1;
		onChange(index);
	}
}

export function buttongrid_ui(shared: SharedData, LOGGER: Logger, COMMANDER: BotCommander, buttongrid_container: HTMLElement) {
	buttongrid_container.innerHTML = "";
	const SESSION_ID: number = new Date().getTime();
	const fading_chat_modal = new FadingChatModal(LOGGER, SESSION_ID);

	const options: { value: string, title: string }[] = [
		{ value: "new", title: "--- Create new Button Grid ---" }, 
		{ value: "-1", title: "All Scripts" }
	];
	for (let index = 0; index < shared.data.button_grids.length; index++) {
		const grid = shared.data.button_grids[index]!;
		options.push({ value: index.toString(), title: grid.title });
	}

	const buttongrid_select = new ProfileSelector(shared, buttongrid_container, true);
	const edit_mode_toggler_text = "Edit";
	const edit_mode_toggler = create_text_element(buttongrid_container, "button", edit_mode_toggler_text, { class: "fc fc-small" });
	edit_mode_toggler.style.cssText = "display: inline-block; vertical-align: top; width: 50px; line-height: 1.1; height: "+buttongrid_select.profile_select.parentElement!.clientHeight+"px";
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
		button_grid_rows_fc.parentElement!.style.display = button_edit_mode && buttongrid_select.profile_select.value !== "-1"? "" : "none";
	};
	set_text_mode_toggler();
	edit_mode_toggler.addEventListener("click", () => {
		button_edit_mode = !button_edit_mode;
		set_text_mode_toggler();
	});

	const buttons_container = create_element(buttongrid_container, "div", { class: "button_grid", style:"margin-top: 20px;" });
	const create_buttons = async () => {
		buttongrid_select.profile_select_onchange(shared, (index) => {
			// onAdded
			shared.applyStateChange({
				button_grids: shared.data.button_grids,
				button_grid_index: shared.data.button_grids.length -1,
			});

			buttongrid_ui(shared, LOGGER, COMMANDER, buttongrid_container);
		}, (button_grid_index) => {
			// onChange
			buttons_container.innerHTML = "";
			const cols = Math.min(Math.max(parseInt(button_grid_cols_fc.value) || 1, 1), 10);
			button_grid_cols_fc.value = cols.toString();
			const rows = Math.min(Math.max(parseInt(button_grid_rows_fc.value) || 1, 1), 100);
			button_grid_rows_fc.value = rows.toString();
			shared.applyStateChange({
				button_grid_index: button_grid_index,
				button_grid_cols: cols,
				button_grid_min_rows: rows,
				predefined_profile_vars: shared.data.predefined_profile_vars,
				persistent_variables: shared.buildPersistentVariables(button_grid_index),
			});
			const fc_container_style = "width: calc("+(100/cols)+"% - .4rem * 2)";
	
			if (button_grid_index === -1) {
				// Get all scripts as buttons
				const scripts = shared.get_scripts_list();
				for (let b = 0; b < scripts.length; b++) {
					const script = scripts[b]!;
					const button = create_text_element(buttons_container, "button", button_text(script.name), { class: "fc fc-margin bgrid_button", style: fc_container_style });
					button.addEventListener("click", async () => {
						fading_chat_modal.execute_script(script);
					});
				}
			} else {
				// Custom Grid
				const grid = shared.data.button_grids[button_grid_index]!;
				
				for (let index = 0; index < cols*rows; index++) {
					const entry = grid.buttons[index] ?? { text: "", script_id: null };
					const text = entry.text ? button_text(entry.text) : "";
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
								create_formcontrol(container, "select", "script_id", "Script", { value: entry.script_id?.toString() ?? "", options: script_options });
							});
	
							let button_grid_button = shared.data.button_grids[button_grid_index]!.buttons[index];
							if (!button_grid_button) {
								button_grid_button = { text: "", script_id: null };
								shared.data.button_grids[button_grid_index]!.buttons[index] = button_grid_button;
							}
							if (result.text === "") {
								const script = shared.get_script(result.script_id!);
								button_grid_button.text = script.name;
							} else {
								button_grid_button.text = result.text!;
							}
							button_grid_button.script_id = result.script_id!;
							await shared.applyStateChange({ button_grids: shared.data.button_grids });
							buttongrid_ui(shared, LOGGER, COMMANDER, buttongrid_container);
						} else if (entry.script_id !== null) {
							const script = shared.get_script(entry.script_id);
							fading_chat_modal.execute_script(script);
						}
					});
				}
			}
		})
	};
	buttongrid_select.profile_select.addEventListener("change", () => {
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