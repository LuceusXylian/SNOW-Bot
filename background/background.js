console.log("snow-bot-controller.js");
var shared;
chrome.storage.local.get(["active"], (result) => {
    shared = result;
    set_active_toggler_state(shared.active);
});

function debug(params) {
    console.log("snow-bot-controller.js", params);
}

function sendAction(action, params, response_handler) {
    chrome.runtime.sendMessage({ action: action, params: params }, response_handler);
}

const active_toggler = document.getElementById("active-toggler");

function set_active_toggler_state(_active) {
    console.log("set_active_toggler_state active", _active);
    shared.active = _active;

    if (_active) {
        active_toggler.classList.add("active");
        active_toggler.title = "Bot is running";

        sendAction("activate", null, () => {});
    } else {
        active_toggler.classList.remove("active");
        active_toggler.title = "Bot is disabled";

        sendAction("disable", null, () => {});
    }
    
    debug(shared)
}

active_toggler.addEventListener("click", () => {
    set_active_toggler_state(!shared.active);
});

