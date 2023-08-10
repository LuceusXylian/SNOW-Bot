console.log("snow-bot-back.js");
function debug(params) {
    console.log("[snow-bot-back.js]", params);
}
function debug_and_sendResponse(params, sendResponse) {
	debug(params);
	sendResponse(params);
}

var shared;
chrome.storage.local.get(["active"], (result) => {
    shared = result;
});

// shared default data handler
if (typeof shared === "undefined") {
    shared = { active: true };
    chrome.storage.local.set(shared);
}


function sendAction(action, params, response_handler) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, { action: action, params: params }, response_handler);  
	});
}

// Receive message from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("snow-bot-back.js - Recv. message", message);

	switch (message.action) {
		case "activate": set_active(true); sendResponse(true); break;
		case "disable": set_active(false); sendResponse(true); break;
		case "serialnumbers": serialnumbers(params, sendResponse); break;

		default: sendResponse("UNKNOWN ACTION: " + message.action); break;
	}

	return true;
});

function set_active(_active) {
    shared.active = _active;
	chrome.storage.local.set(shared);
}

function serialnumbers(params, sendResponse) {
    
}