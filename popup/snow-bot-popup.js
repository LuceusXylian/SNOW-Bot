console.log("snow-bot-popup.js");
function debug(params) {
    console.log("[snow-bot-popup.js]", params);
}

var shared;
chrome.storage.local.get(["active"], (result) => {
    shared = result;
    set_active_toggler_state(shared.active);
});

function sendAction(action, params, response_handler) {
    chrome.runtime.sendMessage({ action: action, params: params }, response_handler);
}


// Active Toggler
const active_toggler = document.getElementById("active-toggler");

function set_active_toggler_state(_active) {
    shared.active = _active;

    if (_active) {
        active_toggler.classList.add("active");
        active_toggler.title = "Bot is running";
    } else {
        active_toggler.classList.remove("active");
        active_toggler.title = "Bot is disabled";
    }
    
    debug(shared)
}

active_toggler.addEventListener("click", () => {
    set_active_toggler_state(!shared.active);

    if (shared.active) {
        sendAction("activate", null, () => {});
    } else {
        sendAction("disable", null, () => {});
    }
});


// Menu
const header = document.getElementById("header");
const controller_goback = document.getElementById("controller-goback");
const menu = document.getElementById("menu");
const menu_items = document.getElementsByClassName("menu-item");
var menu_item_selected = null;

for (let i = 0; i < menu_items.length; i++) {
    const item = menu_items[i];
    item.addEventListener("click", () => {
        if (menu_item_selected === null) {
            menu.classList.add("deeper");
            item.classList.add("selected");
            header.classList.remove("goback-hidden");
            menu_item_selected = item;
        }
    });
}


controller_goback.addEventListener("click", () => {
    if (menu_item_selected !== null) {
        menu.classList.remove("deeper");
        menu_item_selected.classList.remove("selected");
        header.classList.add("goback-hidden");
        menu_item_selected = null;
    }
});


// Serialnumbers
const serialnumbers_textarea = document.getElementById("serialnumbers-textarea");
const serialnumbers_submit = document.getElementById("serialnumbers-submit");

serialnumbers_submit.addEventListener("click", () => {
    sendAction("serialnumbers", { serialnumbers: serialnumbers_textarea.value.trim() });
});