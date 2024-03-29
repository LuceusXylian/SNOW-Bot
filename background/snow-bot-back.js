function debug(params) {
    console.log("[snow-bot-back.js]", params);
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

// shared default data handler
if (typeof shared === "undefined") {
    shared = { active: true };
    chrome.storage.local.set(shared);
}


function sendAction(action, params, response_handler) {
	debug("[sendAction] "+action+" "+JSON.stringify(params));
	
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		chrome.tabs.sendMessage(tabs[0].id, { action: action, params: params }, response_handler);
	});
}

// Receive message from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("snow-bot-back.js - Recv. message", message);


	switch (message.action) {
		case "activate": set_active(true); sendResponse(true); break;
		case "disable": set_active(false); sendResponse(true); break;
		case "serialnumbers": action_serialnumbers(params, sendResponse); break;

		default: sendResponse("UNKNOWN ACTION: " + message.action); break;
	}

	return true;
});

function set_active(_active) {
    shared.active = _active;
	chrome.storage.local.set(shared);
	if (!_active) {
		sendAction("disable", {}, ()=>{})
	}
}

function action_serialnumbers(params, sendResponse) {
	debug("action_serialnumbers");
	
	if (typeof params.serialnumbers !== "string") {
		debug_and_sendResponse("[ERROR] params.serialnumbers is not a string");
	} else {
		const serialnumber = params.serialnumbers.split("\n")[0].trim();
		sendAction("site_open", { url: "https://siam.service-now.com/nav_to.do?uri=%2Falm_hardware_list.do%3Fsysparm_query%3Dserial_number%253D"+ serialnumber });
	}

	sendResponse(true);
	return true;
}

action_serialnumbers({serialnumbers: "AAAAAAAABBBBCCC1111"}, () => {})