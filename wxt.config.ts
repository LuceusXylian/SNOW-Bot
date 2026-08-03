import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
	manifest: {
		name: "SNOW Bot",
		permissions: [
			"activeTab",
			"dns",
			"menus",
			"privacy",
			"storage",
			"tabs",
			"contextMenus",
			"unlimitedStorage",
			"webNavigation",
			"webRequest",
			"notifications",
			"<all_urls>"
		],
		host_permissions: ["<all_urls>"],
		browser_specific_settings: {
			gecko: {
				"id": "@snow-bot",
				data_collection_permissions: {
					required: ["none"]
				}
			}
		}
	},
	webExt: {
		binaries: {
			win_chrome: "C:\\chromium\\chrome.exe"
		}
	},
});