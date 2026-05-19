import { Message } from "@/components/messaging";


export enum ConditionType {
	IS = 0,
	IS_NOT = 1,
	CONTAINS = 2,
	CONTAINS_NOT = 3,
}

export enum ConditionTargetType {
	URL = 0,
	DOMAIN = 1,
	/** Element must exist for the `Condition` to succeed */
	ELEMENT = 2,
}

export interface ConditionTarget {
	target_type: ConditionTargetType,
	element_selector?: string
}

export interface Condition {
	target: ConditionTarget
	type: ConditionType,
	static_value: string
}

export interface ActionType {
	type: MessageType,
}

export interface Action {
	action_type: ActionType,
	script_id?: number,
	message?: Message,
}

export interface ScriptLine {
	/** empty array means that it has no conditions and it will always execute the actions */
	conditions: Condition[],
	actions: Action[],
}

export interface Script {
	version: number,
	id: number,
	lines: ScriptLine[],
}

export interface Trigger {
	conditions: Condition[],
	/** triggers every x nanoseconds using setInterval */
	every: number|null
}