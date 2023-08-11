function debug(params) {
    console.log("[snow-bot-front.js]", params);
}
debug("start");
function debug_and_sendResponse(params, sendResponse) {
	debug(params);
	sendResponse(params);
}

var shared;
chrome.storage.local.get(["active"], (result) => {
    shared = result;
});


// Receive message from snow-bot-back
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("snow-bot-front.js - Recv. message", message);

	if (!shared.active) {
		debug_and_sendResponse("[ERROR] SNOW-BOT is disabled!", sendResponse);
		return false;
	}

	switch (message.action) {
		case "disable": kill_all_tasks(sendResponse); break;
		case "site_open": site_open(params, sendResponse); break;

		default: 
			debug_and_sendResponse("[ERROR] UNKNOWN ACTION: " + message.action);
			return false;
	}

	return true;
});


function kill_all_tasks(sendResponse) {
	debug_and_sendResponse("[INFO] all tasks killed", sendResponse);
}

function site_open(params, sendResponse) {
	debug("site_open");
	if (typeof params.url === "string") {
		window.location.href = params.url;
		sendResponse("OK");
	} else {
		debug_and_sendResponse("[ERROR] params.href is not a string", sendResponse);
	}
}