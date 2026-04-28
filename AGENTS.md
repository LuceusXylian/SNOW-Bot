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
    - synchronize data between "popup/main.ts" and "content.ts". if "popup/main.ts" sends data to update then "background.ts" passes it to "content.ts" and vice versa.

- "popup/main.ts" the controller UI
    - sends commands to "background.ts", which will then be relayed to "content.ts"
	- create "bot_id" on GET_STATE (ONLY FOR content) and save which tab it is, so we can send commands to it later

- "content.ts" the bot
    - send request to "background.ts" await data

## Already implemented
- "background.ts" the comstation
    - it saves data to localStorage
    - it sets the defaults
    - it provides/saves data on request from "popup/main.ts" and "content.ts"

- "popup/main.ts" the controller UI
    - send request to "background.ts" await data
    - sends commands to "background.ts", which will then be relayed to "content.ts"

- "content.ts" the bot
    - send request to "background.ts" await data