

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
			elem.setAttribute(key, attributes[key]);
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
			elem.setAttribute(key, attributes[key]);
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
}

interface FormControlOptionals {
    options?: { value: string, title: string }[];
    required?: boolean;
    disabled?: boolean;
    autocomplete_off?: boolean;
    value?: string|number;
}

let create_formcontrol_i = 0;

export function create_formcontrol<K extends keyof FormcontrolTypeNameMap>(parent: HTMLElement, type: K, name: string, placeholder: string|null, optionals: FormControlOptionals): FormcontrolTypeNameMap[K] {
    const container = create_element(parent, "div", { class: "fc-container" });
    let input_element: FormcontrolTypeNameMap[K];
    if (type === "select") {
        input_element = create_element(container, "select", { class: "fc" }) as FormcontrolTypeNameMap[K];
        if (placeholder !== null) {
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
    if(optionals.value) input_element.value = optionals.value.toString();
    if(optionals.required) input_element.required = true;
    if(optionals.disabled) input_element.disabled = true;
    if(optionals.autocomplete_off) input_element.autocomplete = "off";

    if (placeholder !== null) {
        input_element.setAttribute("placeholder", placeholder);
        const label = create_element(container, "label", { class: "labeled_input" });
        label.innerText = placeholder;
        label.setAttribute("for", input_element.id);
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
    create_formcontrol_i++;
    return input_element;
}

