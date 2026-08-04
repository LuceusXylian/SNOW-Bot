import { MessageType, sendMessage } from "@/components/messaging";
import type { Logger } from "@/components/basics";


export enum ConditionType {
	IS = 0,
	IS_NOT = 1,
	CONTAINS = 2,
	CONTAINS_NOT = 3,
	EXISTS = 4,
	EXISTS_NOT = 5,
}
export function conditionType_toString(type: ConditionType) {
	switch (type) {
		case 0: return "IS";
		case 1: return "IS_NOT";
		case 2: return "CONTAINS";
		case 3: return "CONTAINS_NOT";
		case 4: return "EXISTS";
		case 5: return "EXISTS_NOT";
		default: return "UNKNOWN_ConditionType";
	}
} 

export enum ConditionTargetType {
	URL = 0,
	HOSTNAME = 1,
	/** Element must exist for the `Condition` to succeed */
	ELEMENT = 2,
	ELEMENT_ATTRIBUTE = 3,
	/** Check the value of a variable (local/global/persistent) */
	VARIABLE = 4,
}
export function conditionTargetType_toString(type: ConditionTargetType) {
	switch (type) {
		case 0: return "URL";
		case 1: return "HOSTNAME";
		case 2: return "ELEMENT";
		case 3: return "ELEMENT_ATTRIBUTE";
		case 4: return "VARIABLE";
		default: return "UNKNOWN_ConditionTargetType";
	}
} 

export interface ConditionTarget {
	target_type: ConditionTargetType,
	element_selector?: string
	attribute?: string
	variable_scope?: string
	variable_name?: string
}

export function testCondition(type: ConditionType, value1: string|null, value2: string): boolean {
	if (value1 === null) {
		if(type === ConditionType.EXISTS_NOT) return true;
		else return false;
	}

	switch (type) {
		case ConditionType.EXISTS: return true;
		case ConditionType.EXISTS_NOT: return false;
		case ConditionType.IS: return value1 === value2;
		case ConditionType.IS_NOT: return value1 !== value2;
		case ConditionType.CONTAINS: return value1.includes(value2);
		case ConditionType.CONTAINS_NOT: return !value1.includes(value2);
	}
	
	throw new Error("Unknown ConditionType:"+type);
}

export interface Condition {
	target: ConditionTarget
	type: ConditionType,
	string_value: string
}

export enum ActionKind {
	/** Run a script. Could be dangerous if a script is calling itself over and over again. */
	SCRIPT = 0,
	MESSAGE_TYPE = 1,
	NOTIFY = 2,
	WAIT = 3,
	SET_VARIABLE = 4,
	ASSIGN_VARIABLE_ELEMENT_ATTRIBUTE = 5,
	/** Runs a script per element found with the element selector */
	FOREACH_ELEMENT = 6,
	PLAY_AUDIO = 7,
	/** Opens a URL in a new tab or navigates the current tab */
	OPEN_URL = 8,
	/** Exits only the current script level */
	EXIT_CURRENT_SCRIPT = 9,
	/** Exits all script levels (current + callers) */
	EXIT_ALL_SCRIPTS = 10,
}

export enum ActionSetMethod {
	// Set string with optional ${VAR} variables
	STRING = 0,
	DATE_NOW_PLUS_DAYS = 1,
	TEMPLATE = 2,
}

export enum VariableScope {
	LOCAL = "local",
	GLOBAL = "global",
	PERSISTENT = "persistent",
}

export interface ActionType {
	name: string,
	kind: ActionKind,
	message_type?: MessageType
	/** Arguments can be predefined by Script or executed by Chat. 
	 *  If reference is set then we get automaticly a select with data from SharedData
	 *  we expect that the object has the `id` and `name` attributes. The expected value to return of the select is the argument.
	 */
	available_arguments: { argument: string, type: "text"|"number"|"textarea"|"select", required: boolean, use_set_method: boolean, reference?: "scripts"|"templates" }[]
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
		name?: string,
		value?: string,
		source?: string,
		target?: string,
		scope?: VariableScope,
		[key: string]: any,
		attribute?: string,
		event_type?: string,
		set_method?: ActionSetMethod;
	},
}

export const SCRIPTING_ACTIONS_TYPES: ActionType[] = [
	{
		name: "Script",
		kind: ActionKind.SCRIPT,
		available_arguments: [{argument: "id", type: "number", required: true, use_set_method: false, reference: "scripts"}]
	},
	{
		name: "InsertTemplate",
		kind: ActionKind.MESSAGE_TYPE,
		message_type: MessageType.INSERT_TEMPLATE,
		available_arguments: [{argument: "id", type: "text", required: true, use_set_method: false, reference: "templates"}, { argument: "element_selector", type: "text", required: true, use_set_method: false }]
	},
	{
		name: "Set Variable",
		kind: ActionKind.SET_VARIABLE,
		available_arguments: [
			{ argument: "scope", type: "text", required: true, use_set_method: false },
			{ argument: "name", type: "text", required: true, use_set_method: false },
			{ argument: "value", type: "textarea", required: true, use_set_method: true },
		],
	},
	{
		name: "Assign Variable from Element Attribute",
		kind: ActionKind.ASSIGN_VARIABLE_ELEMENT_ATTRIBUTE,
		available_arguments: [
			{ argument: "scope", type: "text", required: true, use_set_method: false },
			{ argument: "name", type: "text", required: true, use_set_method: false },
			{ argument: "element_selector", type: "text", required: true, use_set_method: false },
			{ argument: "attribute", type: "text", required: true, use_set_method: false },
		],
	},
	{
		name: "SetElementAttribute",
		kind: ActionKind.MESSAGE_TYPE,
		message_type: MessageType.SET_ELEMENT_ATTRIBUTE,
		available_arguments: [
			{ argument: "element_selector", type: "text", required: true, use_set_method: false },
			{ argument: "attribute", type: "text", required: true, use_set_method: false },
			{ argument: "value", type: "text", required: false, use_set_method: true },
		]
	},
	{
		name: "TriggerElementEvent",
		kind: ActionKind.MESSAGE_TYPE,
		message_type: MessageType.TRIGGER_ELEMENT_EVENT,
		available_arguments: [
			{ argument: "element_selector", type: "text", required: true, use_set_method: false },
			{ argument: "event_type", type: "text", required: true, use_set_method: false },
		]
	},
	{
		name: "Notification",
		kind: ActionKind.NOTIFY,
		available_arguments: [{argument: "value", type: "text", required: true, use_set_method: false}]
	},
	{
		name: "Play Audio",
		kind: ActionKind.PLAY_AUDIO,
		available_arguments: [{argument: "source", type: "text", required: false, use_set_method: false}]
	},
	{
		name: "Wait",
		kind: ActionKind.WAIT,
		available_arguments: [{argument: "seconds", type: "number", required: true, use_set_method: false}]
	},
	{
		name: "Execute Per Element",
		kind: ActionKind.FOREACH_ELEMENT,
		available_arguments: [
			{ argument: "element_selector", type: "text", required: true, use_set_method: false },
			{ argument: "id", type: "text", required: true, use_set_method: false, reference: "scripts" },
		],
	},
	{
		name: "Open URL",
		kind: ActionKind.OPEN_URL,
		available_arguments: [
			{ argument: "url", type: "text", required: true, use_set_method: false },
			{ argument: "new_tab", type: "select", required: false, use_set_method: false },
		],
	},
	{
		name: "Exit current Script",
		kind: ActionKind.EXIT_CURRENT_SCRIPT,
		available_arguments: [],
	},
	{
		name: "Exit all Scripts",
		kind: ActionKind.EXIT_ALL_SCRIPTS,
		available_arguments: [],
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

export interface ForeachContext {
	foreach_selector: string;
	foreach_index: number;
}

// Send message from popup to background to start a script
export function execute_script(LOGGER: Logger, SESSION_ID: number, script_id: string) {
	return sendMessage(LOGGER, { type: MessageType.EXECUTE_SCRIPT, data: {
		session_id: SESSION_ID, script_id: script_id
	}});
}