console.log("snow-bot-front.js");
function debug(params) {
    console.log("[snow-bot-front.js]", params);
}
function debug_and_sendResponse(params, sendResponse) {
	debug(params);
	sendResponse(params);
}

var shared;
chrome.storage.local.get(["active"], (result) => {
    shared = result;
    set_active_toggler_state(shared.active);
});


// Receive message from snow-bot-back
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("snow-bot.js - Recv. message", message);

	if (!shared.active) {
		debug_and_sendResponse("[ERROR] SNOW-BOT is disabled!");
		return false;
	}

	switch (message.action) {
		case "site_open": site_open(params, sendResponse); break;

		default: 
			debug_and_sendResponse("[ERROR] UNKNOWN ACTION: " + message.action);
			return false;
	}

	return true;
});


function site_open(params, sendResponse) {
	if (typeof window.location.href === "string") {
		window.location.href = params.href;
		sendResponse("OK");
	} else {
		debug_and_sendResponse("[ERROR] params.href is not a string");
	}
}