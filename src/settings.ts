import { App, PluginSettingTab, Setting } from 'obsidian';
import type MyPlugin from './main';

export interface FileEditorSettings {
	enableJson: boolean;
	enableXml: boolean;
	enableYaml: boolean;
	enableToml: boolean;
	enableTxt: boolean;
}

export const DEFAULT_SETTINGS: FileEditorSettings = {
	enableJson: true,
	enableXml: true,
	enableYaml: true,
	enableToml: true,
	enableTxt: true,
}

export class FileEditorSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		
		containerEl.createEl("h2", {text: "Format Support Settings"});
		containerEl.createEl("p", {text: "Note: Changing these settings requires reloading the plugin or Obsidian for the changes to take full effect."});

		new Setting(containerEl)
			.setName('Enable JSON Support')
			.setDesc('Enable the custom editor and right-click creation for JSON files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableJson)
				.onChange(async (value) => {
					this.plugin.settings.enableJson = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable XML Support')
			.setDesc('Enable the custom editor and right-click creation for XML files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableXml)
				.onChange(async (value) => {
					this.plugin.settings.enableXml = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable YAML Support')
			.setDesc('Enable the custom editor and right-click creation for YAML/YML files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableYaml)
				.onChange(async (value) => {
					this.plugin.settings.enableYaml = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable TOML Support')
			.setDesc('Enable the custom editor and right-click creation for TOML files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableToml)
				.onChange(async (value) => {
					this.plugin.settings.enableToml = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable TXT Support')
			.setDesc('Enable the custom editor and right-click creation for plain TXT files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableTxt)
				.onChange(async (value) => {
					this.plugin.settings.enableTxt = value;
					await this.plugin.saveSettings();
				}));
	}
}
