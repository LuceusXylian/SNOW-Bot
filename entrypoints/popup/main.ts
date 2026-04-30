import { SharedData, LogFrom, Logger } from '@/components/basics';
import { sendMessage, MessageType } from '@/components/messaging';
import { get_shared_data } from '@/components/client';

const LOGGER = new Logger(LogFrom.popup);
LOGGER.debug("Popup started");

// Fetch state from background and initialize UI
(async () => {
	try {
		const shared = await get_shared_data(LOGGER);
		init(shared);
	} catch (error) {
		LOGGER.debug("Failed to initialize popup", error);
	}
})();

function init(shared: SharedData) {
	// Active Toggler
	const active_toggler = document.getElementById("active-toggler")!;

	function set_active_toggler_state(_active: boolean) {
		if (_active) {
			active_toggler.classList.add("active");
			active_toggler.title = "Bot is running";
		} else {
			active_toggler.classList.remove("active");
			active_toggler.title = "Bot is disabled";
		}

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
	const controller_goback = document.getElementById("controller-goback")!;
	const menu = document.getElementById("menu")!;
	const menu_items = <HTMLCollectionOf<HTMLDivElement>>document.getElementsByClassName("menu-item");
	var menu_item_selected: HTMLDivElement | null = null;

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
	const serialnumbers_textarea = document.getElementById("serialnumbers-textarea") as HTMLTextAreaElement;
	const serialnumbers_submit = document.getElementById("serialnumbers-submit")!;

	serialnumbers_submit.addEventListener("click", async () => {
		// Send command to background to execute mass action on serial numbers
		const serialnumbers = serialnumbers_textarea.value.trim().split('\n').filter((s: string) => s);
		const response = await sendMessage({
			type: MessageType.EXECUTE_ACTION,
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
			row.innerHTML = `
				<td>${template.name}</td>
				<td>
					<button class="btn-edit" data-template-id="${template.id}">Edit</button>
					<button class="btn-delete" data-template-id="${template.id}">Delete</button>
					<button class="btn-insert" data-template-id="${template.id}">Execute Insert</button>
				</td>
			`;

			// Edit button
			row.querySelector('.btn-edit')!.addEventListener('click', () => {
				editingTemplateId = template.id;
				templateNameInput.value = template.name;
				templateContentTextarea.value = template.content;
				templateSaveBtn.textContent = 'Update Template';
				templateNameInput.focus();
			});

			// Delete button
			row.querySelector('.btn-delete')!.addEventListener('click', async () => {
				if (confirm(`Delete template "${template.name}"?`)) {
					await shared.deleteTemplate(template.id);
					renderTemplates();
				}
			});

			// Insert button
			row.querySelector('.btn-insert')!.addEventListener('click', async () => {
				// Send insert command to background which will relay to active tab
				const response = await sendMessage({
					type: MessageType.INSERT_TEMPLATE,
					data: {
						content: template.content,
					}
				});
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
	});

	// Initial render
	renderTemplates();
}