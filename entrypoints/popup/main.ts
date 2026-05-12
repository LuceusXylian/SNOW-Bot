import { SharedData, LogFrom, Logger, BotCommander } from '@/components/basics';
import { sendMessage, MessageType } from '@/components/messaging';
import { get_shared_data } from '@/components/client';
import { KEY_POPUP_MENU_INDEX } from '@/components/constants';
import { add_spoiler_event } from '@/components/ui';

const LOGGER = new Logger(LogFrom.popup);
LOGGER.debug("Popup started");

// Fetch state from background and initialize UI
(async () => {
	try {
		const COMMANDER = new BotCommander(LOGGER);
		const shared = await get_shared_data(LOGGER, COMMANDER);
		init(COMMANDER, shared);
	} catch (error) {
		LOGGER.debug("Failed to initialize popup", error);
	}
})();

function init(COMMANDER: BotCommander, shared: SharedData) {
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
	set_active_toggler_state(shared.getActive());

	active_toggler.addEventListener("click", async () => {
		await shared.applyStateChange({ active: !shared.getActive() });
		set_active_toggler_state(shared.getActive());
	});


	// Menu
	const header = document.getElementById("header")!;
	const title_sub = document.getElementById("title_sub")!;
	const controller_goback = document.getElementById("controller-goback")!;
	const menu = document.getElementById("menu")!;
	const menu_items = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName("menu-item");
	var menu_item_selected: HTMLDivElement | null = null;
	storage.getItem(KEY_POPUP_MENU_INDEX).then((stored_index) => {
		for (let i = 0; i < menu_items.length; i++) {
			const item = menu_items[i];
			const index = i;
			const menu_item_title = item.querySelector(".menu-item-title") as HTMLElement;
			
			item.addEventListener("click", () => {
				if (menu_item_selected === null) {
					menu.classList.add("deeper");
					item.classList.add("selected");
					header.classList.remove("goback-hidden");
					menu_item_selected = item;
					storage.setItem(KEY_POPUP_MENU_INDEX, index);
					title_sub.innerText = menu_item_title.innerText;
				}
			});

			if(index === stored_index) item.click();
		}
	})


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
	add_spoiler_event(template_form_spoiler);

	// Serialnumbers
	const serialnumbers_textarea = document.getElementById("serialnumbers-textarea") as HTMLTextAreaElement;
	const serialnumbers_submit = document.getElementById("serialnumbers-submit")!;

	serialnumbers_submit.addEventListener("click", async () => {
		// Send command to background to execute mass action on serial numbers
		const serialnumbers = serialnumbers_textarea.value.trim().split('\n').filter((s: string) => s);
		const response = await sendMessage({
			type: MessageType.RELAY_COMMAND,
			data: {
				action: 'mass_hardware_actions',
				serialnumbers,
			}
		});

		if (response.success) {
			LOGGER.debug("Mass action command sent", response);
		} else {
			LOGGER.debug("Failed to send mass action command", response);
		}
	});


	// Templates Management
	const templateNameInput = document.getElementById("template-name-input") as HTMLInputElement;
	const templateContentTextarea = document.getElementById("template-content-textarea") as HTMLTextAreaElement;
	const templateSaveBtn = document.getElementById("template-save-btn")!;
	const templatesTable = document.getElementById("templates-table")!;
	const templatesTbody = document.getElementById("templates-tbody")!;

	let editingTemplateId: string | null = null;

	function generateTemplateId(): string {
		return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	function renderTemplates() {
		const templates = shared.getTemplates();
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
		templateSaveBtn.textContent = 'Save Template';
		editingTemplateId = null;
		template_form_spoiler.classList.remove("active");
	});

	// Initial render
	renderTemplates();
}