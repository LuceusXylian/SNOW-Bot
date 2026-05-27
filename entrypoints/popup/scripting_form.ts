import { Script, Trigger, ScriptLine, Condition, ConditionType, ConditionTargetType, ConditionTarget, Action, ActionType, SCRIPTING_ACTIONS_TYPES } from "@/components/scripting";
import { MessageType } from "@/components/messaging";
import { SCRIPTING_VERSION } from "@/components/constants";
import { SharedData } from "@/components/basics";
import { create_formcontrol } from "@/components/ui";


/**
 * Builds a form for editing a Condition.
 * Returns an object with get/set methods to read/write the condition.
 */
function build_condition_form(parent: HTMLElement, initial?: Condition) {
	const container = create_element(parent, "div", { class: "condition-form", style: "border:1px solid #ccc;padding:8px;margin:4px;border-radius:4px" });
	
	const targetTypeLabel = create_text_element(container, "label", "Target Type:");
	const targetTypeSelect = create_element(container, "select") as HTMLSelectElement;
	create_text_element(targetTypeSelect, "option", "URL", { value: String(ConditionTargetType.URL) });
	create_text_element(targetTypeSelect, "option", "Domain", { value: String(ConditionTargetType.DOMAIN) });
	create_text_element(targetTypeSelect, "option", "Element", { value: String(ConditionTargetType.ELEMENT) });
	targetTypeSelect.value = String(initial?.target.target_type ?? ConditionTargetType.URL);
	container.appendChild(document.createElement("br"));
	
	const selectorLabel = create_text_element(container, "label", "Element Selector (if needed):");
	const selectorInput = create_element(container, "input", { value: initial?.target.element_selector ?? "", style: "width:100%" }) as HTMLInputElement;
	container.appendChild(document.createElement("br"));
	
	const typeLabel = create_text_element(container, "label", "Condition Type:");
	const typeSelect = create_element(container, "select") as HTMLSelectElement;
	create_text_element(typeSelect, "option", "IS", { value: String(ConditionType.IS) });
	create_text_element(typeSelect, "option", "IS NOT", { value: String(ConditionType.IS_NOT) });
	create_text_element(typeSelect, "option", "CONTAINS", { value: String(ConditionType.CONTAINS) });
	create_text_element(typeSelect, "option", "CONTAINS NOT", { value: String(ConditionType.CONTAINS_NOT) });
	typeSelect.value = String(initial?.type ?? ConditionType.IS);
	container.appendChild(document.createElement("br"));
	
	const valueLabel = create_text_element(container, "label", "Value:");
	const valueInput = create_element(container, "input", { value: initial?.static_value ?? "", style: "width:100%" }) as HTMLInputElement;
	container.appendChild(document.createElement("br"));
	
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
function build_action_form(parent: HTMLElement, initial?: Action) {
	const container = create_element(parent, "div", { class: "action-form", style: "border:1px solid #ccc;padding:8px;margin:4px;border-radius:4px" });
	
	const row = create_element(container, "div");
	const messageTypeLabel = create_text_element(row, "label", "Action:");
	const messageTypeSelect = create_element(row, "select");
	for (let index = 0; index < SCRIPTING_ACTIONS_TYPES.length; index++) {
		const type_name = SCRIPTING_ACTIONS_TYPES[index].name;
		create_text_element(messageTypeSelect, "option", type_name, { value: index.toString() });
		if (initial && type_name === initial?.type.name) {
			messageTypeSelect.value = index.toString();
		}
	}
	
	// Auto generate arguments inputs
	const arguments_container = create_element(container, "div");
	messageTypeSelect.addEventListener("change", () => {
		arguments_container.innerHTML = "";
		const action_type = SCRIPTING_ACTIONS_TYPES[parseInt(messageTypeSelect.value)];
		for (let index = 0; index < action_type.available_arguments.length; index++) {
			const argument = action_type.available_arguments[index];
			
			/** //TODO: If reference is set then we get automaticly a select with data from from SharedData
			*  we expect that the object has `name` attribute. the expected value to return of the select is the argument.
			*/
			create_formcontrol(arguments_container, argument.type, argument.argument, argument.argument, {
				required: argument.required
			});
		}
	});
	
	return {
		get(): Action {
			const _arguments: Object = {};

			return {
				type: SCRIPTING_ACTIONS_TYPES[parseInt(messageTypeSelect.value)],
				arguments: _arguments,
			};
		}
	};
}

/**
 * Builds a form for editing a ScriptLine with addable/removable conditions and actions.
 * Returns an object with a get() method.
 */
function build_scriptline_form(parent: HTMLElement, initial?: ScriptLine, onRemove?: () => void) {
	const container = create_element(parent, "div", { class: "scriptline-form", style: "border:2px solid #333;padding:12px;margin:8px;border-radius:6px;background:#f9f9f9" });
	
	// Header with remove button
	const header = create_element(container, "div", { style: "display:flex;justify-content:space-between;margin-bottom:12px" });
	create_text_element(header, "h4", "Script Line");
	if (onRemove) {
		const removeBtn = create_text_element(header, "button", "Remove Line");
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
	
	const addCondBtn = create_text_element(container, "button", "+ Add Condition");
	(addCondBtn as HTMLButtonElement).addEventListener("click", () => {
		const condForm = build_condition_form(conditionsContainer);
		conditionForms.push(condForm);
	});
	container.appendChild(document.createElement("br"));
	
	// Actions section
	create_text_element(container, "h5", "Actions");
	const actionsContainer = create_element(container, "div", { class: "actions-list" });
	const actionForms: ReturnType<typeof build_action_form>[] = [];
	
	(initial?.actions ?? []).forEach(act => {
		const actForm = build_action_form(actionsContainer, act);
		actionForms.push(actForm);
	});
	
	const addActionBtn = create_text_element(container, "button", "+ Add Action");
	(addActionBtn as HTMLButtonElement).addEventListener("click", () => {
		const actForm = build_action_form(actionsContainer);
		actionForms.push(actForm);
	});
	container.appendChild(document.createElement("br"));
	
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
export function build_script_form(container: HTMLElement, shared: SharedData, initial?: Script): HTMLElement {
	const h3 = create_text_element(container, "h3", "Script Editor ");
	create_text_element(h3, "small", " v"+SCRIPTING_VERSION);
	if(initial) create_text_element(h3, "small", " ID: "+initial.id);

	const nameId = container.id+"_name";
	const nameLabel = create_text_element(container, "label", "Name:", { for: nameId });
	const nameInput = create_element(container, "input", { id: nameId, type: "text", value: initial?.name ?? "", class: "template-input" }) as HTMLInputElement;

	
	// ScriptLines section
	create_text_element(container, "h4", "Script Lines");
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
		const form = build_scriptline_form(lineElem, line, () => {
			linesForms.splice(linesForms.findIndex(f => f.form === form), 1);
			renderLines();
		});
		linesForms.push({ form, elem: lineElem });
	});
	
	renderLines();
	
	const addLineBtn = create_text_element(container, "button", "+ Add Script Line");
	(addLineBtn as HTMLButtonElement).addEventListener("click", () => {
		const lineElem = create_element(linesContainer, "div");
		const form = build_scriptline_form(lineElem, undefined, () => {
			linesForms.splice(linesForms.findIndex(f => f.form === form), 1);
			renderLines();
		});
		linesForms.push({ form, elem: lineElem });
		renderLines();
	});
	
	container.appendChild(document.createElement("br"));
	container.appendChild(document.createElement("br"));
	
	// Save button
	const saveBtn = create_text_element(container, "button", "Save Script", { style: "padding:8px 16px;font-weight:bold;background:#0a0;color:#fff;border:none;border-radius:4px;cursor:pointer" });
	(saveBtn as HTMLButtonElement).addEventListener("click", () => {
		const name = nameInput.value.trim();
		// name should not be empty and not contain any spaces
		if (name.length === 0 || name.includes(" ")) {
			nameInput.style.borderColor = "red";
			return;
		}
		nameInput.style.borderColor = "";
		
		const script: Script = {
			version: SCRIPTING_VERSION,
			id: initial?.id ?? shared.data.scripts.length +1,
			name: name,
			lines: linesForms.map(f => f.form.get())
		};
		(container as any).script = script;
	});
	
	return container;
}

/**
 * Builds a structured form for creating/editing a Trigger.
 * Parsed value is attached to the returned container as `.trigger`.
 */
export function build_trigger_form(parent: HTMLElement, shared: SharedData, initial?: Trigger): HTMLElement {
	const container = create_element(parent, "div", { class: "trigger-form", style: "border:3px solid #00f;padding:16px;border-radius:8px" });
	
	create_text_element(container, "h3", "Trigger Editor");
	
	// Basic properties
	const everyLabel = create_text_element(container, "label", "Execute every (ms, null for event-based):");
	const everyInput = create_element(container, "input", { type: "number", value: String(initial?.every ?? ""), style: "width:100%" }) as HTMLInputElement;
	container.appendChild(document.createElement("br"));
	container.appendChild(document.createElement("br"));
	
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
	container.appendChild(document.createElement("br"));
	container.appendChild(document.createElement("br"));
	
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