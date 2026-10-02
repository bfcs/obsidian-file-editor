import { App, Modal, Notice, Setting } from 'obsidian';
import type MyPlugin from './main';
import { normalizeExtension } from './extension-manager';

export class CreateFileModal extends Modal {
	plugin: MyPlugin;
	targetFolder: string;
	fileName: string = "Untitled";
	extension: string = "";

	constructor(app: App, plugin: MyPlugin, targetFolder: string = "/") {
		super(app);
		this.plugin = plugin;
		this.targetFolder = targetFolder;
		const customExts = this.plugin.settings.customExtensions;
		this.extension = (customExts.length > 0 && customExts[0]) ? customExts[0] : "txt";
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create New File" });

		new Setting(contentEl)
			.setName("File name")
			.setDesc("Name of the file (without extension)")
			.addText((text) => {
				text.setValue(this.fileName)
					.onChange((val) => {
						this.fileName = val.trim();
					});
				text.inputEl.addEventListener("keydown", async (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await this.submit();
					}
				});
			});

		new Setting(contentEl)
			.setName("Extension")
			.setDesc("File extension (without dot)")
			.addText((text) => {
				text.setPlaceholder("e.g. log, ini, sql, conf")
					.setValue(this.extension)
					.onChange((val) => {
						this.extension = normalizeExtension(val);
					});
				text.inputEl.addEventListener("keydown", async (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await this.submit();
					}
				});
			});

		new Setting(contentEl)
			.addButton((btn) => btn
				.setButtonText("Create")
				.setCta()
				.onClick(async () => {
					await this.submit();
				}))
			.addButton((btn) => btn
				.setButtonText("Cancel")
				.onClick(() => {
					this.close();
				}));
	}

	private async submit(): Promise<void> {
		const name = this.fileName.trim() || "Untitled";
		const ext = normalizeExtension(this.extension);
		if (!ext) {
			new Notice("Please enter a valid file extension.");
			return;
		}

		this.close();
		await this.plugin.createFileInPath(this.targetFolder, name, ext);
	}

	onClose() {
		this.contentEl.empty();
	}
}
