# SNOW Bot
is a web browser extension that uses the WXT framework.
For communication between popup, background and content we use @wxt-dev/runtime.

## Compliance
- 4 tab size indentation
- no overwrite all, because we excpect multiple bot threads

## Project structure
- components (use for shared fuctions)
	- basics.ts
	- client.ts
	- constants.ts
	- messaging.ts
- entry points
    - popup (the controller UI)
        - index.html
        - main.ts
        - style.css
    - background.ts
    - content.ts

## Goals
- "background.ts" the comstation
	- save informative logs and provice them to popup
		- max 100 entries (save 100 in constant.ts)

- "popup/main.ts" the controller UI

- "content.ts" the bot
	- receive command insert_template
		- text_template can contain shortcodes, regex: "[(.+)]"
			1. autosearch on page for any "label" with the "captured inner content", follow span.label-text.innerText
			2. same parent as elemt of 1. but it is previous element
			3. at last, if not found/value is null/undefined then prompt user for value

## Already implemented
- "background.ts" the comstation
    - it saves data to localStorage
    - it sets the defaults
    - it provides/saves data on request from "popup/main.ts" and "content.ts"
	- create "bot_id" on GET_STATE (ONLY FOR content) and save which tab it is, so we can send commands to it later
	- BotCommander: abstraction for commands
	    - sends commands to "background.ts", which will then be relayed to "content.ts"
    - if "popup/main.ts" uses SharedData update methods then "background.ts" passes these to "content.ts"
	- text_template UI
		- create new templates which are plaintext. use textarea
		- table with actions: edit, delete, execute command insert_template

- "popup/main.ts" the controller UI
    - send request to "background.ts" await data
    - sends commands to "background.ts", which will then be relayed to "content.ts"

- "content.ts" the bot
    - lastFocusedElement: remember last focused input/textarea/select
    - send request to "background.ts" await data