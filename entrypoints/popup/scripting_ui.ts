import { Script, Trigger, ScriptLine, Condition, ConditionType, ConditionTargetType, ActionSetMethod, Action, ActionType, SCRIPTING_ACTIONS_TYPES, Reference, execute_script } from "@/components/scripting";
import { MessageType } from "@/components/messaging";
import { SCRIPTING_VERSION, IS_POPUP_QUERY_STRING } from "@/components/constants";
import { BotCommander, Logger, SharedData } from "@/components/basics";
import { alert_modal, create_formcontrol } from "@/components/ui";


export const IS_POPUP = location.search !== IS_POPUP_QUERY_STRING;

export class ScriptingUI {
	shared: SharedData;
	LOGGER: Logger;
	COMMANDER: BotCommander;
	constructor(shared: SharedData, LOGGER: Logger, COMMANDER: BotCommander) {
		this.shared = shared;
		this.LOGGER = LOGGER;
		this.COMMANDER = COMMANDER;
	}
	
	// SESSION_ID to know which controller should be notified for progress reports
	readonly SESSION_ID: number = new Date().getTime();
	
	
	/** list all scripts with actions: edit, delete, execute */
	build_scripting_list(parent: HTMLElement) {
		const new_spoiler = create_element(parent, "div", { class:"spoiler-container" });
		const new_spoiler_title = create_text_element(new_spoiler, "div", "Create new Script", { class:"spoiler-title" });
		const new_spoiler_content = create_element(new_spoiler, "div", { class:"spoiler-content" });
		add_spoiler_event(new_spoiler);
		this.build_script_form(new_spoiler_content, this.shared, () => {
			render_script_list();
			new_spoiler.classList.remove("active");
		});
		
		const edit_spoiler = create_element(parent, "div", { class:"spoiler-container active", style: "display: none;" });
		const edit_spoiler_title = create_text_element(edit_spoiler, "div", "Edit Script", { class:"spoiler-title" });
		const edit_spoiler_content = create_element(edit_spoiler, "div", { class:"spoiler-content" });
	
		// Table List all scripts
		const table = create_element(parent, "table", { class:"table" });
		const thead = create_element(table, "thead");
		const thead_tr = create_element(thead, "tr");
		create_text_element(thead_tr, "th", "ID");
		create_text_element(thead_tr, "th", "Name");
		create_text_element(thead_tr, "th", "Actions", { style:"width: 204px;" });
		
		const tbody = create_element(table, "tbody");
		var render_script_list = () => {
			tbody.innerHTML = "";
			for (let index = 0; index < this.shared.data.scripts.length; index++) {
				const script = this.shared.data.scripts[index];
				const tr = create_element(tbody, "tr");
				create_text_element(tr, "td", script.id.toString());
				create_text_element(tr, "td", script.name);
				const actions = create_element(tr, "td");
				create_text_element(actions, "button", "Edit", { class:"btn-edit" }).addEventListener("click", () => {
					new_spoiler.style.display = "none";
					edit_spoiler.style.display = "";
					edit_spoiler_content.innerHTML = "";
					this.build_script_form(edit_spoiler_content, this.shared, () => {
						new_spoiler.style.display = "";
						new_spoiler.classList.remove("active");
						edit_spoiler.style.display = "none";
						render_script_list()
					}, script);
					scroll(0, 0);
				});
				create_text_element(actions, "button", "Delete", { class:"btn-delete" }).addEventListener("click", async () => {
					await this.shared.deleteScript(script.id);
					render_script_list();
				});
				create_text_element(actions, "button", "Execute", { class:"btn-insert" }).addEventListener("click", () => {
					execute_script(this, script.id)
				});
			}
		}
		render_script_list();
	}
	
	create_element_selector_fc(parent: HTMLElement, element_selector: string) {
		const element_selector_container = create_element(parent, "div", { class: "fc-container fc-container-3" });
		const element_selector_input = create_formcontrol(element_selector_container, "text", "element_selector", "Element Selector", { value: element_selector, class: "", required: true });
		if(!IS_POPUP) {
			const element_selector_btn = create_text_element(element_selector_container!, "button", ">", { class: "fc fc-small fc-container", style: "width: 32px; margin: 0 0 0 0.5rem;" });
			element_selector_input.parentElement!.style.width = "calc(100% - "+element_selector_btn.style.width+" - 0.5rem)";
			element_selector_input.parentElement!.style.display = "inline-block";
			element_selector_input.parentElement!.style.margin = "0";
			element_selector_btn.addEventListener("click", async () => {
				alert_modal("Go to the window and click on a element");
				// We send the signal to all content that we want to select a element.
				const result = await sendMessage<any>(this.LOGGER, { type: MessageType.ELEMENT_SELECTOR, data: {} });
				element_selector_input.value = result.data!.selector;
			});
		}
		return {element_selector_container, element_selector_input};
	}
	
	/**
	 * Builds a form for editing a Condition.
	 * Returns an object with get/set methods to read/write the condition.
	 */
	build_condition_form(parent: HTMLElement, initial?: Condition) {
		const container = create_element(parent, "div", { class: "condition-form", style: "border:1px solid #ccc;padding:8px;margin:4px;border-radius:4px" });
		
		const targetTypeSelect = create_formcontrol(container, "select", "target_type", "Target Type", { 
			value: String(initial?.target.target_type ?? ConditionTargetType.URL), 
			class: "fc-container-3",
			required: true,
			options: [
				{ title: "URL", value: String(ConditionTargetType.URL) },
				{ title: "Domain", value: String(ConditionTargetType.DOMAIN) },
				{ title: "Element", value: String(ConditionTargetType.ELEMENT) },
				{ title: "Element Attribute", value: String(ConditionTargetType.ELEMENT_ATTRIBUTE) },
			]
		});
	
		const typeSelect = create_formcontrol(container, "select", "type", "Condition Type", { 
			value: initial?.type.toString() ?? "", 
			class: "fc-container-3",
			required: true,
			options: [
				{ title: "EXISTS", value: String(ConditionType.EXISTS) },
				{ title: "IS", value: String(ConditionType.IS) },
				{ title: "IS_NOT", value: String(ConditionType.IS_NOT) },
				{ title: "CONTAINS", value: String(ConditionType.CONTAINS) },
				{ title: "CONTAINS NOT", value: String(ConditionType.CONTAINS_NOT) },
			]
		});
		
		const valueInput = create_formcontrol(container, "text", "static_value", "Value", { value: initial?.static_value ?? "", class: "fc-container-3", required: true });
		const {element_selector_container, element_selector_input} = this.create_element_selector_fc(container, initial?.target.element_selector ?? "");
		const attribiteInput = create_formcontrol(container, "text", "attribute", "Attribute", { value: initial?.target.attribute ?? "", class: "fc-container-3" });
		
		const targetTypeSelect_change = () => {
			const type = parseInt(targetTypeSelect.value);
			if (type === ConditionTargetType.ELEMENT || type === ConditionTargetType.ELEMENT_ATTRIBUTE) {
				element_selector_container.style.display = "";
			} else {
				element_selector_container.style.display = "none";
			}
			if (type === ConditionTargetType.ELEMENT_ATTRIBUTE) {
				attribiteInput.parentElement!.style.display = "";
			} else {
				attribiteInput.parentElement!.style.display = "none";
			}
		};
		targetTypeSelect.addEventListener("change", targetTypeSelect_change);
		targetTypeSelect_change();
		
		const typeSelect_change = () => {
			if (typeSelect.value === String(ConditionType.EXISTS)) {
				valueInput.parentElement!.style.display = "none";
			} else {
				valueInput.parentElement!.style.display = "";
			}
		};
		typeSelect.addEventListener("change", typeSelect_change);
		typeSelect_change();
	
		return {
			elem: container,
			get(): Condition {
				return {
					target: {
						target_type: parseInt(targetTypeSelect.value),
						element_selector: element_selector_input.value || undefined,
						attribute: attribiteInput.value || undefined
					},
					type: parseInt(typeSelect.value),
					static_value: valueInput.value
				};
			}
		};
	}
	
	/**
	 * Builds a form for editing an Action.
	 * Returns an object with get/set methods to read/write the action.
	 */
	build_action_form(parent: HTMLElement, initial?: Action) {
		const container = create_element(parent, "div", { class: "action-form", style: "border:1px solid #ccc;padding:8px;margin:4px;border-radius:4px" });
		
		const action_type_options = [];
		let action_type_value: string = "";
		for (let index = 0; index < SCRIPTING_ACTIONS_TYPES.length; index++) {
			const type_name = SCRIPTING_ACTIONS_TYPES[index].name;
			action_type_options.push({ title: type_name, value: index.toString() });
			if (initial && type_name === initial?.type.name) {
				action_type_value = index.toString();
			}
		}
		const action_type_select = create_formcontrol(container, "select", "action", "Action", { 
			value: action_type_value, 
			class: "fc-container-3",
			required: true,
			options: action_type_options
		});
		
		// Auto generate arguments inputs
		const arguments_fc_array: (HTMLInputElement|HTMLSelectElement)[] = [];
		const arguments_container = create_element(container, "div");
		const action_type_change_event = () => {
			arguments_container.innerHTML = "";
			if(action_type_select.value === "") return;
			const action_type = SCRIPTING_ACTIONS_TYPES[parseInt(action_type_select.value)];
			console.debug("action_type_select", action_type_select);
			console.debug("action_type_select.value", action_type_select.value);
			console.debug("action_type", action_type);
			
	
			for (let index = 0; index < action_type.available_arguments.length; index++) {
				const argument = action_type.available_arguments[index];
				let argument_value: string;
				if (initial) {
					argument_value = (initial.arguments as any)[argument.argument as any]?? "";
				} else {
					argument_value = "";
				}
				
				/** If reference is set then we get automaticly a select with data from from SharedData.data
				*  we expect that the object has `name` attribute. the expected value to return of the select is the argument.
				*/
				const referenceKey = argument.reference as keyof SharedDataInner;
				if (argument.argument === "element_selector") {
					const {element_selector_container, element_selector_input} = this.create_element_selector_fc(arguments_container, argument_value);
					arguments_fc_array.push(element_selector_input);
				} else if (argument.reference && this.shared.data[referenceKey] !== undefined) {
					const referenceArray = this.shared.data[referenceKey] as Reference[];
					const reference_options: { value: string, title: string }[] = [];
					for (let index = 0; index < referenceArray.length; index++) {
						const reference = referenceArray[index];
						reference_options.push({ title: reference.name, value: reference.id.toString() });
					}
	
					let placeholder: string = argument.reference;
					if(placeholder.endsWith("s")) placeholder = placeholder.substring(0, placeholder.length -1);
					arguments_fc_array.push(
						create_formcontrol(arguments_container, "select", argument.argument, "Select "+placeholder, { 
							value: argument_value, 
							class: "fc-container-3",
							required: true,
							options: reference_options
						})
					)
				} else {
					if (argument.use_set_method) {
						arguments_fc_array.push(
							create_formcontrol(arguments_container, "select", "set_method", "set method", {
								value: initial?.arguments.set_method?.toString() ?? ActionSetMethod.STATIC.toString(),
								class: "fc-container-3",
								required: true,
								options: [
									{ title: "STATIC", value: ActionSetMethod.STATIC.toString() },
									{ title: "DATE_NOW_PLUS_DAYS", value: ActionSetMethod.DATE_NOW_PLUS_DAYS.toString() },
								]
							})
						)
					}

					arguments_fc_array.push(
						create_formcontrol(arguments_container, argument.type, argument.argument, argument.argument, {
							value: argument_value,
							class: "fc-container-3",
							required: argument.required,
						})
					)
				}
			}
		};
		action_type_select.addEventListener("change", action_type_change_event);
		action_type_change_event();
		
		return {
			get(): Action {
				const _arguments: Record<string, string> = {};
				for (let index = 0; index < arguments_fc_array.length; index++) {
					const fc = arguments_fc_array[index];
					_arguments[fc.name] = fc.value;
				}
				console.log("_arguments", _arguments);
				
	
				return {
					type: SCRIPTING_ACTIONS_TYPES[parseInt(action_type_select.value)],
					arguments: _arguments,
				};
			}
		};
	}
	
	/**
	 * Builds a form for editing a ScriptLine with addable/removable conditions and actions.
	 * Returns an object with a get() method.
	 */
	build_scriptline_form(parent: HTMLElement, initial: ScriptLine|null, onRemove: () => void) {
		const container = create_element(parent, "div", { class: "scriptline-form", style: "border:2px solid #333;padding:12px;margin:8px 0;border-radius:6px;background:#39495A" });
		
		// Header with remove button
		const header = create_element(container, "div", { style: "display:flex;justify-content:space-between;margin-bottom:12px" });
		if (onRemove) {
			const removeBtn = create_text_element(header, "button", "Remove Line", {class: "btn-delete fc-b", style: "margin-left: auto;"});
			(removeBtn as HTMLButtonElement).addEventListener("click", onRemove);
		}
		
		// Conditions section
		create_text_element(container, "h5", "Conditions");
		const conditionsContainer = create_element(container, "div", { class: "conditions-list" });
		const conditionForms: ReturnType<typeof this.build_condition_form>[] = [];
		
		(initial?.conditions ?? []).forEach(cond => {
			const condForm = this.build_condition_form(conditionsContainer, cond);
			conditionForms.push(condForm);
		});
		
		const addCondBtn = create_text_element(container, "button", "+ Add Condition", { class:"fc fc-small", style:"margin-top: 1rem;" });
		(addCondBtn as HTMLButtonElement).addEventListener("click", () => {
			const condForm = this.build_condition_form(conditionsContainer);
			conditionForms.push(condForm);
		});
		
		// Actions section
		create_text_element(container, "h5", "Actions");
		const actionsContainer = create_element(container, "div", { class: "actions-list" });
		const actionForms: ReturnType<typeof this.build_action_form>[] = [];
		
		(initial?.actions ?? []).forEach(act => {
			const actForm = this.build_action_form(actionsContainer, act);
			actionForms.push(actForm);
		});
		
		const addActionBtn = create_text_element(container, "button", "+ Add Action", { class:"fc fc-small", style:"margin-top: 1rem;" });
		(addActionBtn as HTMLButtonElement).addEventListener("click", () => {
			const actForm = this.build_action_form(actionsContainer);
			actionForms.push(actForm);
		});
		
		return {
			get(): ScriptLine {
				return {
					conditions: conditionForms.map(f => f.get()),
					actions: actionForms.map(f => f.get())
				};
			}
		};
	}
	
	/**
	 * Builds a structured form for creating/editing a Script.
	 * The form includes a list of addable/removable/movable ScriptLines.
	 * Parsed value is attached to the returned container as `.script`.
	 */
	build_script_form(container: HTMLElement, shared: SharedData, on_set: ()=>void, initial?: Script) {
		const title_sub = document.getElementById("title_sub");
		if (title_sub !== null) {
			title_sub.innerHTML = "Script Editor <small>v"+SCRIPTING_VERSION+"</small>";
			if(initial) title_sub.innerHTML += " ID: "+initial.id;
		}
	
		const nameInput = create_formcontrol(container, "text", "script_name", "Script Name", { value: initial?.name ?? "", required: true });
		
		// ScriptLines section
		const linesContainer = create_element(container, "div", { class: "scriptlines-container", style: "padding: 8px;" });
		const build_scriptline_form = this.build_scriptline_form;
		const linesForms: { form: ReturnType<typeof build_scriptline_form>, elem: HTMLElement }[] = [];
		
		const renderLines = () => {
			linesContainer.innerHTML = "";
			linesForms.forEach((item, idx) => {
				const wrapper = create_element(linesContainer, "div", { style: "position:relative" });
				const controls = create_element(wrapper, "div", { style: "display:flex;gap:4px;margin-bottom:8px" });
				
				if (idx > 0) {
					const upBtn = create_text_element(controls, "button", "↑", {class:"fc fc-small", style: "width: auto;"});
					(upBtn as HTMLButtonElement).addEventListener("click", () => {
						[linesForms[idx], linesForms[idx - 1]] = [linesForms[idx - 1], linesForms[idx]];
						renderLines();
					});
				}
				
				if (idx < linesForms.length - 1) {
					const downBtn = create_text_element(controls, "button", "↓", {class:"fc fc-small", style: "width: auto;"});
					(downBtn as HTMLButtonElement).addEventListener("click", () => {
						[linesForms[idx], linesForms[idx + 1]] = [linesForms[idx + 1], linesForms[idx]];
						renderLines();
					});
				}
				
				wrapper.appendChild(item.elem);
			});
		};
		
		(initial?.lines ?? []).forEach(line => {
			const lineElem = create_element(linesContainer, "div");
			const form = this.build_scriptline_form(lineElem, line, () => {
				linesForms.splice(linesForms.findIndex(f => f.form === form), 1);
				renderLines();
			});
			linesForms.push({ form, elem: lineElem });
		});
		
		renderLines();
		
		const addLineBtn = create_text_element(container, "button", "+ Add Script Line", { class: "fc", style: "margin-top: 2rem;" });
		(addLineBtn as HTMLButtonElement).addEventListener("click", () => {
			const lineElem = create_element(linesContainer, "div");
			const form = this.build_scriptline_form(lineElem, null, () => {
				linesForms.splice(linesForms.findIndex(f => f.form === form), 1);
				renderLines();
			});
			linesForms.push({ form, elem: lineElem });
			renderLines();
		});
		
		// Save button
		const saveBtn = create_text_element(container, "button", "Save Script", { class: "fc", style: "margin-top: 2rem;" });
		saveBtn.addEventListener("click", () => {
			const name = nameInput.value.trim();
			if (name.length === 0 || name.includes(" ") 
				|| ( initial?.name !== name && shared.data.scripts.findIndex((s) => s.name === name) !== -1) ) {
				nameInput.style.borderColor = "red";
				alert("Script name should not be empty, not contain any spaces and not already be in use");
				return;
			}
			nameInput.style.borderColor = "";
			
			shared.setScript({
				version: SCRIPTING_VERSION,
				id: initial?.id ?? "SCRIPT"+new Date().getTime(),
				name: name,
				lines: linesForms.map(f => f.form.get())
			});
			on_set();
		});
	}
	
	/**
	 * Builds a structured form for creating/editing a Trigger.
	 * Parsed value is attached to the returned container as `.trigger`.
	 */
	build_trigger_form(parent: HTMLElement, shared: SharedData, initial?: Trigger): HTMLElement {
		const container = create_element(parent, "div", { class: "trigger-form", style: "border:3px solid #00f;padding:16px;border-radius:8px" });
		
		create_text_element(container, "h3", "Trigger Editor");
		
		// Basic properties
		const everyInput = create_formcontrol(container, "number", "every", "Execute every (ms, null for event-based)", { value: String(initial?.every), required: false });
	
		// Conditions section
		create_text_element(container, "h4", "Trigger Conditions");
		const conditionsContainer = create_element(container, "div", { class: "trigger-conditions-list" });
		const conditionForms: ReturnType<typeof this.build_condition_form>[] = [];
		
		(initial?.conditions ?? []).forEach(cond => {
			const condForm = this.build_condition_form(conditionsContainer, cond);
			conditionForms.push(condForm);
		});
		
		const addCondBtn = create_text_element(container, "button", "+ Add Condition");
		(addCondBtn as HTMLButtonElement).addEventListener("click", () => {
			const condForm = this.build_condition_form(conditionsContainer);
			conditionForms.push(condForm);
		});
		
		// Script section
		create_text_element(container, "h4", "Associated Script");
		const script_select = create_element(container, "select") as HTMLSelectElement;
		create_text_element(container, "option", "select a Script..", { value: "", style: "display: none;" });
		for (const script of shared.data.scripts) {
			create_text_element(container, "option", script.name, { value: script.id });
		}
		script_select.value = initial?.script_id ?? "";
		
		
		// Save button
		const saveBtn = create_text_element(container, "button", "Save Trigger", { style: "padding:8px 16px;font-weight:bold;background:#00a;color:#fff;border:none;border-radius:4px;cursor:pointer" });
		saveBtn.addEventListener("click", () => {
			if (script_select.value === "") {
				script_select.style.borderColor = "red";
				return;
			}
			script_select.style.borderColor = "";
			const script = shared.data.scripts.find((item) => item.id === script_select.value);
			if (!script) {
				script_select.style.borderColor = "red";
				return;
			}

			const trigger: Trigger = {
				id: initial?.id ?? `TRG${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
				name: initial?.name ?? "",
				script_id: script.id,
				events: initial?.events ?? [],
				every: everyInput.value ? parseInt(everyInput.value) : null,
				conditions: conditionForms.map(f => f.get()),
			};
			(container as any).trigger = trigger;
		});
		
		return container;
	}
}