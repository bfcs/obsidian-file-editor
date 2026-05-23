import { Plugin, TextFileView, WorkspaceLeaf, TFile } from 'obsidian';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage, HighlightStyle, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { tags as t } from '@lezer/highlight';

import { FileEditorSettings, DEFAULT_SETTINGS, FileEditorSettingTab } from './settings';

export const VIEW_TYPE_CODE_EDITOR = "code-editor-view";

const obsidianHighlightStyle = HighlightStyle.define([
	{ tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: "var(--code-keyword)" },
	{ tag: [t.name, t.deleted, t.character, t.macroName, t.variableName, t.labelName, t.definition(t.name)], color: "var(--code-normal)" },
	{ tag: [t.propertyName, t.attributeName], color: "var(--code-property)" },
	{ tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)], color: "var(--code-string)" },
	{ tag: [t.function(t.variableName), t.tagName, t.angleBracket], color: "var(--code-function)" },
	{ tag: [t.color, t.constant(t.name), t.standard(t.name), t.number, t.changed, t.annotation, t.self, t.namespace, t.atom, t.bool, t.null], color: "var(--code-value)" },
	{ tag: [t.className, t.typeName], color: "var(--code-type)" },
	{ tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator, t.updateOperator, t.definitionOperator, t.typeOperator, t.controlOperator], color: "var(--code-operator)" },
	{ tag: [t.separator, t.punctuation, t.bracket, t.squareBracket], color: "var(--code-normal)" },
	{ tag: [t.url, t.escape, t.regexp, t.link], color: "var(--code-string)" },
	{ tag: [t.meta, t.comment, t.documentMeta, t.lineComment, t.blockComment], color: "var(--code-comment)", fontStyle: "italic" },
	{ tag: t.strong, fontWeight: "bold" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.strikethrough, textDecoration: "line-through" },
	{ tag: t.link, textDecoration: "underline" },
	{ tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: "bold", color: "var(--text-title-h1)" },
	{ tag: t.invalid, color: "var(--text-error)" },
]);

class CodeEditorView extends TextFileView {
	editor: EditorView;
	editorEl: HTMLElement;
	languageCompartment = new Compartment();

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CODE_EDITOR;
	}

	getDisplayText(): string {
		return this.file ? this.file.name : "Code Editor";
	}

	getIcon(): string {
		return "document";
	}

	async onOpen() {
		this.editorEl = this.contentEl.createDiv("datafile-source-view mod-cm6");
		
		this.editor = new EditorView({
			state: EditorState.create({
				doc: this.data,
				extensions: [
					basicSetup,
					this.languageCompartment.of(this.getLanguageExtension()),
					syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
					syntaxHighlighting(obsidianHighlightStyle),
					EditorView.theme({
						"&": { height: "100%" }
					}),
					EditorView.updateListener.of((v) => {
						if (v.docChanged) {
							this.requestSave();
						}
					})
				]
			}),
			parent: this.editorEl
		});

		this.app.workspace.trigger("codemirror", this.editor);
	}

	async onClose() {
		if (this.editor) {
			this.editor.destroy();
		}
	}

	getLanguageExtension(): Extension {
		const ext = this.file?.extension?.toLowerCase();
		let langExtension: Extension = [];

		if (ext === 'json') {
			langExtension = json();
		} else if (ext === 'xml') {
			langExtension = xml();
		} else if (ext === 'toml') {
			langExtension = StreamLanguage.define(toml);
		} else if (ext === 'yaml' || ext === 'yml') {
			langExtension = yaml();
		}

		return langExtension;
	}

	getViewData(): string {
		return this.editor ? this.editor.state.doc.toString() : this.data;
	}

	setViewData(data: string, clear: boolean): void {
		if (this.editor) {
			this.editor.dispatch({
				changes: {from: 0, to: this.editor.state.doc.length, insert: data},
				effects: this.languageCompartment.reconfigure(this.getLanguageExtension())
			});
		} else {
			this.data = data;
		}
	}

	clear(): void {
		if (this.editor) {
			this.editor.dispatch({
				changes: {from: 0, to: this.editor.state.doc.length, insert: ""}
			});
		}
	}
}

export default class MyPlugin extends Plugin {
	settings: FileEditorSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new FileEditorSettingTab(this.app, this));

		this.registerView(
			VIEW_TYPE_CODE_EDITOR,
			(leaf) => new CodeEditorView(leaf)
		);

		const activeExtensions = [];
		if (this.settings.enableJson) activeExtensions.push("json");
		if (this.settings.enableXml) activeExtensions.push("xml");
		if (this.settings.enableYaml) activeExtensions.push("yaml", "yml");
		if (this.settings.enableToml) activeExtensions.push("toml");
		if (this.settings.enableTxt) activeExtensions.push("txt");

		if (activeExtensions.length > 0) {
			try {
				this.registerExtensions(activeExtensions, VIEW_TYPE_CODE_EDITOR);
			} catch (error) {
				console.warn("obsidian-file-editor: extensions already registered or failed to register", error);
			}
		}

		this.registerContextMenuCommand();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private registerContextMenuCommand(): void {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				const parent = file instanceof TFile ? file.parent : file;
				
				if (this.settings.enableJson) {
					menu.addItem((item) => {
						item.setTitle(`Create new JSON`)
							.setIcon("document")
							.onClick(async () => {
								if (parent) await this.createFile(parent.path, "json");
							});
					});
				}
				if (this.settings.enableXml) {
					menu.addItem((item) => {
						item.setTitle(`Create new XML`)
							.setIcon("document")
							.onClick(async () => {
								if (parent) await this.createFile(parent.path, "xml");
							});
					});
				}
				if (this.settings.enableYaml) {
					menu.addItem((item) => {
						item.setTitle(`Create new YAML`)
							.setIcon("document")
							.onClick(async () => {
								if (parent) await this.createFile(parent.path, "yaml");
							});
					});
				}
				if (this.settings.enableToml) {
					menu.addItem((item) => {
						item.setTitle(`Create new TOML`)
							.setIcon("document")
							.onClick(async () => {
								if (parent) await this.createFile(parent.path, "toml");
							});
					});
				}
				if (this.settings.enableTxt) {
					menu.addItem((item) => {
						item.setTitle(`Create new TXT`)
							.setIcon("document")
							.onClick(async () => {
								if (parent) await this.createFile(parent.path, "txt");
							});
					});
				}
			})
		);
	}

	private async createFile(dirPath: string, extension: string): Promise<void> {
		const { vault } = this.app;
		let name = `Untitled.${extension}`;
		let filePath = `${dirPath === "/" ? "" : dirPath + "/"}${name}`;
		let i = 1;
		
		while (await vault.adapter.exists(filePath)) {
			name = `Untitled ${i}.${extension}`;
			filePath = `${dirPath === "/" ? "" : dirPath + "/"}${name}`;
			i++;
		}

		try {
			const newFile = await vault.create(filePath, '');
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(newFile);
		} catch (error) {
			console.error("Failed to create file:", error);
		}
	}

	onunload() {
	}
}
