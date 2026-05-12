

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