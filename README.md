# SNOW-Bot
SNOW Bot is a browser extension that gets you notifications and half-automate your workflow


## Features
- Toggle active state
- Templates
	- Able to create templates from popup
	- "Execute insert" resolves shortcodes from input labels and insert text into textarea/input
- [ ] Scripting for custom (half) automations
	- Script
		- executed on background, sends commands to content
		- reports progress to popup
		- Conditions
			- IS, IS NOT, CONTAINS, CONTAINS NOT
			- domain/URL checks
			- Element checks
			- [] Element attribute checks
		- [ ] Actions
			- Templates: execute insert
			- [ ] Send notifications
			- [ ] Wait
	- [ ] Triggers
		- On Conditions met notify background
		- [ ] execute Script on user interactions
		- [ ] execute Script every x seconds
	- [ ] Half automation for returns
		- give the bot the serial number and it will guide you through the return process
- [ ] Chat UI to send commands and receive responses
- [ ] Popup section: ButtonGrid
- Popup navigation with location.hash
	- if empty it uses persistant stored value
- [ ] After all above is implemented, we create a action which executes multiple InsertTemplate actions on diffrent inputs/textareas 

## Devtools requirements
- nodejs: https://nodejs.org/en/download/current
- pnpm: https://pnpm.io/installation#on-posix-systems

about:debugging#/runtime/this-firefox