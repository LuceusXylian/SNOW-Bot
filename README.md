# SNOW-Bot
SNOW Bot is a browser extension that gets you notifications and half-automate your workflow


## Features
- Toggle active state
- Templates
	- Able to create templates from popup
	- "Execute insert" resolves shortcodes from input labels and insert text into textarea/input
- Scripting for custom (half) automations
	- Script
		- executed on background, sends commands to content
		- reports progress to popup
		- Conditions
			- IS, IS NOT, CONTAINS, CONTAINS NOT
			- Hostname/URL checks
			- Element checks
			- Element attribute checks
		- Actions
			- Templates: execute insert
			- Set element attribute, including "value" for formcontrols
			- Trigger element events
			- Send notifications
			- Wait
			- Foreach Element do Actions
	- Triggers
		- On Conditions met notify background
		- execute Script on user interactions
		- execute Script every x seconds
	- Variables
		- local - Variable exists for Script
		- global - Variable exists for all Scripts
		- peristant - Variable exists for all Script and is saved to peristant storage
	- [ ] Half automation for returns
		- give the bot the serial number and it will guide you through the return process
- Chat UI to send commands and receive responses
- ButtonGrid: customizable Script launcher
- Popup navigation with location.hash
	- if empty it uses persistant stored value

## Permissions
- `notifications` — Required to show native OS notification popups.
- Storage, tabs, web navigation, etc. — See `wxt.config.ts` for the full list.

## Devtools requirements
- nodejs: https://nodejs.org/en/download/current
- pnpm: https://pnpm.io/installation#on-posix-systems

about:debugging#/runtime/this-firefox