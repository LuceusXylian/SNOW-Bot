import type { Trigger, TriggerEvent, Condition, ConditionGroup } from "@/components/scripting";
import { MessageType, sendMessage } from "@/components/messaging";
import { BotCommander, Logger, SharedData } from "@/components/basics";
import { alert_modal, create_element, create_text_element, create_formcontrol } from "@/components/ui";
import { ScriptingUI } from "./scripting_ui";

export class TriggersUI extends ScriptingUI {
	constructor(shared: SharedData, LOGGER: Logger, COMMANDER: BotCommander) {
		super(shared, LOGGER, COMMANDER);
	}

	build_triggers_list(parent: HTMLElement) {
		const new_spoiler = create_element(parent, "div", { class: "spoiler-container" });
		const new_spoiler_title = create_text_element(new_spoiler, "div", "Create new Trigger", { class: "spoiler-title" });
		const new_spoiler_content = create_element(new_spoiler, "div", { class: "spoiler-content" });
		add_spoiler_event(new_spoiler);
		new_spoiler_content.style.padding = "1rem";
		this.build_trigger_editor_form(new_spoiler_content, () => { render_trigger_list(); new_spoiler.classList.remove("active"); });

		const edit_spoiler = create_element(parent, "div", { class: "spoiler-container active", style: "display: none;" });
		const edit_spoiler_title = create_text_element(edit_spoiler, "div", "Edit Trigger", { class: "spoiler-title" });
		const edit_spoiler_content = create_element(edit_spoiler, "div", { class: "spoiler-content" });
		edit_spoiler_content.style.padding = "1rem";

		const table = create_element(parent, "table", { class: "table" });
		const thead = create_element(table, "thead");
		const thead_tr = create_element(thead, "tr");
		create_text_element(thead_tr, "th", "Name");
		create_text_element(thead_tr, "th", "Script");
		create_text_element(thead_tr, "th", "Events / Interval");
		create_text_element(thead_tr, "th", "Actions", { style: "width: 220px;" });
		const tbody = create_element(table, "tbody");

		const render_trigger_list = () => {
			tbody.innerHTML = "";
			const triggers = this.shared.data.triggers;
			if (triggers.length === 0) {
				tbody.innerHTML = '<tr><td colspan="4">No triggers yet</td></tr>';
				return;
			}

			for (const trigger of triggers) {
				const row = create_element(tbody, "tr");
				create_text_element(row, "td", trigger.name);
				const scriptName = this.shared.data.scripts.find((script) => script.id === trigger.script_id)?.name || "Unknown";
				create_text_element(row, "td", scriptName);
				const details = create_element(row, "td");
				create_text_element(details, "div", trigger.events.map((event) => `${event.event_type}: ${event.element_selector}`).join(" \n") || "No events", { style: "white-space: pre-line;" });
				create_text_element(details, "div", `Interval: ${trigger.every? trigger.every+" sec" : "NONE"}`);

				const actions = create_element(row, "td");
				create_text_element(actions, "button", "Edit", { class: "btn-edit" }).addEventListener("click", () => {
					new_spoiler.style.display = "none";
					edit_spoiler.style.display = "";
					edit_spoiler_content.innerHTML = "";
					this.build_trigger_editor_form(edit_spoiler_content, () => {
						new_spoiler.style.display = "";
						new_spoiler.classList.remove("active");
						edit_spoiler.style.display = "none";
						render_trigger_list();
					}, trigger);
					scroll(0, 0);
				});
				create_text_element(actions, "button", "Delete", { class: "btn-delete" }).addEventListener("click", async () => {
					this.shared.applyStateChange({ triggers: this.shared.data.triggers.filter((item) => item.id !== trigger.id) });
					render_trigger_list();
				});
				create_text_element(actions, "button", "Run now", { class: "btn-insert" }).addEventListener("click", async () => {
					await sendMessage(this.LOGGER, {
						type: MessageType.TRIGGER_FIRED,
						data: { focus_bot: true, trigger_id: trigger.id }
					});
				});
			}
		};

		render_trigger_list();
	}

	build_trigger_editor_form(parent: HTMLElement, on_set: () => void, initial?: Trigger) {
		const nameInput = create_formcontrol(parent, "text", "trigger_name", "Trigger Name", { value: initial?.name ?? "", required: true, class: "fc-container-3" });
		const scriptOptions = this.shared.data.scripts.map((script) => ({ value: script.id, title: script.name }));
		const scriptSelect = create_formcontrol(parent, "select", "script_id", "Script", { value: initial?.script_id ?? "", required: true, options: scriptOptions, class: "fc-container-3" });
		const everyInput = create_formcontrol(parent, "number", "every_seconds", "Interval seconds (optional)", { value: initial?.every?.toString() ?? "", class: "fc-container-3" });

		create_text_element(parent, "h5", "Events");
		const eventsContainer = create_element(parent, "div");
		const eventForms: Array<{ get: () => TriggerEvent; elem: HTMLElement }> = [];

		const addEvent = (value?: TriggerEvent) => {
			const form = this.build_event_form(eventsContainer, value);
			eventForms.push(form);
		};

		(initial?.events ?? [{ event_type: "click", element_selector: "" }]).forEach((event) => addEvent(event));
		create_text_element(parent, "button", "+ Add Event", { class: "fc fc-small", style: "margin-top: 1rem;" }).addEventListener("click", () => addEvent());

		create_text_element(parent, "h5", "Conditions");
		const conditionsContainer = create_element(parent, "div");
		const groupForms: Array<{ get: () => ConditionGroup; add: (condition?: Condition) => void }> = [];
		const addGroup = (initialGroup?: ConditionGroup) => {
			const groupContainer = create_element(conditionsContainer, "div", { style: "border:1px solid #777;padding:8px;margin:8px 0;" });
			create_text_element(groupContainer, "strong", groupForms.length === 0 ? "All of these conditions" : "OR group");
			const conditionForms: Array<{ get: () => Condition; elem: HTMLElement }> = [];
			const group = { get: () => ({ conditions: conditionForms.map(form => form.get()) }), add: (condition?: Condition) => {
				const form = this.build_condition_form(groupContainer, condition);
				conditionForms.push(form);
				groupContainer.appendChild(form.elem);
			} };
			groupForms.push(group);
			conditionsContainer.appendChild(groupContainer);
			(initialGroup?.conditions ?? []).forEach(condition => group.add(condition));
		};
		(initial?.conditionGroups ?? []).forEach(group => addGroup(group));
		if (groupForms.length === 0) addGroup();
		create_text_element(parent, "button", "+ Add Condition", { class: "fc fc-small", style: "margin-top: 1rem;" }).addEventListener("click", () => groupForms[groupForms.length - 1]!.add());
		create_text_element(parent, "button", "+ Add OR Group", { class: "fc fc-small", style: "margin-top: 1rem; margin-left: .5rem;" }).addEventListener("click", () => addGroup());

		const saveBtn = create_text_element(parent, "button", "Save Trigger", { class: "fc", style: "margin-top: 1.5rem;" });
		saveBtn.addEventListener("click", async () => {
			const name = nameInput.value.trim();
			if (!name) {
				nameInput.style.borderColor = "red";
				alert_modal("Trigger name is required.");
				return;
			}
			nameInput.style.borderColor = "";

			if (!scriptSelect.value) {
				scriptSelect.style.borderColor = "red";
				alert_modal("Please select a script for this trigger.");
				return;
			}
			scriptSelect.style.borderColor = "";

			const events = eventForms
				.filter((form) => parent.contains(form.elem))
				.map((form) => form.get())
				.filter((event) => event.event_type && event.element_selector);
			const conditionGroups = groupForms.map((form) => form.get());
			const everyValue = everyInput.value.trim();
			const every = everyValue.length ? Number(everyValue) : null;

			if (events.length === 0 && (every === null || every <= 0)) {
				alert_modal("A trigger must define at least one event or an interval.");
				return;
			}

			const trigger: Trigger = {
				id: initial?.id ?? `TRG${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
				name,
				script_id: scriptSelect.value,
				events,
				every: every !== null && !Number.isNaN(every) && every > 0 ? every : null,
				conditionGroups,
			};

			const existing = this.shared.data.triggers.findIndex((item) => item.id === trigger.id);
			const triggers = [...this.shared.data.triggers];
			if (existing >= 0) {
				triggers[existing] = trigger;
			} else {
				triggers.push(trigger);
			}

			await this.shared.applyStateChange({ triggers });
			on_set();
		});
	}

	build_event_form(parent: HTMLElement, initial?: TriggerEvent) {
		const container = create_element(parent, "div", { class: "fc-container", style: "border:1px solid #ccc;padding:8px;margin:8px 0;border-radius:6px;" });
		const eventType = create_formcontrol(container, "select", "event_type", "Event Type", {
			class: "fc-container-3",
			value: initial?.event_type ?? "click",
			options: [
				{ title: "click", value: "click" },
				{ title: "change", value: "change" },
				{ title: "input", value: "input" },
				{ title: "submit", value: "submit" },
				{ title: "focus", value: "focus" },
				{ title: "blur", value: "blur" },
			],
			required: true,
		});
		const {col_container, get_element_selector_list} = this.create_element_selector_fc(container, initial?.element_selector ?? "");
		
		const removeBtn = create_text_element(container, "button", "Remove", { class: "btn-delete", style: "margin-top: 0.75rem;" });
		removeBtn.addEventListener("click", () => {
			container.remove();
		});

		return {
			elem: container,
			get(): TriggerEvent {
				return {
					event_type: eventType.value,
					element_selector: get_element_selector_list(),
				};
			}
		};
	}
}
