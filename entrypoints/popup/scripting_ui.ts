import { type Script, type Trigger, type ScriptLine, type Condition, type ConditionGroup, ConditionType, ConditionTargetType, ActionSetMethod, type Action, SCRIPTING_ACTIONS_TYPES, type Reference, execute_script, ActionKind, type FunctionArgument, type ActionArguments } from "@/components/scripting";
import { MessageType } from "@/components/messaging";
import { SCRIPTING_VERSION, IS_POPUP_QUERY_STRING, BUNDLED_SOUNDS, QUERY_SELECTOR_LIST_DELIMITER } from "@/components/constants";
import { BotCommander, Logger, SharedData } from "@/components/basics";
import { alert_modal, create_formcontrol, create_text_element } from "@/components/ui";


export const IS_POPUP = !location.search.includes(IS_POPUP_QUERY_STRING);

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
		const fading_chat_modal = new FadingChatModal(this.LOGGER, this.SESSION_ID);
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
				const script = this.shared.data.scripts[index]!;
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
					fading_chat_modal.execute_script(script);
				});
			}
		}
		render_script_list();
	}
	
	create_element_selector_fc(parent: HTMLElement, element_selector_list: string) {
		const col_container = create_element(parent, "div", { class: "fc-container-3" });
		const fc_container = create_element(col_container, "div");
		const element_selector_inputs: HTMLInputElement[] = [];
		const selector_array = element_selector_list.split(QUERY_SELECTOR_LIST_DELIMITER);
		let more_extra = selector_array.length > 1;

		const __create_element_selector_fc = (parent: HTMLElement, element_selector: string) => {
			const element_selector_container = create_element(parent, "div", { class: "fc-container" });
			if (more_extra) {
				const or_col = create_text_element(element_selector_container!, "div", "OR", { class: "fc-container", style: "display: inline-block; width: 32px; margin-top: 0;" });
				const delete_btn = create_text_element(element_selector_container!, "button", "🗑︎", { class: "fc fc-small fc-container", style: "width: 32px; margin: 0 0.5rem 0 0;" });
				delete_btn.addEventListener("click", () => {
					element_selector_container.remove();
					const index = element_selector_inputs.indexOf(element_selector_input);
					if (index !== -1) {
						element_selector_inputs.splice(index, 1);
					}
				});
			}
			const element_selector_input = create_formcontrol(element_selector_container, "text", "element_selector", "Element Selector", { value: element_selector, class: "", required: true });
			if(!IS_POPUP) {
				const element_selector_btn = create_text_element(element_selector_container!, "button", ">", { class: "fc fc-small fc-container", style: "width: 32px; margin: 0 0 0 0.5rem;" });
				element_selector_input.parentElement!.style.width = "calc(100% - "+(more_extra? "118px" : element_selector_btn.style.width)+" - 0.5rem)";
				element_selector_input.parentElement!.style.display = "inline-block";
				element_selector_input.parentElement!.style.margin = "0";
				element_selector_btn.addEventListener("click", async () => {
					alert_modal("Go to the window and click on a element");
					// We send the signal to all content that we want to select a element.
					const result = await sendMessage<any>(this.LOGGER, { type: MessageType.ELEMENT_SELECTOR, data: {session_id: this.SESSION_ID} });
					element_selector_input.value = result.data!.selector;
				});
			}
			return element_selector_input;
		}

		for(const selector of selector_array) {
			element_selector_inputs.push(__create_element_selector_fc(fc_container, selector));
			more_extra = true;
		}

		const add_or_btn = create_text_element(col_container!, "button", "OR", { class: "fc fc-small fc-container", style: "width: 32px; margin: .5rem 0 0 0.5rem;" });
		add_or_btn.addEventListener("click", () => {
			more_extra = true;
			element_selector_inputs.push(__create_element_selector_fc(fc_container, ""));
		})

		function get_element_selector_list() {
			return element_selector_inputs.map((input) => input.value).join(QUERY_SELECTOR_LIST_DELIMITER);
		}
		return {col_container, get_element_selector_list};
	}
	
	/**
	 * Builds a form for editing a Condition.
	 * Returns an object with get/set methods to read/write the condition.
	 */
	build_condition_form(parent: HTMLElement, initial?: Condition, onRemove?: () => void) {
		const container = create_element(parent, "div", { class: "condition-form", style: "border:1px solid #ccc;padding:8px;margin:4px;border-radius:4px" });
		if (onRemove) {
			const removeBtn = create_text_element(container, "button", "Remove", { class: "float_delete_btn btn-delete fc-b" });
			removeBtn.addEventListener("click", onRemove);
		}
		
		const targetTypeSelect = create_formcontrol(container, "select", "target_type", "Target Type", { 
			value: String(initial?.target.target_type ?? ConditionTargetType.URL), 
			class: "fc-container-3",
			required: true,
			options: [
				{ title: "Hostname", value: String(ConditionTargetType.HOSTNAME) },
				{ title: "URL", value: String(ConditionTargetType.URL) },
				{ title: "Element", value: String(ConditionTargetType.ELEMENT) },
				{ title: "Element Attribute", value: String(ConditionTargetType.ELEMENT_ATTRIBUTE) },
				{ title: "Variable", value: String(ConditionTargetType.VARIABLE) },
			]
		});
		
		const variableScopeSelect = create_formcontrol(container, "select", "variable_scope", "Variable Scope", {
			value: initial?.target.variable_scope ?? "local",
			class: "fc-container-3",
			required: true,
			options: [
				{ title: "local", value: "local" },
				{ title: "global", value: "global" },
				{ title: "persistent", value: "persistent" },
			]
		});
		const variableNameInput = create_formcontrol(container, "text", "variable_name", "Variable Name", { value: initial?.target.variable_name ?? "", class: "fc-container-3", required: true });
	
		const typeSelect = create_formcontrol(container, "select", "type", "Condition Type", { 
			value: initial?.type.toString() ?? String(ConditionType.EXISTS), 
			class: "fc-container-3",
			required: true,
			options: [
				{ title: "EXISTS", value: String(ConditionType.EXISTS) },
				{ title: "EXISTS_NOT", value: String(ConditionType.EXISTS_NOT) },
				{ title: "IS", value: String(ConditionType.IS) },
				{ title: "IS_NOT", value: String(ConditionType.IS_NOT) },
				{ title: "CONTAINS", value: String(ConditionType.CONTAINS) },
				{ title: "CONTAINS NOT", value: String(ConditionType.CONTAINS_NOT) },
			]
		});
		
		const valueInput = create_formcontrol(container, "text", "string_value", "Value", { value: initial?.string_value ?? "", class: "fc-container-3", required: true });
		const {col_container, get_element_selector_list} = this.create_element_selector_fc(container, initial?.target.element_selector ?? "");
		const attribiteInput = create_formcontrol(container, "text", "attribute", "Attribute", { value: initial?.target.attribute ?? "value", class: "fc-container-3" });
		
		const targetTypeSelect_change = () => {
			const type = parseInt(targetTypeSelect.value);
			const isElem = type === ConditionTargetType.ELEMENT || type === ConditionTargetType.ELEMENT_ATTRIBUTE;
			col_container.style.display = isElem ? "" : "none";
			attribiteInput.parentElement!.style.display = type === ConditionTargetType.ELEMENT_ATTRIBUTE ? "" : "none";
			variableScopeSelect.parentElement!.style.display = type === ConditionTargetType.VARIABLE ? "" : "none";
			variableNameInput.parentElement!.style.display = type === ConditionTargetType.VARIABLE ? "" : "none";
		};
		targetTypeSelect.addEventListener("change", targetTypeSelect_change);
		targetTypeSelect_change();
		
		const typeSelect_change = () => {
			if (typeSelect.value === String(ConditionType.EXISTS) || typeSelect.value === String(ConditionType.EXISTS_NOT)) {
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
				const targetType = parseInt(targetTypeSelect.value);
				const target: ConditionTarget = {
					target_type: targetType,
				};
				if (targetType === ConditionTargetType.VARIABLE) {
					target.variable_scope = variableScopeSelect.value;
					target.variable_name = variableNameInput.value;
				} else {
					target.element_selector = get_element_selector_list() || undefined;
					if (targetType === ConditionTargetType.ELEMENT_ATTRIBUTE) {
						target.attribute = attribiteInput.value || undefined;
					}
				}
				return {
					target,
					type: parseInt(typeSelect.value),
					string_value: valueInput.value
				};
			}
		};
	}

	build_fc_reference(arguments_container: HTMLElement, name: string, referenceKey: keyof SharedDataInner, value: string) {
		const referenceArray = this.shared.data[referenceKey] as Reference[];
		const reference_options: { value: string, title: string }[] = [];
		for (let index = 0; index < referenceArray.length; index++) {
			const reference = referenceArray[index]!;
			reference_options.push({ title: reference.name, value: reference.id.toString() });
		}

		let placeholder: string = referenceKey;
		if(placeholder.endsWith("s")) placeholder = placeholder.substring(0, placeholder.length -1);
		return create_formcontrol(arguments_container, "select", name, "Select "+placeholder, {
			value: value,
			class: "fc-container-3",
			required: true,
			options: reference_options
		})
	}
	
	/**
	 * Builds a form for editing an Action.
	 * Returns an object with get/set methods to read/write the action.
	 */
	build_action_form(parent: HTMLElement, initial?: Action, onRemove?: () => void) {
		const container = create_element(parent, "div", { class: "action-form", style: "border:1px solid #ccc;padding:8px;margin:4px;border-radius:4px" });
		if (onRemove) {
			const removeBtn = create_text_element(container, "button", "Remove", { class: "float_delete_btn btn-delete fc-b" });
			removeBtn.addEventListener("click", onRemove);
		}
		
		const action_type_options = [];
		let action_type_value: string = "";
		for (let index = 0; index < SCRIPTING_ACTIONS_TYPES.length; index++) {
			const type_name = SCRIPTING_ACTIONS_TYPES[index]!.name;
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
		const arguments_fc_array: (HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement)[] = [];
		let function_arguments_fc_array: (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[] = [];
		let arguments_container = create_element(container, "div");
		const action_hint = create_text_element(container, "div", "", { class: "action-hint", style: "margin-top: 0.5rem; color: #ccc; font-size: 0.9rem;" });
		let get_element_selector: (()=>string)|null = null;
		const action_type_change_event = () => {
			arguments_container.innerHTML = "";
			action_hint.innerText = "";
			for(const fc of function_arguments_fc_array) fc.remove();
			function_arguments_fc_array = [];
			arguments_fc_array.length = 0;
			if (action_type_select.value === "") return;
			const action_type = SCRIPTING_ACTIONS_TYPES[parseInt(action_type_select.value)]!;
			if (action_type.kind === ActionKind.SET_VARIABLE) {
				action_hint.innerText += 'Define a variable name and value. Local variables exist only during this script run. Variables can be used in STRING with ${local:var}.';
			} else if (action_type.kind === ActionKind.ASSIGN_VARIABLE_ELEMENT_ATTRIBUTE) {
				action_hint.innerText += 'Read an element attribute and store it in a variable. Variables can be used in STRING with ${local:var}.\n';
				action_hint.innerText += 'Use "length" as attribute to get the count of selector matches. ';
				action_hint.innerText += 'Special values as "attribute": value, innertext, innerhtml, outerhtml';
			}
			console.debug("action_type_select", action_type_select);
			console.debug("action_type_select.value", action_type_select.value);
			console.debug("action_type", action_type);

			for (let index = 0; index < action_type.available_arguments.length; index++) {
				const argument = action_type.available_arguments[index]!;
				let argument_value: string;
				if (initial) {
					argument_value = (initial.arguments as any)[argument.argument as any] ?? "";
				} else if(argument.argument === "attribute") {
					argument_value = "value";
				} else {
					argument_value = "";
				}

				const referenceKey = argument.reference as keyof SharedDataInner;
				if (argument.argument === "scope") {
					arguments_fc_array.push(create_formcontrol(arguments_container, "select", "scope", "Scope", {
						value: argument_value,
						class: "fc-container-3",
						required: argument.required,
						options: [
							{ title: "local", value: "local" },
							{ title: "global", value: "global" },
							{ title: "persistent", value: "persistent" },
						],
					}));
				} else if (argument.argument === "source") {
					arguments_fc_array.push(create_formcontrol(arguments_container, "select", "source", "Source", {
						value: argument_value,
						class: "fc-container-3",
						required: argument.required,
						empty_is_value: true,
						options: [
							{ title: "Default audio: "+this.shared.data.notify_sound_source, value: "" },
							...BUNDLED_SOUNDS.map(s => ({ title: s.name, value: s.type === "beep" ? "beep" : s.path })),
						]
					}));
				} else if (argument.argument === "new_tab") {
					arguments_fc_array.push(create_formcontrol(arguments_container, "select", "new_tab", "Open in new tab", {
						value: argument_value,
						class: "fc-container-3",
						required: argument.required,
						options: [
							{ title: "Open in new tab", value: "true" },
							{ title: "Open in current tab", value: "false" },
						],
					}));
				} else if (argument.argument === "element_selector") {
					const {get_element_selector_list} = this.create_element_selector_fc(arguments_container, argument_value);
					get_element_selector = get_element_selector_list;
				} else if (argument.type === "checkbox") {
					const checkboxChecked = argument_value === "true" || argument_value === "on" || argument_value === "1" || argument_value === "";
					arguments_fc_array.push(create_formcontrol(arguments_container, "checkbox", argument.argument, argument.argument, {
						value: argument_value,
						class: "fc-container-3",
						required: argument.required,
						checked: checkboxChecked,
					}));
				} else if (argument.reference && this.shared.data[referenceKey] !== undefined) {
					const reference_select = this.build_fc_reference(arguments_container, argument.argument, referenceKey, argument_value)
					arguments_fc_array.push(reference_select);
					if (action_type.kind === ActionKind.SCRIPT) {
						const change = () => {
							for(const fc of function_arguments_fc_array) fc.remove();
							function_arguments_fc_array = [];

							if (reference_select.value !== "") {
								const script = this.shared.get_script(reference_select.value);
								for(const fa of script.function_arguments) {
									let varvalue = "";
									if (initial && initial.arguments.pass_variables) {
										for (const [_varname, _varvalue] of Object.entries(initial.arguments.pass_variables)) {
											if(_varname === fa.varname) varvalue = _varvalue;
										}
									}
									const fc = create_formcontrol(arguments_container, fa.type as any, fa.varname, fa.question, { value: varvalue, class: "fc-container-3" });
									function_arguments_fc_array.push(fc);
								}
							}
						}
						change();
						reference_select.addEventListener("change", change);
					}
				} else {
					if (argument.use_set_method) {
						const set_method_fc = create_formcontrol(arguments_container, "select", "set_method", "set method", {
							value: initial?.arguments.set_method?.toString() ?? ActionSetMethod.STRING.toString(),
							class: "fc-container-3",
							required: true,
							options: [
								{ title: "STRING", value: ActionSetMethod.STRING.toString() },
								{ title: "DATE_NOW_PLUS_DAYS", value: ActionSetMethod.DATE_NOW_PLUS_DAYS.toString() },
								{ title: "TEMPLATE", value: ActionSetMethod.TEMPLATE.toString() },
							]
						})
						arguments_fc_array.push(set_method_fc);

						// add select for template
						const template_fc = this.build_fc_reference(arguments_container, "id", "templates", argument_value);
						const template_change_event = () => {
							template_fc.style.display = set_method_fc.value === ActionSetMethod.TEMPLATE.toString()? "" : "none";
						};
						template_change_event();
						set_method_fc.addEventListener("change", template_change_event);
						arguments_fc_array.push(template_fc);
					}

					arguments_fc_array.push(
						create_formcontrol(arguments_container, argument.type, argument.argument, argument.argument === "value" ? "Value" : argument.argument, {
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
			elem: container,
			get(): Action {
				const _arguments: ActionArguments = {};
				for (let index = 0; index < arguments_fc_array.length; index++) {
					const fc = arguments_fc_array[index]!;
					_arguments[fc.name] = fc.value;
				}
				if (get_element_selector) {
					_arguments["element_selector"] = get_element_selector();
				}
				if (function_arguments_fc_array) {
					_arguments.pass_variables = {};
					for(const fc of function_arguments_fc_array) {
						_arguments.pass_variables[fc.name] = fc.value;
					}
				}
				console.log("_arguments", _arguments);
				
	
				return {
					type: SCRIPTING_ACTIONS_TYPES[parseInt(action_type_select.value)]!,
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
		if (onRemove) {
			const removeBtn = create_text_element(container, "button", "Remove Line", {class: "float_delete_btn btn-delete fc-b", style: "margin-left: auto;"});
			(removeBtn as HTMLButtonElement).addEventListener("click", onRemove);
		}
		
		// Conditions section
		create_text_element(container, "h5", "Conditions");
		const conditionsContainer = create_element(container, "div", { class: "condition-groups-list" });
		const groupForms: { elem: HTMLElement, get: () => ConditionGroup, add: (condition?: Condition) => void }[] = [];
		const addGroup = (initialGroup?: ConditionGroup) => {
			const groupContainer = create_element(conditionsContainer, "div", { class: "condition-group", style: "border:1px solid #777;padding:8px;margin:8px 0;" });
			create_text_element(groupContainer, "strong", groupForms.length === 0 ? "All of these conditions" : "OR group");
			const conditionContainer = create_element(groupContainer, "div", { class: "conditions-list" });
			const conditionForms: { elem: HTMLElement, get: () => Condition }[] = [];
			const form = { elem: groupContainer, get: () => ({ conditions: conditionForms.map(item => item.get()) }), add: (condition?: Condition) => {
				const conditionForm = this.build_condition_form(conditionContainer, condition, () => {
					const index = conditionForms.findIndex(item => item.elem === conditionForm.elem);
					if (index !== -1) conditionForms.splice(index, 1);
					conditionContainer.innerHTML = "";
					conditionForms.forEach(item => conditionContainer.appendChild(item.elem));
				});
				conditionForms.push(conditionForm);
				conditionContainer.appendChild(conditionForm.elem);
			} };
			groupForms.push(form);
			conditionsContainer.appendChild(groupContainer);
			(initialGroup?.conditions ?? []).forEach(condition => form.add(condition));
		};
		(initial?.conditionGroups ?? []).forEach(group => addGroup(group));
		if (groupForms.length === 0) addGroup();
		const addCondBtn = create_text_element(container, "button", "+ Add Condition", { class:"fc fc-small", style:"margin-top: 1rem;" });
		(addCondBtn as HTMLButtonElement).addEventListener("click", () => groupForms[groupForms.length - 1]!.add());
		const addGroupBtn = create_text_element(container, "button", "+ Add OR Group", { class:"fc fc-small", style:"margin-top: 1rem; margin-left: .5rem;" });
		(addGroupBtn as HTMLButtonElement).addEventListener("click", () => addGroup());
		
		// Actions section
		create_text_element(container, "h5", "Actions");
		const actionsContainer = create_element(container, "div", { class: "actions-list" });
		const actionForms: { elem: HTMLElement, get: () => Action }[] = [];
		
		const renderActions = () => {
			actionsContainer.innerHTML = "";
			actionForms.forEach((form) => {
				actionsContainer.appendChild(form.elem);
			});
		};
		
		(initial?.actions ?? []).forEach(act => {
			const actForm = this.build_action_form(actionsContainer, act, () => {
				const index = actionForms.findIndex((f) => f.elem === actForm.elem);
				if (index !== -1) {
					actionForms.splice(index, 1);
					renderActions();
				}
			});
			actionForms.push(actForm);
		});
		renderActions();
		
		const addActionBtn = create_text_element(container, "button", "+ Add Action", { class:"fc fc-small", style:"margin-top: 1rem;" });
		(addActionBtn as HTMLButtonElement).addEventListener("click", () => {
			const actForm = this.build_action_form(actionsContainer, undefined, () => {
				const index = actionForms.findIndex((f) => f.elem === actForm.elem);
				if (index !== -1) {
					actionForms.splice(index, 1);
					renderActions();
				}
			});
			actionForms.push(actForm);
			renderActions();
		});
		
		return {
			get(): ScriptLine {
				return {
					conditionGroups: groupForms.map(f => f.get()),
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
	
		const title_row = create_element(container, "div", { class:"row" });
		const nameInput = create_formcontrol(title_row, "text", "script_name", "Script Name", { value: initial?.name ?? "", required: true });
		nameInput.parentElement!.style.cssText = "flex-grow: 1;	margin-top: 0";
		const hide_checkbox_container = create_element(title_row, "label", { style:"width: 130px;" });
		const hide_checkbox = create_element(hide_checkbox_container, "input", { class:"", type: "checkbox" });
		if(initial) hide_checkbox.checked = initial.hide;
		create_text_element(hide_checkbox_container, "span", " hide in ButtonGrid/Chat");
		
		const add_function_argument_btn = create_text_element(title_row, "button", "Add argument", { type: "button", class: "btn-insert", style:"" });
		const function_argument_container = create_element(container, "div", { class:"" });
		let function_argument_incrementor = 0;
		const get_function_arguments: (() => FunctionArgument)[] = [];
		function create_function_argument_row(initial?: FunctionArgument) {
			const index = function_argument_incrementor;
			const function_argument_row = create_element(function_argument_container, "div", { class:"row", style: "padding-top: 10px;" });
			const question = create_formcontrol(function_argument_row, "text", "question", "Question", { value: initial?.question ?? "", required: true });
			question.parentElement!.style.flex = "1";
			const varname = create_formcontrol(function_argument_row, "text", "varname", "Variable Name", { value: initial?.varname ?? "", required: true });
			varname.parentElement!.style.flex = "1";
			const type = create_formcontrol(function_argument_row, "select", "type", "Type", { value: initial?.type ?? "", required: true, options: [
				{ title: "Text", value: "text" },
				{ title: "Text Multiline", value: "textarea" },
				{ title: "List", value: "list" },
			] });
			type.parentElement!.style.flex = "1";
			const delimiters = create_formcontrol(function_argument_row, "select", "delimiters", "List Delimiters", { empty_is_value: true });
			delimiters.multiple = true;
			delimiters.parentElement!.style.flex = "1";

			for (const [value, label, default_selected] of [
				["\r\n", "Windows Newline (CRLF)", true],
				["\n", "Newline (LF)", true],
				[",", "Comma (,)", false],
				[";", "Semicolon (;)", false],
				["|", "Pipe (|)", false],
				["\t", "Tab", false],
				[" ", "Space", false],
			]) {
				const option = create_text_element(delimiters, "option", label as string);
				option.value = value as string;

				if (initial) {
					if (initial.delimiters.includes(value as string)) {
						option.selected = true;
					}
				} else if (default_selected) {
					option.selected = true;
				}

				delimiters.appendChild(option);
			};

			const optional = create_formcontrol(function_argument_row, "checkbox", "optional", "Optional", { checked: initial && initial.optional });
			const trim = create_formcontrol(function_argument_row, "checkbox", "trim", "Trim spaces", { checked: initial && initial.trim });
			trim.parentElement!.style.width = "40px";

			const type_change_fn = () => {
				if (type.value === "list") {
					delimiters.parentElement!.style.display = "";
				} else {
					delimiters.parentElement!.style.display = "none";
				}
			};
			type.addEventListener("change", type_change_fn);
			type_change_fn();
			
			const delete_btn = create_text_element(function_argument_row, "button", "Delete", { type: "button", class: "btn-delete", style: "margin-left: 1rem;" });
			delete_btn.addEventListener("click", () => {
				delete get_function_arguments[index];
				function_argument_row.remove();
			});

			get_function_arguments[index] = () => {
				return {
					question: question.value,
					varname: varname.value,
					varvalue: "",
					type: type.value,
					delimiters: [delimiters.value],
					optional: optional.checked,
					trim: trim.checked,
				}
			}
			function_argument_incrementor++;
		}
		add_function_argument_btn.addEventListener("click", ()=>create_function_argument_row());
		if (initial && initial.function_arguments) for(const fa of initial.function_arguments) create_function_argument_row(fa);
		
		// ScriptLines section
		const linesContainer = create_element(container, "div", { class: "scriptlines-container", style: "padding: 8px;" });
		const build_scriptline_form = this.build_scriptline_form;
		const linesForms: { form: ReturnType<typeof build_scriptline_form>, elem: HTMLElement }[] = [];
		
		const renderLines = () => {
			linesContainer.innerHTML = "";
			linesForms.forEach((item, idx) => {
				const wrapper = create_element(linesContainer, "div", { style: "position:relative" });
				const controls = create_element(wrapper, "div", { style: "position: absolute;left: 0;top: 0;z-index: 1;display:flex;gap:4px;margin-bottom:8px" });
				
				if (idx > 0) {
					const upBtn = create_text_element(controls, "button", "↑", {class:"fc fc-small", style: "width: auto;"});
					(upBtn as HTMLButtonElement).addEventListener("click", () => {
						const current = linesForms[idx];
						const previous = linesForms[idx - 1];
						if (current && previous) {
							[linesForms[idx], linesForms[idx - 1]] = [previous, current];
							renderLines();
						}
					});
				}
				
				if (idx < linesForms.length - 1) {
					const downBtn = create_text_element(controls, "button", "↓", {class:"fc fc-small", style: "width: auto;"});
					(downBtn as HTMLButtonElement).addEventListener("click", () => {
						const current = linesForms[idx];
						const next = linesForms[idx + 1];
						if (current && next) {
							[linesForms[idx], linesForms[idx + 1]] = [next, current];
							renderLines();
						}
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
			
			const function_arguments: FunctionArgument[] = [];
			for(const f of get_function_arguments) if(f) function_arguments.push(f());
			shared.setScript({
				version: SCRIPTING_VERSION,
				id: initial?.id ?? "SCRIPT"+new Date().getTime(),
				name: name,
				hide: hide_checkbox.checked,
				function_arguments,
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
		const groupForms: { get: () => ConditionGroup, add: (condition?: Condition) => void }[] = [];
		const addGroup = (initialGroup?: ConditionGroup) => {
			const groupContainer = create_element(conditionsContainer, "div", { style: "border:1px solid #777;padding:8px;margin:8px 0;" });
			create_text_element(groupContainer, "strong", groupForms.length === 0 ? "All of these conditions" : "OR group");
			const conditionForms: ReturnType<typeof this.build_condition_form>[] = [];
			const group = { get: () => ({ conditions: conditionForms.map(form => form.get()) }), add: (condition?: Condition) => {
				const conditionForm = this.build_condition_form(groupContainer, condition);
				conditionForms.push(conditionForm);
				groupContainer.appendChild(conditionForm.elem);
			} };
			groupForms.push(group);
			conditionsContainer.appendChild(groupContainer);
			(initialGroup?.conditions ?? []).forEach(condition => group.add(condition));
		};
		(initial?.conditionGroups ?? []).forEach(group => addGroup(group));
		if (groupForms.length === 0) addGroup();
		const addCondBtn = create_text_element(container, "button", "+ Add Condition");
		(addCondBtn as HTMLButtonElement).addEventListener("click", () => groupForms[groupForms.length - 1]!.add());
		const addGroupBtn = create_text_element(container, "button", "+ Add OR Group");
		(addGroupBtn as HTMLButtonElement).addEventListener("click", () => addGroup());
		
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
				conditionGroups: groupForms.map(f => f.get()),
			};
			(container as any).trigger = trigger;
		});
		
		return container;
	}
}
