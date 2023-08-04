function debug(params) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "debug", params: params }, (_response) => {});
    });
}

var active = localStorage.getItem("SNOW-BOT-ACTIVE") === "1";
const active_toggler = document.getElementById("active-toggler");

function set_active_toggler_state(_active) {
    console.log("set_active_toggler_state active", _active);

    active = _active;
    localStorage.setItem("SNOW-BOT-ACTIVE", _active? "1" : "0");

    if (_active) {
        active_toggler.classList.add("active");
        active_toggler.title = "Bot is running";

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "activate" }, (_response) => {});
        });
    } else {
        active_toggler.classList.remove("active");
        active_toggler.title = "Bot is disabled";

        chrome.tabs.query({ active: false, currentWindow: true }, (tabs) => {
            for (let i = 0; i < tabs.length; i++) {
                chrome.tabs.sendMessage(tabs[i].id, { action: "disable" }, (_response) => {});
            }
        });

        debug("test")
    }
    

}

setTimeout(function() { set_active_toggler_state(active); }, 1);

active_toggler.addEventListener("click", () => {
    set_active_toggler_state(!active);
});

