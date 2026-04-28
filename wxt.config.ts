import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
	suppressWarnings: {
		firefoxDataCollection: true,
	}, manifest: {
		name: "ServiceNow Bot",
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
	},
});