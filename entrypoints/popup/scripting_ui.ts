import { Script, Trigger, ScriptLine, Condition, ConditionType, ConditionTargetType, ConditionTarget, Action, ActionType, SCRIPTING_ACTIONS_TYPES, Reference } from "@/components/scripting";
import { MessageType } from "@/components/messaging";
import { SCRIPTING_VERSION } from "@/components/constants";
import { SharedData } from "@/components/basics";
import { create_formcontrol } from "@/components/ui";


/** TODO: list all scripts with actions: edit, delete, execute */
export function build_scripting_list(parent: HTMLElement, shared: SharedData) {
	console.log("parent", parent, shared);
	
	const spoiler = create_element(parent, "div", { class:"spoiler-container" });
	const spoiler_title = create_text_element(spoiler, "div", "Create new Script", { class:"spoiler-title" });
	const spoiler_content = create_element(spoiler, "div", { class:"spoiler-content" });
	add_spoiler_event(spoiler);
	build_script_form(spoiler_content, shared, () => render_script_list());

	// Table List all scripts
	const table = create_element(parent, "table", { class:"table" });
	const thead = create_element(table, "thead");
	const thead_tr = create_element(thead, "tr");
	create_text_element(thead_tr, "th", "ID");
	create_text_element(thead_tr, "th", "Name");
	create_text_element(thead_tr, "th", "Actions");
	
	const tbody = create_element(table, "tbody");
	function render_script_list() {
		tbody.innerHTML = "";
		for (let index = 0; index < shared.data.scripts.length; index++) {
			const script = shared.data.scripts[index];
			const tr = create_element(tbody, "tr");
			create_text_element(tr, "td", script.id.toString());
			create_text_element(tr, "td", script.name);
			const actions = create_element(tr, "td");
		}
	}
	render_script_list();
}


/**
 * Builds a form for editing a Condition.
 * Returns an object with get/set methods to read/write the condition.
 */
function build_condition_form(parent: HTMLElement, initial?: Condition) {
	const container = create_element(parent, "div", { class: "condition-form", style: "border:1px solid #ccc;padding:8px;margin:4px;border-radius:4px" });
	
	const targetTypeSelect_container = create_element(container, "div")
	const targetTypeSelect = create_formcontrol(targetTypeSelect_container, "select", "target_type", "Target Type", { 
		value: String(initial?.target.target_type ?? ConditionTargetType.URL), 
		class: "fc-container-3",
		required: true,
		options: [
			{ title: "URL", value: String(ConditionTargetType.URL) },
			{ title: "Domain", value: String(ConditionTargetType.DOMAIN) },
			{ title: "Element", value: String(ConditionTargetType.ELEMENT) },
		]
	});

	const selectorInput = create_formcontrol(container, "text", "element_selector", "Element Selector", { value: initial?.target.element_selector ?? "", class: "fc-container-3", required: true });
	
	const typeSelect = create_formcontrol(container, "select", "target_type", "Condition Type", { 
		value: initial?.type ?? "", 
		class: "fc-container-3",
		required: true,
		options: [
			{ title: "IS", value: String(ConditionType.IS) },
			{ title: "IS", value: String(ConditionType.IS_NOT) },
			{ title: "CONTAINS", value: String(ConditionType.CONTAINS) },
			{ title: "CONTAINS NOT", value: String(ConditionType.CONTAINS_NOT) },
		]
	});
	
	const valueInput = create_formcontrol(container, "text", "static_value", "Value", { value: initial?.static_value ?? "", class: "fc-container-3", required: true });

	return {
		get(): Condition {
			return {
				target: {
					target_type: parseInt(targetTypeSelect.value),
					element_selector: selectorInput.value || undefined
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
function build_action_form(parent: HTMLElement, shared: SharedData, initial?: Action) {
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
		const action_type = SCRIPTING_ACTIONS_TYPES[parseInt(action_type_select.value)];
		for (let index = 0; index < action_type.available_arguments.length; index++) {
			const argument = action_type.available_arguments[index];
			
			/** If reference is set then we get automaticly a select with data from from SharedData.data
			*  we expect that the object has `name` attribute. the expected value to return of the select is the argument.
			*/
			const referenceKey = argument.reference as keyof SharedDataInner;
			if (argument.reference && shared.data[referenceKey] !== undefined) {
				const referenceArray = shared.data[referenceKey] as Reference[];
				const reference_options: { value: string, title: string }[] = [];
				let reference_value: string = "";
				for (let index = 0; index < referenceArray.length; index++) {
					const reference = referenceArray[index];
					reference_options.push({ title: reference.name, value: reference.id.toString() });
				}

				arguments_fc_array.push(
					create_formcontrol(arguments_container, "select", argument.argument, "Select one of the "+argument.reference, { 
						value: reference_value, 
						class: "fc-container-3",
						required: true,
						options: reference_options
					})
				)
			} else {
				arguments_fc_array.push(
					create_formcontrol(arguments_container, argument.type, argument.argument, argument.argument, {
						required: argument.required
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
function build_scriptline_form(parent: HTMLElement, shared: SharedData, initial: ScriptLine|null, onRemove: () => void) {
	const container = create_element(parent, "div", { class: "scriptline-form", style: "border:2px solid #333;padding:12px;margin:8px;border-radius:6px;background:#39495A" });
	
	// Header with remove button
	const header = create_element(container, "div", { style: "display:flex;justify-content:space-between;margin-bottom:12px" });
	if (onRemove) {
		const removeBtn = create_text_element(header, "button", "Remove Line", {class: "btn-delete fc-b", style: "margin-left: auto;"});
		(removeBtn as HTMLButtonElement).addEventListener("click", onRemove);
	}
	
	// Conditions section
	create_text_element(container, "h5", "Conditions");
	const conditionsContainer = create_element(container, "div", { class: "conditions-list" });
	const conditionForms: ReturnType<typeof build_condition_form>[] = [];
	
	(initial?.conditions ?? []).forEach(cond => {
		const condForm = build_condition_form(conditionsContainer, cond);
		conditionForms.push(condForm);
	});
	
	const addCondBtn = create_text_element(container, "button", "+ Add Condition", { class:"fc fc-small", style:"margin-top: 1rem;" });
	(addCondBtn as HTMLButtonElement).addEventListener("click", () => {
		const condForm = build_condition_form(conditionsContainer);
		conditionForms.push(condForm);
	});
	
	// Actions section
	create_text_element(container, "h5", "Actions");
	const actionsContainer = create_element(container, "div", { class: "actions-list" });
	const actionForms: ReturnType<typeof build_action_form>[] = [];
	
	(initial?.actions ?? []).forEach(act => {
		const actForm = build_action_form(actionsContainer, shared, act);
		actionForms.push(actForm);
	});
	
	const addActionBtn = create_text_element(container, "button", "+ Add Action", { class:"fc fc-small", style:"margin-top: 1rem;" });
	(addActionBtn as HTMLButtonElement).addEventListener("click", () => {
		const actForm = build_action_form(actionsContainer, shared);
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
export function build_script_form(container: HTMLElement, shared: SharedData, on_set: ()=>void, initial?: Script) {
	const title_sub = document.getElementById("title_sub");
	console.log("title_sub", title_sub);
	
	if (title_sub !== null) {
		title_sub.innerHTML = "Script Editor <small>v"+SCRIPTING_VERSION+"</small>";
		if(initial) title_sub.innerHTML += " ID: "+initial.id;
	}

	const nameInput = create_formcontrol(container, "text", "script_name", "Script Name", { value: initial?.name ?? "", required: true });
	
	// ScriptLines section
	const linesContainer = create_element(container, "div", { class: "scriptlines-container" });
	const linesForms: { form: ReturnType<typeof build_scriptline_form>, elem: HTMLElement }[] = [];
	
	const renderLines = () => {
		linesContainer.innerHTML = "";
		linesForms.forEach((item, idx) => {
			const wrapper = create_element(linesContainer, "div", { style: "position:relative" });
			const controls = create_element(wrapper, "div", { style: "display:flex;gap:4px;margin-bottom:8px" });
			
			if (idx > 0) {
				const upBtn = create_text_element(controls, "button", "↑");
				(upBtn as HTMLButtonElement).addEventListener("click", () => {
					[linesForms[idx], linesForms[idx - 1]] = [linesForms[idx - 1], linesForms[idx]];
					renderLines();
				});
			}
			
			if (idx < linesForms.length - 1) {
				const downBtn = create_text_element(controls, "button", "↓");
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
		const form = build_scriptline_form(lineElem, shared, line, () => {
			linesForms.splice(linesForms.findIndex(f => f.form === form), 1);
			renderLines();
		});
		linesForms.push({ form, elem: lineElem });
	});
	
	renderLines();
	
	const addLineBtn = create_text_element(container, "button", "+ Add Script Line", { class: "fc", style: "margin-top: 2rem;" });
	(addLineBtn as HTMLButtonElement).addEventListener("click", () => {
		const lineElem = create_element(linesContainer, "div");
		const form = build_scriptline_form(lineElem, shared, null, () => {
			linesForms.splice(linesForms.findIndex(f => f.form === form), 1);
			renderLines();
		});
		linesForms.push({ form, elem: lineElem });
		renderLines();
	});
	
	// Save button
	const saveBtn = create_text_element(container, "button", "Save Script", { class: "fc", style: "margin-top: 2rem;" });
	(saveBtn as HTMLButtonElement).addEventListener("click", () => {
		const name = nameInput.value.trim();
		if (name.length === 0 || name.includes(" ") || shared.data.scripts.findIndex((s) => s.name === name) !== -1) {
			nameInput.style.borderColor = "red";
			alert("Script name should not be empty, not contain any spaces and not already be in use");
			return;
		}
		nameInput.style.borderColor = "";
		
		shared.setScript({
			version: SCRIPTING_VERSION,
			id: initial?.id ?? new Date().getTime(),
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
export function build_trigger_form(parent: HTMLElement, shared: SharedData, initial?: Trigger): HTMLElement {
	const container = create_element(parent, "div", { class: "trigger-form", style: "border:3px solid #00f;padding:16px;border-radius:8px" });
	
	create_text_element(container, "h3", "Trigger Editor");
	
	// Basic properties
	const everyInput = create_formcontrol(container, "number", "every", "Execute every (ms, null for event-based)", { value: initial?.every ?? "", required: false });

	// Conditions section
	create_text_element(container, "h4", "Trigger Conditions");
	const conditionsContainer = create_element(container, "div", { class: "trigger-conditions-list" });
	const conditionForms: ReturnType<typeof build_condition_form>[] = [];
	
	(initial?.conditions ?? []).forEach(cond => {
		const condForm = build_condition_form(conditionsContainer, cond);
		conditionForms.push(condForm);
	});
	
	const addCondBtn = create_text_element(container, "button", "+ Add Condition");
	(addCondBtn as HTMLButtonElement).addEventListener("click", () => {
		const condForm = build_condition_form(conditionsContainer);
		conditionForms.push(condForm);
	});
	
	// Script section
	create_text_element(container, "h4", "Associated Script");
	const script_select = create_element(container, "select");
	create_text_element(container, "option", "select a Script..", { value: "", style: "display: none;" });
	for (let index = 0; index < shared.data.scripts.length; index++) {
		const script = shared.data.scripts[index];
		const script_option = create_text_element(container, "option", script.name, { value: index.toString() });
	}
	
	
	// Save button
	const saveBtn = create_text_element(container, "button", "Save Trigger", { style: "padding:8px 16px;font-weight:bold;background:#00a;color:#fff;border:none;border-radius:4px;cursor:pointer" });
	(saveBtn as HTMLButtonElement).addEventListener("click", () => {
		if (script_select.value === "") {
			script_select.style.borderColor = "red";
			return;
		}
		script_select.style.borderColor = "";
		const script = shared.data.scripts[parseInt(script_select.value)];

		const trigger: Trigger = {
			events: initial?.events ?? [],
			every: everyInput.value ? parseInt(everyInput.value) : null,
			conditions: conditionForms.map(f => f.get()),
			script: script
		};
		(container as any).trigger = trigger;
	});
	
	return container;
}