import type { Logger } from "./basics";


/**
 * Creates an HTML element.
 * @param tag The tag name of the element to create.
 * @param attributes Optional. Example: { class: "container", "data-role": "content" }
 * @returns HTMLElement
 */
export function create_element<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, attributes?: { [key: string]: string }): HTMLElementTagNameMap[K] {
	const elem = parent.appendChild(document.createElement(tag));
	if (attributes) {
		for (const key in attributes) {
			elem.setAttribute(key, attributes[key]!);
		}
	}
	return elem;
}

/**
 * Creates a new element and appends text.
 * @param tag The tag name of the element to create.
 * @param text element.innerText
 * @param attributes Optional. Example: { class: "container", "data-role": "content" }
 * @returns HTMLElement
 */
export function create_text_element<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, text: string, attributes?: { [key: string]: string }): HTMLElementTagNameMap[K] {
	const elem = parent.appendChild(document.createElement(tag));
	elem.innerText = text;
	if (attributes) {
		for (const key in attributes) {
			elem.setAttribute(key, attributes[key]!);
		}
	}
	return elem;
}

export function add_spoiler_event(spoiler_container: HTMLElement) {
	const spoiler_title = spoiler_container.querySelector(".spoiler-title");
	const spoiler_content = spoiler_container.querySelector(".spoiler-content");
	if (spoiler_title === null || spoiler_content === null) {
		throw new Error("ERROR childreen .spoiler-title and .spoiler-content of .spoiler_container needs to exist for add_spoiler_event to work. "+String(spoiler_container));
	}

	spoiler_title.addEventListener("click", () => {
		if (spoiler_container.classList.contains("active")) {
			spoiler_container.classList.remove("active");
		} else {
			spoiler_container.classList.add("active");
		}
	});
}

export function save_as_file(content: string, filename: string) {
	const blob = new Blob([content], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function fadeIn(element: HTMLElement) {
	element.style.display = "";
	requestAnimationFrame(() => {
		element.style.opacity = '1';
	});
};

function fadeOut(element: HTMLElement): Promise<void> {
	return new Promise((resolve) => {
		element.style.opacity = '0';
		element.addEventListener('transitionend', () => {
			element.style.display = "none";
			resolve();
		}, { once: true });
	});
};

function fadeOutAndRemove(element: HTMLElement): Promise<void> {
	return new Promise((resolve) => {
		element.style.opacity = '0';
		element.addEventListener('transitionend', () => {
			element.style.display = "none";
			element.remove();
			resolve();
		}, { once: true });
	});
};

export function alert_modal(message: string) {
	const modal = create_element(document.body, "div", { style: 
		`position: fixed; top: 0; left: 0; 
		width: 100vw; height: 100vh; 
		display: flex; align-items: center; justify-content: center; 
		background-color: rgba(0, 0, 0, 0.5); opacity: 0; 
		transition: opacity 0.25s ease; z-index: 9999;` 
	});

	const alertBox = create_text_element(modal, "div", message);
	alertBox.style.backgroundColor = '#fff';
	alertBox.style.color = '#000';
	alertBox.style.padding = '16px 24px';
	alertBox.style.borderRadius = '8px';
	alertBox.style.maxWidth = '90%';
	alertBox.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
	alertBox.style.textAlign = 'center';
	alertBox.style.fontSize = '1rem';

	fadeIn(modal);
	setTimeout(() => {
		fadeOutAndRemove(modal);
	}, 2250);
}

export function create_modal(onCreate: (container: HTMLElement) => void): Promise<Record<string, string>> {
	return new Promise((resolve, reject) => {
		const modal = create_element(document.body, "div", { class: "modal" });
		const content = create_element(modal, 'div');
		content.style.color = '#fff';
		content.style.backgroundColor = '#0a3042';
		content.style.borderRadius = '10px';
		content.style.maxWidth = '90%';
		content.style.maxHeight = '90%';
		content.style.overflow = 'auto';
		content.style.padding = '16px';
		content.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.2)';
		content.style.position = 'relative';

		const closeButton = create_text_element(content, 'button', '×', { type: 'button', style: "color: white;" });
		closeButton.style.position = 'absolute';
		closeButton.style.top = '4px';
		closeButton.style.right = '4px';
		closeButton.style.border = 'none';
		closeButton.style.background = 'transparent';
		closeButton.style.fontSize = '1.5rem';
		closeButton.style.cursor = 'pointer';
		closeButton.style.lineHeight = '1';

		const container = create_element(content, 'div', { style: "display: flex; flex-direction: column; gap: 12px;" });
		const buttonContainer = create_element(content, 'div');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '8px';
		buttonContainer.style.marginTop = '12px';

		const submitButton = create_text_element(buttonContainer, 'button', 'Submit', { type: 'button', style: "" });
		submitButton.style.padding = '8px 16px';
		submitButton.style.border = 'none';
		submitButton.style.borderRadius = '6px';
		submitButton.style.backgroundColor = '#2563eb';
		submitButton.style.color = '#fff';
		submitButton.style.cursor = 'pointer';

		const close_fn = () => {
			fadeOutAndRemove(modal);
			document.removeEventListener("keyup", onEscKeyUp);
		};
		closeButton.addEventListener('click', () => {
			close_fn();
			reject('Modal closed via close button');
		});

		const onEscKeyUp = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				close_fn();
				reject('Modal closed via Escape key');
			}
		};
		document.addEventListener("keyup", onEscKeyUp);

		const submit_fn = () => {
			const results: Record<string, string> = {};
			const controls = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]');
			controls.forEach((control) => {
				if (control.name) {
					results[control.name] = control.value;
				}
			});
			close_fn();
			resolve(results);
		};
		submitButton.addEventListener('click', submit_fn);

		onCreate(container);
		// After the caller populates `container`, attach Enter handling
		// to the last input so Enter submits the modal.
		const controlsAfter = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]');
		if (controlsAfter.length > 0) {
			const lastControl = controlsAfter[controlsAfter.length - 1];
			if (lastControl instanceof HTMLInputElement) {
				lastControl.addEventListener('keyup', (ev: KeyboardEvent) => {
					if (ev.key === 'Enter') {
						submit_fn();
					}
				});
			}
		}
		fadeIn(modal);
	});
}

export function create_delete_confirm_modal(
    message: string = "Are you sure you want to delete this item?"
): Promise<boolean> {
    return new Promise((resolve) => {
        const modal = create_element(document.body, "div", { class: "modal" });

        const content = create_element(modal, "div");
        content.style.color = "#fff";
        content.style.backgroundColor = "#0a3042";
        content.style.borderRadius = "10px";
        content.style.maxWidth = "500px";
        content.style.padding = "30px 16px 16px 16px";
        content.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.2)";
        content.style.position = "relative";

        const closeButton = create_text_element(
            content,
            "button",
            "×",
            { type: "button", style: "color: white;" }
        );

        closeButton.style.position = "absolute";
        closeButton.style.top = "0";
        closeButton.style.right = "0";
        closeButton.style.border = "none";
        closeButton.style.background = "transparent";
        closeButton.style.fontSize = "1.5rem";
        closeButton.style.cursor = "pointer";
        closeButton.style.lineHeight = "1";

        const messageElement = create_text_element(
            content,
            "p",
            message
        );
        messageElement.style.margin = "0 0 16px 0";

        const buttonContainer = create_element(content, "div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "8px";

        const cancelButton = create_text_element(
            buttonContainer,
            "button",
            "Cancel",
            { type: "button" }
        );

        cancelButton.style.padding = "8px 16px";
        cancelButton.style.border = "none";
        cancelButton.style.borderRadius = "6px";
        cancelButton.style.cursor = "pointer";

        const deleteButton = create_text_element(
            buttonContainer,
            "button",
            "Delete",
            { type: "button" }
        );

        deleteButton.style.padding = "8px 16px";
        deleteButton.style.border = "none";
        deleteButton.style.borderRadius = "6px";
        deleteButton.style.backgroundColor = "#dc2626";
        deleteButton.style.color = "#fff";
        deleteButton.style.cursor = "pointer";

        const close = (confirmed: boolean) => {
            fadeOutAndRemove(modal);
            resolve(confirmed);
        };

        closeButton.addEventListener("click", () => close(false));
        cancelButton.addEventListener("click", () => close(false));
        deleteButton.addEventListener("click", () => close(true));

        modal.addEventListener("keyup", (ev: KeyboardEvent) => {
            if (ev.key === "Escape") {
                close(false);
            } else if (ev.key === "Enter") {
                close(true);
            }
        });

        fadeIn(modal);
    });
}

export function load_file_to_string(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}


interface FormcontrolTypeNameMap {
    "select": HTMLSelectElement;
    "text": HTMLInputElement;
    "number": HTMLInputElement;
    "textarea": HTMLTextAreaElement;
    "checkbox": HTMLInputElement;
}

interface FormControlOptionals {
    options?: { value: string, title: string }[];
    required?: boolean;
    disabled?: boolean;
    empty_is_value?: boolean;
    autocomplete_off?: boolean;
    value?: string;
    checked?: boolean;
	class?: string;
}

let create_formcontrol_i = 0;

export function create_formcontrol<K extends keyof FormcontrolTypeNameMap>(parent: HTMLElement, type: K, name: string, placeholder: string|null, optionals: FormControlOptionals): FormcontrolTypeNameMap[K] {
    const container = create_element(parent, "div", { class: "fc-container" });
	const type_is_checkbox = type === "checkbox";
	if (type_is_checkbox) {
		container.style.cssText = "display: inline-block; width: min-content; vertical-align: bottom;";
	}

	const empty_is_value = optionals.empty_is_value === true;
    let input_element: FormcontrolTypeNameMap[K];
    if (type === "select") {
        input_element = create_element(container, "select", { class: "fc" }) as FormcontrolTypeNameMap[K];
        if (placeholder !== null && !empty_is_value) {
            const option = create_element(input_element, "option", { value: "", class: "placeholder", style: "display: none" });
            option.innerText = placeholder;
        }

        if (optionals.options) {
            for (const option of optionals.options) {
                const option_element = create_element(input_element, "option", { value: option.value });
                option_element.innerText = option.title;
            }
        }
    } else if (type === "textarea") {
        input_element = create_element(container, "textarea", { class: "fc", style: "resize: none; min-height: 100px;" }) as FormcontrolTypeNameMap[K];
        // get computed padding top + padding bottom of the textarea
        const computed_style = window.getComputedStyle(input_element);
        const padding_top_bottom = parseInt(computed_style.paddingTop, 10) + parseInt(computed_style.paddingBottom, 10);

        // On keydown scale the textarea to fit the content. It should expect the padding of the textarea.
        const scale = () => {
            input_element.style.height = "auto"; // Reset height
            input_element.style.height = (input_element.scrollHeight + padding_top_bottom) + "px"; // Set to scrollHeight
        };

        scale(); // Initial scale
        input_element.addEventListener("keydown", scale);
    } else {
        input_element = create_element(container, "input", { type: type, class: "fc" }) as FormcontrolTypeNameMap[K];
    }
    input_element.id = "formcontrol" + create_formcontrol_i + "_" + name;
    input_element.name = name;
    if (optionals.value) input_element.value = optionals.value.toString();
    if (type_is_checkbox && optionals.checked) {
        (input_element as HTMLInputElement).checked = true;
    }
    if(optionals.required) input_element.required = true;
    if(optionals.disabled) input_element.disabled = true;
    if(optionals.autocomplete_off) input_element.autocomplete = "off";

	if (placeholder !== null) {
		const label = create_element(container, "label", { class: "labeled_input" });
		label.innerText = placeholder;
		label.setAttribute("for", input_element.id);
		if (type_is_checkbox) {
			container.style.minWidth = label.clientWidth+"px";
		} else {
			input_element.setAttribute("placeholder", placeholder);
			if(!empty_is_value) {
				if (input_element.value === "") {
					label.style.display = "none";
				}
				const toggle_label = () => {
					if (input_element.value === "") {
						label.style.display = "none";
					} else {
						label.style.display = "";
					}
				}
				input_element.addEventListener("keyup", toggle_label);
				input_element.addEventListener("change", toggle_label);
			}
		}
	}

	if (optionals.required) {
        input_element.addEventListener("change", () => {
            input_element.value = input_element.value.trim();
            if (input_element.value === "") {
                input_element.style.borderColor = "red";
            } else {
                input_element.style.borderColor = "";
            }
        });
    }

	if (optionals.class) {
		container.className += " "+optionals.class;
	}
	create_formcontrol_i++;
	return input_element as FormcontrolTypeNameMap[K];
}

export function create_chat_bubble(parent: HTMLElement, kind: "command" | "response" | "progress" | "error" | "info" | "user", title: string, text: string, meta?: string) {
	const row = create_element(parent, "div", { class: `chat-history-entry chat-history-${kind}` });
	const header = create_element(row, "div", { class: "chat-history-header" });
	create_text_element(header, "span", title, { class: "chat-history-title" });
	if (meta) {
		create_text_element(header, "span", meta, { class: "chat-history-meta" });
	}
	create_text_element(row, "div", text, { class: "chat-history-text" });
}

export class FadingChatModal {
	LOGGER: Logger;
	SESSION_ID: number;
	modal: HTMLDivElement;
	content: HTMLDivElement;
	constructor(LOGGER: Logger, SESSION_ID: number) {
		this.LOGGER = LOGGER;
		this.SESSION_ID = SESSION_ID;
		this.modal = create_element(document.body, "div", { class: "modal", style: "display: none; opacity: 0; pointer-events: none;" });
		this.content = create_element(this.modal, 'div');
		this.content.style.color = '#fff';
		this.content.style.borderRadius = '10px';
		this.content.style.maxHeight = '90%';
		this.content.style.overflow = 'auto';
		this.content.style.padding = '8px';
		this.content.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.2)';
		this.content.style.position = 'fixed';
		this.content.style.left = '0px';
		this.content.style.right = '0px';
		this.content.style.bottom = '0px';
		this.content.style.pointerEvents = 'none';

		registerMessageHandler(async (message) => {
			if (message.type === MessageType.PROGRESS_REPORT) {
				if (message.data && message.data.session_id === SESSION_ID && message.data.message) {
					console.log("message.data", message.data);
					this.set_chat_bubble(message.data.kind, message.data.kind, message.data.message, String(message.data.meta ?? ""));
				}
			}
			return { success: true };
		});
	}

	fadeIn() {
		this.content.innerHTML = "";
		if (this.modal.style.display === "none") {
			fadeIn(this.modal);
		}
	}
	fadeOut() {
		setTimeout(() => {
			fadeOut(this.modal);
		}, 8000);
	}

	set_chat_bubble(kind: "command" | "response" | "progress" | "error" | "info", title: string, text: string, meta?: string) {
		this.content.innerHTML = "";
		this.append_chat_bubble(kind, title, text, meta);
	}

	append_chat_bubble(kind: "command" | "response" | "progress" | "error" | "info", title: string, text: string, meta?: string) {
		const container = create_element(this.content, 'div', { class: "bg-color", style: "border-radius: 8px; overflow: hidden; margin-top: 10px;" });
		create_chat_bubble(container, kind, title, text, meta);
	}

	
	async promptFunctionArguments(functionArguments: FunctionArgument[]): Promise<Record<string, string> | null> {
		if (functionArguments === undefined || functionArguments.length === 0) return {};
		try {
			const result = await create_modal((container) => {
				let first = true;
				for (const fa of functionArguments) {
					let fc;
					if (fa.type === "textarea" || fa.type === "list") {
						fc = create_formcontrol(container, "textarea", fa.varname, fa.question, { value: fa.varvalue, required: !fa.optional });
					} else {
						fc = create_formcontrol(container, "text", fa.varname, fa.question, { value: fa.varvalue, required: !fa.optional });
					}
					if (first) {
						setTimeout(() => {
							fc.focus();
						}, 100);
					}
				}
			});
			return result;
		} catch {
			return null;
		}
	}

	async execute_script(script: Script) {
		const function_arguments = await this.promptFunctionArguments(script.function_arguments);
		if (function_arguments === null) return;

		this.fadeIn();
		const response = await execute_script(this.LOGGER, this.SESSION_ID, script.id, function_arguments);
		// show fading modal with command bubble
		try {
			if (!response.success) {
				this.append_chat_bubble("error", "Response", response.error ?? `Failed to execute ${script.name}`, script.id);
			}
			this.fadeOut();
		} catch (err) {
			console.error("show_fading_chat_modal failed", err);
		}
	}
}