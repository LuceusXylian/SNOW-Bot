// Storage keys
export const KEY_SHARED_DATA = 'local:snow_bot_shared_data';
export const KEY_POPUP_MENU_INDEX = 'local:snow_bot_menu_index';
export const LS_KEY_LOGS = 'local:snow_bot_logs';

// Defaults
export const DEFAULT_ACTIVE = false;
export const DEFAULT_ALLOW_PROMPT = true;
export const DEFAULT_PASTE_CLEANER_ENABLED = true;
export const DEFAULT_ALLOW_ALERT_NOTIFY = true;
export const DEFAULT_NOTIFY_SOUND_ENABLED = true;
export const DEFAULT_NOTIFY_SOUND_SOURCE = "beep";
export const DEFAULT_NOTIFY_SPEAKER_DEVICE = "default";
export const DEFAULT_DATETIME_LOCALE = "de_DE";

export const BUNDLED_SOUNDS = [
    { id: "beep",      name: "Beep",                         type: "beep" },
    { id: "frostpunk", name: "Work To Do (Frostpunk)",       type: "file", path: "/frostpunk_work_to_do.mp3" },
] as const;

// Misc
export const APP_NAME: string = "SNOW Bot";
export const MAX_LOG_ENTRIES: number = 100;
export const SCRIPTING_VERSION: number = 1;
export const IS_POPUP_QUERY_STRING: string = "?is_popup=0";
export const TRIGGER_COOLDOWN: number = 1000;
export const TRIGGER_SESSION_ID: number = -3;