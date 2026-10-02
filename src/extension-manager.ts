import { VIEW_TYPE_CODE_EDITOR } from "./editor-view";
import type MyPlugin from "./main";

export interface ExtensionGroup {
	id: string;
	name: string;
	description: string;
	extensions: string[];
}

export const PRESET_GROUPS: ExtensionGroup[] = [
	{
		id: "code-scripts",
		name: "代码与脚本",
		description: "HTML, CSS, JS, TS, Python, Shell, SQL, C++, Rust, Go 等脚本与源代码文件",
		extensions: ["html", "css", "js", "ts", "jsx", "tsx", "py", "sh", "bash", "sql", "cpp", "rs", "go"]
	},
	{
		id: "data-config",
		name: "数据与配置",
		description: "JSON, XML, YAML, TOML, CSV, INI, Conf, ENV 等配置与数据交换格式",
		extensions: ["json", "jsonc", "json5", "xml", "toml", "yaml", "yml", "csv", "tsv", "ini", "conf", "env", "properties"]
	},
	{
		id: "subtitles-lyrics",
		name: "字幕与歌词",
		description: "SRT, VTT, LRC, ASS 等多媒体时间轴字幕与歌词文本",
		extensions: ["srt", "vtt", "lrc", "ass", "ssa", "sub"]
	}
];

export const DEFAULT_EXTENSIONS: string[] = ["json", "xml", "yaml", "yml", "toml", "txt"];

export const RESERVED_EXTENSIONS = new Set(["md", "markdown", "canvas"]);

export function normalizeExtension(ext: string): string {
	return ext.trim().toLowerCase().replace(/^\.+/, "");
}

export function validateExtension(
	ext: string,
	existingCustom: string[] = []
): { valid: boolean; error?: string } {
	const normalized = normalizeExtension(ext);
	if (!normalized) {
		return { valid: false, error: "Extension cannot be empty." };
	}
	if (RESERVED_EXTENSIONS.has(normalized)) {
		return { valid: false, error: `"${normalized}" is a core Obsidian format and cannot be overridden.` };
	}
	if (!/^[a-z0-9_-]+$/i.test(normalized)) {
		return { valid: false, error: `"${normalized}" contains invalid characters. Use letters, numbers, hyphens, or underscores.` };
	}
	if (existingCustom.map(normalizeExtension).includes(normalized)) {
		return { valid: false, error: `"${normalized}" has already been added.` };
	}
	return { valid: true };
}

export interface ViewRegistry {
	typeByExtension: Record<string, string>;
	registerExtensions(extensions: string[], viewType: string): void;
	unregisterExtensions(extensions: string[]): void;
	getTypeByExtension(extension: string): string | undefined;
}

export class ExtensionManager {
	private plugin: MyPlugin;
	private registeredExtensions: Set<string> = new Set();

	constructor(plugin: MyPlugin) {
		this.plugin = plugin;
	}

	private getViewRegistry(): ViewRegistry | null {
		return (this.plugin.app as any).viewRegistry ?? null;
	}

	registerExtension(ext: string): boolean {
		const normalized = normalizeExtension(ext);
		if (!normalized) return false;

		const viewRegistry = this.getViewRegistry();
		if (viewRegistry) {
			const currentType = viewRegistry.typeByExtension?.[normalized];
			if (currentType === VIEW_TYPE_CODE_EDITOR) {
				this.registeredExtensions.add(normalized);
				return true;
			}
			if (currentType && currentType !== VIEW_TYPE_CODE_EDITOR) {
				try {
					viewRegistry.unregisterExtensions([normalized]);
				} catch (e) {
					console.warn(`obsidian-file-editor: failed to unregister existing handler for "${normalized}"`, e);
				}
			}
			try {
				viewRegistry.registerExtensions([normalized], VIEW_TYPE_CODE_EDITOR);
				this.registeredExtensions.add(normalized);
				return true;
			} catch (error) {
				console.warn(`obsidian-file-editor: failed to register extension "${normalized}"`, error);
				return false;
			}
		} else {
			try {
				this.plugin.registerExtensions([normalized], VIEW_TYPE_CODE_EDITOR);
				this.registeredExtensions.add(normalized);
				return true;
			} catch (error) {
				console.warn(`obsidian-file-editor: failed to register extension "${normalized}"`, error);
				return false;
			}
		}
	}

	unregisterExtension(ext: string): void {
		const normalized = normalizeExtension(ext);
		if (!normalized) return;

		const viewRegistry = this.getViewRegistry();
		if (viewRegistry) {
			if (viewRegistry.typeByExtension?.[normalized] === VIEW_TYPE_CODE_EDITOR) {
				try {
					viewRegistry.unregisterExtensions([normalized]);
				} catch (error) {
					console.warn(`obsidian-file-editor: failed to unregister extension "${normalized}"`, error);
				}
			}
		}
		this.registeredExtensions.delete(normalized);
	}

	async addExtension(ext: string): Promise<boolean> {
		const normalized = normalizeExtension(ext);
		const validation = validateExtension(normalized, this.plugin.settings.customExtensions);
		if (!validation.valid) {
			return false;
		}
		this.plugin.settings.customExtensions.push(normalized);
		this.registerExtension(normalized);
		await this.plugin.saveSettings();
		return true;
	}

	async removeExtension(ext: string): Promise<boolean> {
		const normalized = normalizeExtension(ext);
		if (!this.plugin.settings.customExtensions.includes(normalized)) {
			return false;
		}
		this.plugin.settings.customExtensions = this.plugin.settings.customExtensions.filter(e => e !== normalized);
		this.unregisterExtension(normalized);
		await this.plugin.saveSettings();
		return true;
	}

	async addExtensions(exts: string[]): Promise<number> {
		let count = 0;
		for (const ext of exts) {
			const normalized = normalizeExtension(ext);
			const validation = validateExtension(normalized, this.plugin.settings.customExtensions);
			if (validation.valid) {
				this.plugin.settings.customExtensions.push(normalized);
				this.registerExtension(normalized);
				count++;
			}
		}
		if (count > 0) {
			await this.plugin.saveSettings();
		}
		return count;
	}

	async removeExtensions(exts: string[]): Promise<number> {
		const toRemove = new Set(exts.map(normalizeExtension));
		const initialLen = this.plugin.settings.customExtensions.length;
		this.plugin.settings.customExtensions = this.plugin.settings.customExtensions.filter(e => !toRemove.has(e));
		for (const ext of toRemove) {
			this.unregisterExtension(ext);
		}
		const removed = initialLen - this.plugin.settings.customExtensions.length;
		if (removed > 0) {
			await this.plugin.saveSettings();
		}
		return removed;
	}

	async resetToDefaults(): Promise<void> {
		this.unregisterAll();
		this.plugin.settings.customExtensions = [...DEFAULT_EXTENSIONS];
		this.registerAllConfiguredExtensions();
		await this.plugin.saveSettings();
	}

	async clearAll(): Promise<void> {
		this.unregisterAll();
		this.plugin.settings.customExtensions = [];
		await this.plugin.saveSettings();
	}

	registerAllConfiguredExtensions(): void {
		const targetExtensions = this.getAllConfiguredExtensions();
		for (const ext of targetExtensions) {
			this.registerExtension(ext);
		}
	}

	syncExtensions(): void {
		const targetExtensions = new Set(this.getAllConfiguredExtensions());

		// Unregister extensions that are no longer configured
		for (const ext of Array.from(this.registeredExtensions)) {
			if (!targetExtensions.has(ext)) {
				this.unregisterExtension(ext);
			}
		}

		// Register newly added extensions
		for (const ext of targetExtensions) {
			if (!this.registeredExtensions.has(ext)) {
				this.registerExtension(ext);
			}
		}
	}

	getAllConfiguredExtensions(): string[] {
		const s = this.plugin.settings;
		if (Array.isArray(s.customExtensions)) {
			return Array.from(new Set(s.customExtensions.map(normalizeExtension).filter(Boolean)));
		}
		return [];
	}

	unregisterAll(): void {
		const viewRegistry = this.getViewRegistry();
		if (viewRegistry) {
			const list = Array.from(this.registeredExtensions).filter(
				(ext) => viewRegistry.typeByExtension?.[ext] === VIEW_TYPE_CODE_EDITOR
			);
			if (list.length > 0) {
				try {
					viewRegistry.unregisterExtensions(list);
				} catch (e) {
					console.warn("obsidian-file-editor: error unregistering extensions during teardown", e);
				}
			}
		}
		this.registeredExtensions.clear();
	}

	isRegistered(ext: string): boolean {
		return this.registeredExtensions.has(normalizeExtension(ext));
	}

	getRegisteredList(): string[] {
		return Array.from(this.registeredExtensions);
	}
}
