import { App, Notice, PluginSettingTab, Setting, setIcon } from "obsidian";
import type MyPlugin from "./main";
import {
	normalizeExtension,
	validateExtension,
	PRESET_GROUPS,
	DEFAULT_EXTENSIONS
} from "./extension-manager";

export interface FileEditorSettings {
	customExtensions: string[];
	showCustomInContextMenu: boolean;
	// Kept for backwards compatibility
	enableJson?: boolean;
	enableXml?: boolean;
	enableYaml?: boolean;
	enableToml?: boolean;
	enableTxt?: boolean;
}

export const DEFAULT_SETTINGS: FileEditorSettings = {
	customExtensions: [...DEFAULT_EXTENSIONS],
	showCustomInContextMenu: true,
};

export class FileEditorSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "文件编辑器与扩展名管理" });
		containerEl.createEl("p", {
			text: "支持以文本编辑器方式在 Obsidian 中打开并编辑各种代码、配置、字幕等文本文件。添加或移除后立即生效。"
		});

		// 1. 已启用的扩展名 Badge 列表
		this.renderActiveBadgesSection(containerEl);

		// 2. 预设分组快捷选择
		this.renderPresetGroupsSection(containerEl);

		// 3. 手动添加自定义扩展名
		this.renderManualAddSection(containerEl);

		// 4. 右键菜单与新建选项
		this.renderContextMenuSection(containerEl);
	}

	private renderActiveBadgesSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "已启用的扩展名 (Active Extensions)" });
		containerEl.createEl("p", {
			text: "以下扩展名的文件将统一在文本/代码编辑器中打开。点击标签右侧的 × 即可移除。"
		});

		const currentExtensions = this.plugin.settings.customExtensions;
		const badgeContainer = containerEl.createDiv({ cls: "file-editor-badge-container" });

		if (currentExtensions.length === 0) {
			const emptyHint = badgeContainer.createDiv({ cls: "file-editor-empty-hint" });
			emptyHint.setText("暂无启用的扩展名。请从下方预设分组中选择，或在下方手动输入添加。");
		} else {
			for (const ext of currentExtensions) {
				const badgeEl = badgeContainer.createDiv({ cls: "file-editor-badge" });
				
				const textEl = badgeEl.createSpan({ cls: "file-editor-badge-text" });
				textEl.setText(`.${ext}`);

				const closeBtn = badgeEl.createEl("button", { cls: "file-editor-badge-close" });
				closeBtn.setAttribute("aria-label", `移除 .${ext}`);
				setIcon(closeBtn, "x");

				closeBtn.addEventListener("click", async (e: MouseEvent) => {
					e.stopPropagation();
					await this.plugin.extensionManager.removeExtension(ext);
					new Notice(`已移除 .${ext}`);
					this.display();
				});
			}
		}

		// 操作按钮栏：恢复默认 & 清空全部
		const actionsContainer = containerEl.createDiv({ cls: "file-editor-badge-actions" });

		const resetBtn = actionsContainer.createEl("button", { text: "恢复默认设置" });
		resetBtn.addEventListener("click", async () => {
			await this.plugin.extensionManager.resetToDefaults();
			new Notice("已恢复默认扩展名列表");
			this.display();
		});

		if (currentExtensions.length > 0) {
			const clearBtn = actionsContainer.createEl("button", {
				text: "清空全部",
				cls: "mod-warning"
			});
			clearBtn.addEventListener("click", async () => {
				await this.plugin.extensionManager.clearAll();
				new Notice("已清空所有扩展名");
				this.display();
			});
		}
	}

	private renderPresetGroupsSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "预设扩展名分组 (Preset Groups)" });
		containerEl.createEl("p", {
			text: "点击标签可快速添加或移除对应后缀；也可以使用右上角的一键添加整组。"
		});

		const currentExtensionsSet = new Set(this.plugin.settings.customExtensions);

		for (const group of PRESET_GROUPS) {
			const groupEl = containerEl.createDiv({ cls: "file-editor-preset-group" });

			// 分组头部
			const headerEl = groupEl.createDiv({ cls: "file-editor-preset-header" });
			const titleWrap = headerEl.createDiv({ cls: "file-editor-preset-title-wrap" });
			titleWrap.createDiv({ cls: "file-editor-preset-title", text: group.name });
			titleWrap.createDiv({ cls: "file-editor-preset-desc", text: group.description });

			// 分组操作按钮
			const actionsEl = headerEl.createDiv({ cls: "file-editor-preset-actions" });
			
			const addAllBtn = actionsEl.createEl("button", { text: "+ 全部添加" });
			addAllBtn.addEventListener("click", async () => {
				const addedCount = await this.plugin.extensionManager.addExtensions(group.extensions);
				new Notice(addedCount > 0 ? `已添加 ${addedCount} 个扩展名` : "该分组下的所有扩展名已全部添加");
				this.display();
			});

			const removeAllBtn = actionsEl.createEl("button", { text: "- 全部移除" });
			removeAllBtn.addEventListener("click", async () => {
				const removedCount = await this.plugin.extensionManager.removeExtensions(group.extensions);
				new Notice(removedCount > 0 ? `已移除 ${removedCount} 个扩展名` : "该分组下的扩展名未在启用列表中");
				this.display();
			});

			// 分组标签项
			const itemsEl = groupEl.createDiv({ cls: "file-editor-preset-items" });
			for (const ext of group.extensions) {
				const isAdded = currentExtensionsSet.has(ext);
				const btn = itemsEl.createDiv({
					cls: `file-editor-preset-btn ${isAdded ? "is-added" : ""}`
				});

				if (isAdded) {
					btn.setText(`.${ext} ✓`);
					btn.setAttribute("aria-label", `已启用 (点击移除 .${ext})`);
				} else {
					btn.setText(`+ .${ext}`);
					btn.setAttribute("aria-label", `点击启用 .${ext}`);
				}

				btn.addEventListener("click", async () => {
					if (isAdded) {
						await this.plugin.extensionManager.removeExtension(ext);
						new Notice(`已移除 .${ext}`);
					} else {
						await this.plugin.extensionManager.addExtension(ext);
						new Notice(`已添加 .${ext}`);
					}
					this.display();
				});
			}
		}
	}

	private renderManualAddSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "手动添加扩展名 (Custom Input)" });

		let inputVal = "";
		new Setting(containerEl)
			.setName("添加自定义扩展名")
			.setDesc("输入任意文件后缀（无需输入前面的点），支持逗号或空格批量输入（例如: log, ini, conf, env）。")
			.addText(text => {
				text.setPlaceholder("例如: log, ini, conf")
					.onChange(val => {
						inputVal = val;
					});
				text.inputEl.addEventListener("keydown", async (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await handleAdd();
					}
				});
			})
			.addButton(button => {
				button.setButtonText("添加")
					.setCta()
					.onClick(async () => {
						await handleAdd();
					});
			});

		const handleAdd = async () => {
			const raw = inputVal.trim();
			if (!raw) {
				new Notice("请输入文件扩展名。");
				return;
			}

			const candidates = raw
				.split(/[,;\s]+/)
				.map(normalizeExtension)
				.filter(Boolean);

			if (candidates.length === 0) {
				new Notice("请输入有效的文件扩展名。");
				return;
			}

			let addedCount = 0;
			for (const ext of candidates) {
				const validation = validateExtension(ext, this.plugin.settings.customExtensions);
				if (!validation.valid) {
					new Notice(validation.error || `扩展名无效: ${ext}`);
					continue;
				}

				await this.plugin.extensionManager.addExtension(ext);
				addedCount++;
			}

			if (addedCount > 0) {
				new Notice(`成功添加 ${addedCount} 个扩展名。`);
				this.display();
			}
		};
	}

	private renderContextMenuSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "右键菜单与新建设置" });

		new Setting(containerEl)
			.setName("在文件右键菜单中显示新建选项")
			.setDesc("在文件列表中右键文件夹或文件时，显示“Create new [EXT]”选项以便快速创建新文件。")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCustomInContextMenu)
				.onChange(async (val) => {
					this.plugin.settings.showCustomInContextMenu = val;
					await this.plugin.saveSettings();
				}));
	}
}
