# SNOW Bot

SNOW Bot is a browser extension built with the WXT framework. It uses `@wxt-dev/runtime` for message passing between the popup, background, and content scripts.

## Key principles for agents

- Keep changes minimal and focused.
- Respect the extension message flow: popup ↔ background ↔ content.
- Do not overwrite storage or state globally unless explicitly required.
- Follow the existing style rules and use 4-space indentation.

## Project structure

- `components/` — shared helper modules
    - `basics.ts`
    - `client.ts`
    - `constants.ts`
    - `messaging.ts`
    - `ui.ts`
    - `scripting.ts`
- `entrypoints/`
    - `popup/`
        - `index.html`
        - `main.ts`
        - `style.css`
        - `chat_ui.ts`
    - `background.ts`
    - `content.ts`
- `public/`

## Architecture overview

### `background.ts`

The background script is the communication hub and state manager.

Responsibilities:
- Store persistent shared state in `localStorage`.
- Maintain a limited log history for the popup.
- Relay commands between popup and content scripts.
- Track the active bot instance with `bot_id` and tab information.

### `popup/main.ts`

The popup UI controls the bot and displays state.

Responsibilities:
- Request current state from the background script.
- Render templates and shared data.
- Send user actions and command requests to the background.

### `content.ts`

The content script acts as the bot agent on the page.

Responsibilities:
- Track `lastFocusedElement` (`<input>`, `<textarea>`, `<select>`).
- Receive command messages from background and execute them in the page context.
- Query page elements, resolve template values, and insert text.

## Supported workflow

### Template insertion

The content bot must:
1. Parse `text_template` for shortcodes using the regex `/\[(.+?)\]/g`.
2. For each shortcode:
    - Search the page for a `<label>` whose text contains the shortcode label. 
	  Then get the Element which is linked in the label `for` attribute and get its value.
    - If unresolved, prompt the user for input.
3. Insert the resolved values into the `lastFocusedElement`.

### Logging and state sync

- Background stores and returns shared state on demand.
- Popup requests and renders this state.
- Content uses background requests to get current templates and settings.
- SharedData updates from popup are forwarded by background to content.

## Current implementation status

### `background.ts`

Implemented:
- Saves shared data to `localStorage`.
- Initializes default configuration values.
- Handles requests from both popup and content.
- Creates `bot_id` on `GET_STATE` for content and stores the active tab.
- Provides `BotCommander` send/relay abstraction.
- Forwards shared data updates from popup to content.
- Implements text template UI support: create, edit, delete, and execute.

### `popup/main.ts`

Implemented:
- Requests state from background and waits for data.
- Sends commands to background for relay to content.

### `content.ts`

Implemented:
- Tracks the last focused input element.
- Requests data from background when needed.
- Responds to `insert_template` commands.
