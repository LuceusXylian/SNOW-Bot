import { MessageType, sendMessage } from "@/components/messaging";
import { ScriptingUI } from "@/entrypoints/popup/scripting_ui";


export enum ConditionType {
	IS = 0,
	IS_NOT = 1,
	CONTAINS = 2,
	CONTAINS_NOT = 3,
	EXISTS = 4,
}

export enum ConditionTargetType {
	URL = 0,
	DOMAIN = 1,
	/** Element must exist for the `Condition` to succeed */
	ELEMENT = 2,
	ELEMENT_ATTRIBUTE = 3,
}

export interface ConditionTarget {
	target_type: ConditionTargetType,
	element_selector?: string
	attribute?: string
}

export interface Condition {
	target: ConditionTarget
	type: ConditionType,
	static_value: string
}

export enum ActionKind {
	/** Run a script. Could be dangerous if a script is calling itself over and over again. */
	SCRIPT = 0,
	MESSAGE_TYPE = 1,
	NOTIFY = 2,
	WAIT = 3,
}

export interface ActionType {
	name: string,
	kind: ActionKind,
	message_type?: MessageType
	/** Arguments can be predefined by Script or executed by Chat. 
	 *  If reference is set then we get automaticly a select with data from SharedData
	 *  we expect that the object has the `id` and `name` attributes. The expected value to return of the select is the argument.
	 */
	available_arguments: { argument: string, type: "text"|"number", required: boolean, reference?: "scripts"|"templates" }[]
}

export interface Reference {
	id: string,
	name: string,
}

export interface Action {
	type: ActionType,
	arguments: {
		element_selector?: string,
		id?: string,
		text?: string,
		seconds?: number,
	},
}

export const SCRIPTING_ACTIONS_TYPES: ActionType[] = [
	{
		name: "Script",
		kind: ActionKind.SCRIPT,
		available_arguments: [{argument: "id", type: "number", required: true, reference: "scripts"}]
	},
	{
		name: "InsertTemplate",
		kind: ActionKind.MESSAGE_TYPE,
		message_type: MessageType.INSERT_TEMPLATE,
		available_arguments: [{argument: "id", type: "text", required: true, reference: "templates"}, { argument: "element_selector", type: "text", required: true }]
	},
	{
		name: "Notification",
		kind: ActionKind.NOTIFY,
		available_arguments: [{argument: "text", type: "text", required: true}]
	},
	{
		name: "Wait",
		kind: ActionKind.WAIT,
		available_arguments: [{argument: "seconds", type: "number", required: true}]
	},
];

export interface ScriptLine {
	/** empty array means that it has no conditions and it will always execute the actions */
	conditions: Condition[],
	actions: Action[],
}

export interface Script {
	version: number,
	id: string,
	name: string,
	lines: ScriptLine[],
}

/** listens on all document.querySelectorAll(element_selector) */
export interface TriggerEvent {
	element_selector: string,
	event_type: string,
}

export interface Trigger {
	id: string,
	name: string,
	script_id: string,
	/** triggers on any event */
	events: TriggerEvent[],
	/** triggers every x seconds using setInterval */
	every: number|null,
	/** Additinal conditions before executing script */
	conditions: Condition[],
}

// Send message from popup to background to start a script
export function execute_script(self: ScriptingUI, script_id: string) {
	return sendMessage(self.LOGGER, { type: MessageType.EXECUTE_SCRIPT, data: {
		session_id: self.SESSION_ID, script_id: script_id
	}});
}