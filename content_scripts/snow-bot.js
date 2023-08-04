console.log("snow-bot.js");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("Recv. message", message);

	switch (message.action) {
		case "debug": console.debug("SNOW-BOT DEBUG", message.params); break;
		case "active": localStorage.setItem("SNOW-BOT-ACTIVE", "1"); break;
		case "disable": localStorage.setItem("SNOW-BOT-ACTIVE", "0"); break;

		default:
		break;
	}

	sendResponse("OK");
	return true;
});