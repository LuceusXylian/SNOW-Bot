

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

