import { SharedData, LogFrom, Logger, BotCommander, LogEntry, dateToISOString } from '@/components/basics';
import { sendMessage, MessageType } from '@/components/messaging';
import { get_shared_data } from '@/components/client';
import { KEY_POPUP_MENU_INDEX } from '@/components/constants';
import { add_spoiler_event, create_element, create_text_element, save_as_file, load_file_to_string, create_modal } from '@/components/ui';
import { ScriptingUI } from './scripting_ui';
import { buttongrid_ui } from './buttongrid_ui';


const IS_POPUP_QUERY_STRING = "?is_popup=0";
export const IS_POPUP = location.search !== IS_POPUP_QUERY_STRING;
const LOGGER = new Logger(LogFrom.popup);
LOGGER.debug("Popup started");

// #open_new_tab
(() => {
	const controller_title_main = document.getElementById("controller_title_main")!;
	const new_tab_button = document.getElementById("open_new_tab")!;
	if (IS_POPUP) {
		new_tab_button.addEventListener("click", () => {
			window.open(location.protocol+"//"+location.host+location.pathname + IS_POPUP_QUERY_STRING + location.hash, '_blank');
			window.close();
		});
	} else {
		controller_title_main.classList.remove("popup");
		new_tab_button.style.display = "none";
	}
})();

// Fetch state from background and initialize UI
(async () => {
	try {
		const COMMANDER = new BotCommander(LOGGER);
		const shared = await get_shared_data(LOGGER, COMMANDER);
		await init(COMMANDER, shared);
	} catch (error) {
		LOGGER.log("Failed to initialize popup", error);
	}
})();

async function init(COMMANDER: BotCommander, shared: SharedData) {
	// Active Toggler
	const active_toggler = document.getElementById("active-toggler")!;
	const active_label = document.getElementById("active-label")!;

	function set_active_toggler_state(_active: boolean) {
		if (_active) {
			active_toggler.classList.add("active");
			active_label.innerText = "running";
		} else {
			active_toggler.classList.remove("active");
			active_label.innerText = "disabled";
		}
		
		active_toggler.title = "Bot is "+active_label.innerText;
		LOGGER.debug(shared)
	}

	// Set initial state
	set_active_toggler_state(shared.data.active);

	active_toggler.addEventListener("click", async () => {
		await shared.applyStateChange({ active: !shared.data.active });
		set_active_toggler_state(shared.data.active);
	});


	// Menu
	const header = document.getElementById("header")!;
	const title_sub = document.getElementById("title_sub")!;
	const controller_goback = document.getElementById("controller-goback")!;
	const menu = document.getElementById("menu")!;
	const menu_items = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName("menu-item");
	var menu_item_selected: HTMLElement | null = null;
	const hashId = location.hash.slice(1);
	const stored_index = hashId.length || !IS_POPUP? -1 : await storage.getItem(KEY_POPUP_MENU_INDEX);

	for (let i = 0; i < menu_items.length; i++) {
		const item = menu_items[i];
		const index = i;
		const menu_item_title = item.querySelector(".menu-item-title") as HTMLElement;
		
		menu_item_title.addEventListener("click", () => {
			if (menu_item_selected === null) {
				menu.classList.add("deeper");
				item.classList.add("selected");
				header.classList.remove("goback-hidden");
				menu_item_selected = item;
				storage.setItem(KEY_POPUP_MENU_INDEX, index);
				title_sub.innerText = menu_item_title.innerText;
				location.hash = menu_item_title.id;
			}
		});

		if(menu_item_title.id === hashId || index === stored_index) {
			setTimeout(() => {
				menu_item_title.click();
			}, 10);
		}
	}


	controller_goback.addEventListener("click", () => {
		if (menu_item_selected !== null) {
			menu.classList.remove("deeper");
			menu_item_selected.classList.remove("selected");
			header.classList.add("goback-hidden");
			menu_item_selected = null;
			storage.setItem(KEY_POPUP_MENU_INDEX, null);
			title_sub.innerHTML = "";
		}
	});

	// spoilers
	const template_form_spoiler = document.getElementById("template_form_spoiler")!;
	const template_form_spoiler_title = document.getElementById("template_form_spoiler_title")!;
	const template_form_spoiler_title_default = template_form_spoiler_title.innerText;
	add_spoiler_event(template_form_spoiler);

	// Templates Management
	const templateNameInput = document.getElementById("template-name-input") as HTMLInputElement;
	const templateContentTextarea = document.getElementById("template-content-textarea") as HTMLTextAreaElement;
	const templateSaveBtn = document.getElementById("template-save-btn")!;
	const templatesTable = document.getElementById("table")!;
	const templatesTbody = document.getElementById("templates-tbody")!;

	let editingTemplateId: string | null = null;

	function generateTemplateId(): string {
		return `TPL${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	function renderTemplates() {
		const templates = shared.data.templates;
		templatesTbody.innerHTML = '';

		if (templates.length === 0) {
			templatesTbody.innerHTML = '<tr><td colspan="2">No templates yet</td></tr>';
			return;
		}

		templates.forEach((template) => {
			const row = document.createElement('tr');
			const td1 = row.appendChild(document.createElement('td'));
			td1.innerText = template.name;
			const td2 = row.appendChild(document.createElement('td'));
			
			const btn_edit = td2.appendChild(document.createElement('button'));
			btn_edit.className = "btn-edit";
			btn_edit.innerText = "Edit";
			btn_edit.addEventListener('click', () => {
				editingTemplateId = template.id;
				templateNameInput.value = template.name;
				templateContentTextarea.value = template.content;
				template_form_spoiler_title.innerText = 'Edit Template';
				templateSaveBtn.textContent = 'Update Template';
				template_form_spoiler.classList.add("active");
				setTimeout(() => {
					scroll(0, 0);
					templateNameInput.focus();
				}, 10);
			});
			
			const btn_delete = td2.appendChild(document.createElement('button'));
			btn_delete.className = "btn-delete";
			btn_delete.innerText = "Delete";
			btn_delete.addEventListener('click', async () => {
				if (confirm(`Delete template "${template.name}"?`)) {
					await shared.deleteTemplate(template.id);
					renderTemplates();
				}
			});
			
			const btn_insert = td2.appendChild(document.createElement('button'));
			btn_insert.className = "btn-insert";
			btn_insert.innerText = "Execute Insert";
			btn_insert.addEventListener('click', async () => {
				// Send insert command which will append text to the last selected input/textarea
				const response = await COMMANDER.sendMessageFocus(MessageType.INSERT_TEMPLATE, { content: template.content });
				LOGGER.debug("Template insert command sent", response);
			});

			templatesTbody.appendChild(row);
		});
	}

	// Save/Update template
	templateSaveBtn.addEventListener('click', async () => {
		const name = templateNameInput.value.trim();
		const content = templateContentTextarea.value.trim();

		if (!name || !content) {
			alert('Please fill in template name and content');
			return;
		}

		const templateId = editingTemplateId || generateTemplateId();
		const template = {
			id: templateId,
			name,
			content,
			createdAt: Date.now(),
		};

		await shared.setTemplate(template);
		renderTemplates();

		// Reset form
		templateNameInput.value = '';
		templateContentTextarea.value = '';
		template_form_spoiler_title.innerText = template_form_spoiler_title_default;
		templateSaveBtn.textContent = 'Save Template';
		editingTemplateId = null;
		template_form_spoiler.classList.remove("active");
	});

	// Initial render
	renderTemplates();

	// Logs
	const log_menu_title = document.getElementById("logs")!;
	const logs_container = document.getElementById("logs_container")!;
	log_menu_title.addEventListener("click", async function() {
		// Load logs
		logs_container.innerHTML = "";
		const response = await sendMessage<LogEntry[]>(LOGGER, {
			type: MessageType.GET_LOGS,
		});

		LOGGER.debug("GET_LOGS", response)
		if (response.success && response.data !== undefined) {
			if (response.data.length === 0) {
				create_text_element(logs_container, "div", "Logs are empty");
			} else {
				const export_button = create_text_element(logs_container, "button", "Export Logs", { class:"btn-edit", style:"margin-left: 0.5rem;" });
				export_button.addEventListener("click", () => {
					// Export response.data as file "SNOW_BOT_logs_{current_datetime}.txt"
					const now = new Date();
					const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
					const filename = `SNOW_BOT_logs_${dateTime}.txt`;
					const content = response.data!.map(entry => 
						`[${dateToISOString(new Date(entry.timestamp))}] ${entry.text}`
					).join('\n');
					save_as_file(content, filename)
				});
				
				const table = create_element(logs_container, "table", { style: "width: 100%;" });
				for (let i = 0; i < response.data.length; i++) {
					const entry = response.data[i];
					const row = create_element(table, "tr");
					const td1 = create_text_element(row, "td", dateToISOString(new Date(entry.timestamp)), { style: "width: 160px;" });
					const td2 = create_text_element(row, "td", entry.text);
				}
			}

		} else {
			LOGGER.log("Failed to get logs", response);
		}
	});

	// Settings - Export/Import
	const sharedExportBtn = document.getElementById("shared-export-btn")!;
	const sharedImportBtn = document.getElementById("shared-import-btn")!;
	const sharedImportInput = document.getElementById("shared-import-input") as HTMLInputElement;

	sharedExportBtn.addEventListener("click", () => {
		const exported = JSON.stringify(shared.export(), null, 2);
		const now = new Date();
		const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
		const filename = `SNOW_BOT_settings_${dateTime}.json`;
		save_as_file(exported, filename);
		LOGGER.debug("Settings exported", filename);
	});

	sharedImportBtn.addEventListener("click", () => {
		sharedImportInput.click();
	});

	sharedImportInput.addEventListener("change", async (event) => {
		const target = event.target as HTMLInputElement;
		const files = target.files;
		if (!files || files.length === 0) return;

		try {
			const fileContent = await load_file_to_string(files[0]);
			const imported = JSON.parse(fileContent);
			await shared.applyStateChange(imported);
			LOGGER.debug("Settings imported successfully", imported);
			alert("Settings imported successfully!");
			location.reload();
		} catch (error) {
			LOGGER.log("Failed to import settings", error);
			alert("Failed to import settings. Please check the file format.");
		} finally {
			// Reset file input
			sharedImportInput.value = '';
		}
	});

	// Settings - checkbox settings
	const checkbox_container = document.getElementById("checkbox_settings")!;
	const settingsAttributes = [
		{ key: "allow_prompt" as const, label: "Allow prompt() if value could not be determined" },
		{ key: "paste_cleaner_enabled" as const, label: "Clean paste input (Ctrl+V)" },
	];

	settingsAttributes.forEach(({ key, label }) => {
		const row = create_element(checkbox_container, "div", { class: "checkbox_row" });
		const id = `checkbox_settings_${key}`;
		const checkbox = create_element(row, "input", { id, type: "checkbox" }) as HTMLInputElement;
		checkbox.checked = shared.data[key];

		create_text_element(row, "label", label, { for: id });

		checkbox.addEventListener("change", () => {
			shared.applyStateChange({ [key]: checkbox.checked });
		});
	});

	// Scripting
	const scripting_title = document.getElementById("scripting")!;
	const scripting_container = document.getElementById("scripting_container")!;
	scripting_title.addEventListener("click", () => {
		if (IS_POPUP) {
			// Script Editor should only be used in a free window
			window.open(location.href + "#" + scripting_title.id, '_blank');
			window.close();
		}
		scripting_container.innerHTML = "";
		new ScriptingUI(shared, LOGGER, COMMANDER).build_scripting_list(scripting_container);
	});
	
	// Triggers
	// TODO: add form to create new Trigger
	// TODO: list all triggers with actions: edit, delete

	// ButtonGrid
	const buttongrid_title = document.getElementById("buttongrid")!;
	const buttongrid_container = document.getElementById("buttongrid_container")!;
	buttongrid_title.addEventListener("click", () => {
		buttongrid_ui(shared, LOGGER, COMMANDER, buttongrid_container);
	});

	// Chat
}