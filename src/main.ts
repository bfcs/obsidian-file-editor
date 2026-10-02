import { Plugin, TFile } from "obsidian";
import { CodeEditorView, VIEW_TYPE_CODE_EDITOR } from "./editor-view";
import { ExtensionManager, DEFAULT_EXTENSIONS } from "./extension-manager";
import { CreateFileModal } from "./create-file-modal";
import { FileEditorSettings, DEFAULT_SETTINGS, FileEditorSettingTab } from "./settings";

export default class MyPlugin extends Plugin {
	settings: FileEditorSettings;
	extensionManager: ExtensionManager;

	async onload() {
		await this.loadSettings();

		this.extensionManager = new ExtensionManager(this);

		this.registerView(
			VIEW_TYPE_CODE_EDITOR,
			(leaf) => new CodeEditorView(leaf)
		);

		this.extensionManager.registerAllConfiguredExtensions();

		this.addSettingTab(new FileEditorSettingTab(this.app, this));
		this.registerContextMenuCommand();
		this.registerCommands();
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

		let list: string[] = [];
		if (Array.isArray(data?.customExtensions)) {
			list = data.customExtensions;
		} else if (data) {
			// Backwards compatibility migration from old format
			if (data.enableJson ?? true) list.push("json");
			if (data.enableXml ?? true) list.push("xml");
			if (data.enableYaml ?? true) list.push("yaml", "yml");
			if (data.enableToml ?? true) list.push("toml");
			if (data.enableTxt ?? true) list.push("txt");
		} else {
			list = [...DEFAULT_EXTENSIONS];
		}

		this.settings.customExtensions = Array.from(new Set(
			list.map(ext => ext.trim().toLowerCase().replace(/^\.+/, "")).filter(Boolean)
		));
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private registerCommands(): void {
		this.addCommand({
			id: "create-custom-file",
			name: "Create new file with custom extension",
			callback: () => {
				const folderPath = this.getActiveFolderPath();
				new CreateFileModal(this.app, this, folderPath).open();
			}
		});
	}

	private getActiveFolderPath(): string {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile && activeFile.parent) {
			return activeFile.parent.path;
		}
		return "/";
	}

	private registerContextMenuCommand(): void {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				const parent = file instanceof TFile ? file.parent : file;
				const parentPath = parent ? parent.path : "/";

				if (!this.settings.showCustomInContextMenu || this.settings.customExtensions.length === 0) {
					return;
				}

				const maxDirectItems = 10;
				const extsToShow = this.settings.customExtensions.slice(0, maxDirectItems);

				for (const ext of extsToShow) {
					menu.addItem((item) => {
						item.setTitle(`Create new ${ext.toUpperCase()}`)
							.setIcon("document")
							.onClick(async () => {
								await this.createFileInPath(parentPath, "Untitled", ext);
							});
					});
				}

				if (this.settings.customExtensions.length > maxDirectItems) {
					menu.addItem((item) => {
						item.setTitle("Create file with custom extension...")
							.setIcon("plus")
							.onClick(() => {
								new CreateFileModal(this.app, this, parentPath).open();
							});
					});
				}
			})
		);
	}

	async createFileInPath(dirPath: string, baseName: string, extension: string): Promise<void> {
		const { vault } = this.app;
		let name = `${baseName}.${extension}`;
		let filePath = `${dirPath === "/" || !dirPath ? "" : dirPath + "/"}${name}`;
		let i = 1;

		while (await vault.adapter.exists(filePath)) {
			name = `${baseName} ${i}.${extension}`;
			filePath = `${dirPath === "/" || !dirPath ? "" : dirPath + "/"}${name}`;
			i++;
		}

		try {
			const newFile = await vault.create(filePath, "");
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(newFile);
		} catch (error) {
			console.error("Failed to create file:", error);
		}
	}

	onunload() {
		if (this.extensionManager) {
			this.extensionManager.unregisterAll();
		}
	}
}
