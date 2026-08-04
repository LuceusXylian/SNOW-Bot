import { execute_script } from "@/components/scripting";
import type { Script } from "@/components/scripting";
import { BotCommander, Logger, SharedData } from "@/components/basics";
import { create_element, create_text_element } from "@/components/ui";
import { MessageType, registerMessageHandler } from "@/components/messaging";
import { ScriptingUI } from "./scripting_ui";

export class ChatUI extends ScriptingUI {
	private static activeInstance: ChatUI | null = null;
	private static isListenerRegistered = false;

	private selectedScriptId: string | null = null;
	private filteredScripts: Script[] = [];
	private historyContainer: HTMLElement | null = null;
	private suggestionContainer: HTMLElement | null = null;
	private suggestionButtons: HTMLButtonElement[] = [];
	private highlightedSuggestionIndex: number = -1;
	private inputRow: HTMLElement | null = null;
	private queryInput: HTMLInputElement | null = null;
	private executeButton: HTMLButtonElement | null = null;
	private statusContainer: HTMLElement | null = null;
	private cleanupCallbacks: Array<() => void> = [];
	private suggestionHideTimer: number | null = null;

	constructor(shared: SharedData, LOGGER: Logger, COMMANDER: BotCommander) {
		super(shared, LOGGER, COMMANDER);
		ChatUI.ensureMessageListener();
	}

	private static ensureMessageListener() {
		if (ChatUI.isListenerRegistered) {
			return;
		}
		ChatUI.isListenerRegistered = true;

		registerMessageHandler(async (message) => {
			if (message.type === MessageType.PROGRESS_REPORT) {
				const instance = ChatUI.activeInstance;
				if (instance && message.data && message.data.session_id === instance.SESSION_ID && message.data.message) {
					console.log("message.data", message.data);
					instance.appendHistory(message.data.kind, message.data.kind, message.data.message, String(message.data.meta ?? ""));
				}
			}
			return { success: true };
		});
	}

	private dispose() {
		if (this.suggestionHideTimer !== null) {
			window.clearTimeout(this.suggestionHideTimer);
			this.suggestionHideTimer = null;
		}
		this.highlightedSuggestionIndex = -1;
		this.suggestionButtons = [];
		for (const cleanup of this.cleanupCallbacks) {
			cleanup();
		}
		this.cleanupCallbacks = [];
		this.hideSuggestionPanel();
	}
	
	// SESSION_ID to know which controller should be notified for progress reports
	override readonly SESSION_ID: number = new Date().getTime();

	private appendHistory(kind: "command" | "response" | "progress" | "error" | "info", title: string, text: string, meta?: string) {
		if (!this.historyContainer) {
			return;
		}

		const row = create_element(this.historyContainer, "div", { class: `chat-history-entry chat-history-${kind}` });
		const header = create_element(row, "div", { class: "chat-history-header" });
		create_text_element(header, "span", title, { class: "chat-history-title" });
		if (meta) {
			create_text_element(header, "span", meta, { class: "chat-history-meta" });
		}
		create_text_element(row, "div", text, { class: "chat-history-text" });
		this.historyContainer.scrollTop = this.historyContainer.scrollHeight;
	}

	private hideSuggestionPanel() {
		if (this.suggestionContainer) {
			this.suggestionContainer.style.display = "none";
		}
		this.suggestionButtons = [];
		this.highlightedSuggestionIndex = -1;
	}

	private updateSuggestionHighlight() {
		if (!this.suggestionButtons.length) {
			return;
		}

		const normalizedIndex = this.highlightedSuggestionIndex < 0
			? -1
			: Math.min(this.highlightedSuggestionIndex, this.suggestionButtons.length - 1);
		this.suggestionButtons.forEach((button, index) => {
			button.classList.toggle("is-active", index === normalizedIndex);
			if (index === normalizedIndex) {
				button.scrollIntoView({ block: "nearest" });
			}
		});
	}

	private moveSuggestionHighlight(direction: 1 | -1) {
		if (!this.filteredScripts.length) {
			return;
		}

		if (this.highlightedSuggestionIndex === -1) {
			this.highlightedSuggestionIndex = direction === 1 ? 0 : this.filteredScripts.length - 1;
		} else {
			this.highlightedSuggestionIndex = (this.highlightedSuggestionIndex + direction + this.filteredScripts.length) % this.filteredScripts.length;
		}

		const highlightedScript = this.filteredScripts[this.highlightedSuggestionIndex]!;
		this.selectedScriptId = highlightedScript.id;
		this.updateSuggestionHighlight();
	}

	private positionSuggestionPanel() {
		if (!this.queryInput || !this.suggestionContainer) {
			return;
		}
		const rect = this.queryInput.getBoundingClientRect();
		const preferredTop = rect.top - 8 - Math.min(this.suggestionContainer.offsetHeight, 260);
		const top = Math.max(8, preferredTop);
		this.suggestionContainer.style.left = `${rect.left}px`;
		this.suggestionContainer.style.top = `${top}px`;
		this.suggestionContainer.style.width = `${rect.width}px`;
	}

	private renderSuggestionPanel() {
		if (!this.queryInput) {
			return;
		}

		const query = this.queryInput.value.trim().toLowerCase();
		const scripts = this.getFilteredScripts(query);
		if (scripts.length === 0) {
			return;
		}

		if(this.suggestionContainer === null) {
			this.suggestionContainer = create_element(document.body, "div", { class: "chat-suggestion-panel" });
		} else {
			this.suggestionContainer.innerHTML = "";
			this.suggestionContainer.style.display = "";
		}
		this.suggestionButtons = [];

		for (const script of scripts) {
			const button = create_text_element(this.suggestionContainer, "button", "", { class: "chat-suggestion", type: "button" }) as HTMLButtonElement;
			this.suggestionButtons.push(button);
			const name = create_element(button, "span", { class: "chat-suggestion-name" });
			name.innerText = script.name;
			const meta = create_element(button, "span", { class: "chat-suggestion-meta" });
			meta.innerText = `${script.id} · ${script.lines.length} line${script.lines.length === 1 ? "" : "s"}`;

			button.addEventListener("pointerdown", (event) => {
				event.preventDefault();
				this.selectScript(script);
			});
		}

		this.updateSuggestionHighlight();

		this.positionSuggestionPanel();
		const reposition = () => this.positionSuggestionPanel();
		window.addEventListener("scroll", reposition, true);
		window.addEventListener("resize", reposition);
		this.cleanupCallbacks.push(() => window.removeEventListener("scroll", reposition, true));
		this.cleanupCallbacks.push(() => window.removeEventListener("resize", reposition));
	}

	private hideSuggestionPanelSoon() {
		if (this.suggestionHideTimer !== null) {
			window.clearTimeout(this.suggestionHideTimer);
		}
		this.suggestionHideTimer = window.setTimeout(() => {
			this.hideSuggestionPanel();
		}, 150);
	}

	private getFilteredScripts(query: string) {
		const normalized = query.trim();
		if (normalized.length === 0) {
			return this.shared.data.scripts.slice(0, 8);
		}
		const lowered = normalized.toLowerCase();
		return this.shared.data.scripts.filter((script) => {
			return script.name.toLowerCase().includes(lowered) || script.id.toLowerCase().includes(lowered);
		}).slice(0, 8);
	}

	private selectScript(script: Script) {
		if (!this.queryInput || !this.executeButton || !this.statusContainer) {
			return;
		}
		this.queryInput.value = script.name;
		this.selectedScriptId = script.id;
		this.executeButton.disabled = false;
		this.statusContainer.innerText = `Selected ${script.name}`;
		this.renderSuggestionPanel();
	}
	
	
	build(container: HTMLElement) {
		ChatUI.activeInstance?.dispose();
		ChatUI.activeInstance = this;
		container.innerHTML = "";
		this.selectedScriptId = null;

		this.historyContainer = create_element(container, "div", { class: "chat-history" });
		this.appendHistory("info", "Ready", "Pick a script to queue it, then watch progress updates arrive here.");

		const chat_footer = create_element(container, "div", { class: "chat-footer" });
		this.inputRow = create_element(chat_footer, "div", { class: "chat-input-row" });
		this.queryInput = create_element(this.inputRow, "input", { type: "text", class: "fc chat-input", placeholder: "Search scripts" }) as HTMLInputElement;
		this.queryInput.autocomplete = "off";

		this.executeButton = create_text_element(this.inputRow, "button", "Execute", { class: "fc fc-small chat-execute", type: "button" }) as HTMLButtonElement;
		this.executeButton.disabled = true;

		this.statusContainer = create_element(chat_footer, "div", { class: "chat-status" });
		create_text_element(chat_footer, "div", " • ", { class: "chat-suggestions-hint seperator", style: "padding: 0 1rem;" });
		const suggestionsHint = create_element(chat_footer, "div", { class: "chat-suggestions-hint" });
		suggestionsHint.innerText = "Autocomplete appears above the input while you type.";

		// Calculate this.historyContainer height = 100vh - header - chat_footer
		this.historyContainer.style.height = "calc(100vh - 62px - (0.6rem * 2) - "+chat_footer.clientHeight+"px)";

		const setStatus = (text: string) => {
			if (this.statusContainer) {
				this.statusContainer.innerText = text;
			}
		};
		const findExactMatch = (query: string) => {
			const normalized = query.trim().toLowerCase();
			if (normalized.length === 0) {
				return null;
			}
			return this.shared.data.scripts.find((script) => {
				return script.name.toLowerCase() === normalized || script.id.toLowerCase() === normalized;
			}) ?? null;
		};

		const renderSuggestions = () => {
			if (!this.queryInput || !this.executeButton) {
				return;
			}
			const query = this.queryInput.value;
			const exactMatch = findExactMatch(query);
			this.filteredScripts = this.getFilteredScripts(query);
			this.selectedScriptId = exactMatch?.id ?? null;
			this.executeButton.disabled = this.selectedScriptId === null && this.filteredScripts.length !== 1;

			if (exactMatch) {
				setStatus(`Selected ${exactMatch.name} (${exactMatch.lines.length} lines)`);
			} else if (this.filteredScripts.length > 0) {
				setStatus(`${this.filteredScripts.length} suggestion${this.filteredScripts.length === 1 ? "" : "s"}`);
			} else {
				setStatus("No matching script found.");
			}

			this.renderSuggestionPanel();
		};

		this.queryInput.addEventListener("click", () => {if(this.suggestionContainer?.style.display === "none") renderSuggestions()});
		this.queryInput.addEventListener("input", renderSuggestions);
		this.queryInput.addEventListener("focus", renderSuggestions);
		this.queryInput.addEventListener("blur", () => this.hideSuggestionPanelSoon());
		this.queryInput.addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				renderSuggestions();
				this.moveSuggestionHighlight(1);
				return;
			}

			if (event.key === "ArrowUp") {
				event.preventDefault();
				renderSuggestions();
				this.moveSuggestionHighlight(-1);
				return;
			}

			if (event.key === "Enter") {
				event.preventDefault();
				this.executeSelectedScript();
			}
		});
		this.executeButton.addEventListener("click", () => this.executeSelectedScript());

		renderSuggestions();
		this.queryInput.focus();
	}

	private async executeSelectedScript() {
		if (!this.queryInput || !this.executeButton) {
			return;
		}

		const selectedScript = this.shared.data.scripts.find((entry) => entry.id === this.selectedScriptId) ?? this.shared.data.scripts.find((script) => script.name.toLowerCase() === this.queryInput!.value.trim().toLowerCase());
		const script = selectedScript ?? (this.filteredScripts.length === 1 ? this.filteredScripts[0] : null);
		if (!script) {
			this.appendHistory("error", "Command", "Pick a script from the suggestions first.");
			return;
		}

		this.queryInput!.value = "";
		this.hideSuggestionPanel();
		this.appendHistory("command", "Command", `Execute script ${script.name}`, script.id);
		this.executeButton.disabled = true;
		this.statusContainer!.innerText = `Executing ${script.name}...`;

		const response = await execute_script(this, script.id);
		if (!response.success) {
			this.appendHistory("error", "Response", response.error ?? `Failed to execute ${script.name}`);
		}
		this.statusContainer!.innerText = response.success ? `Queued ${script.name}` : `Failed to queue ${script.name}`;
		this.executeButton.disabled = false;
	}
}