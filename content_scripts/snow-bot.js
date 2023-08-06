console.log("snow-bot.js");
var shared;
chrome.storage.local.get(["active"], (result) => {
    shared = result;
    set_active_toggler_state(shared.active);
});

function debug(params) {
    console.log("snow-bot.js", params);
}

// Receive message from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("snow-bot.js - Recv. message", message);

	switch (message.action) {
		case "activate": set_active(true); sendResponse(true); break;
		case "disable": set_active(false); sendResponse(true); break;
		case "site_open": site_open(params, sendResponse); break;

		default: sendResponse("UNKNOWN ACTION: " + message.action); break;
	}

	return true;
});

function set_active(is_active) {
	shared.active = is_active;
}

function site_open(params, sendResponse) {
	
}