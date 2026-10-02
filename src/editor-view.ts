import { TextFileView, WorkspaceLeaf, TFile } from "obsidian";
import { EditorState, Extension, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { HighlightStyle, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import * as cmLanguage from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { getLanguageExtension } from "./languages";

export const VIEW_TYPE_CODE_EDITOR = "code-editor-view";

export const obsidianHighlightStyle = HighlightStyle.define([
	{
		tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword],
		color: "var(--code-keyword, var(--color-pink, #e06c75))"
	},
	{
		tag: [t.name, t.deleted, t.character, t.macroName, t.variableName, t.labelName, t.definition(t.name)],
		color: "var(--code-normal, var(--text-normal, #abb2bf))"
	},
	{
		tag: [t.propertyName, t.attributeName],
		color: "var(--code-property, var(--color-cyan, #56b6c2))"
	},
	{
		tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)],
		color: "var(--code-string, var(--color-green, #98c379))"
	},
	{
		tag: [t.function(t.variableName), t.tagName, t.angleBracket],
		color: "var(--code-function, var(--color-blue, #61afef))"
	},
	{
		tag: [t.color, t.constant(t.name), t.standard(t.name), t.number, t.changed, t.annotation, t.self, t.namespace, t.atom, t.bool, t.null],
		color: "var(--code-value, var(--color-orange, #d19a66))"
	},
	{
		tag: [t.className, t.typeName],
		color: "var(--code-type, var(--color-yellow, #e5c07b))"
	},
	{
		tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.bitwiseOperator, t.compareOperator, t.updateOperator, t.definitionOperator, t.typeOperator, t.controlOperator],
		color: "var(--code-operator, var(--color-cyan, #56b6c2))"
	},
	{
		tag: [t.separator, t.punctuation, t.bracket, t.squareBracket],
		color: "var(--code-punctuation, var(--text-muted, #7f848e))"
	},
	{
		tag: [t.url, t.escape, t.regexp, t.link],
		color: "var(--code-string, var(--color-green, #98c379))"
	},
	{
		tag: [t.meta, t.comment, t.documentMeta, t.lineComment, t.blockComment],
		color: "var(--code-comment, var(--text-muted, #7f848e))",
		fontStyle: "italic"
	},
	{ tag: t.strong, fontWeight: "bold" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.strikethrough, textDecoration: "line-through" },
	{ tag: t.link, textDecoration: "underline" },
	{
		tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
		fontWeight: "bold",
		color: "var(--text-title-h1, var(--color-blue, #61afef))"
	},
	{ tag: t.invalid, color: "var(--text-error, var(--color-red, #e06c75))" },
]);

export class CodeEditorView extends TextFileView {
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
					...((cmLanguage as Record<string, unknown>).lineHighlighter
						? [(cmLanguage as Record<string, unknown>).lineHighlighter as Extension]
						: []),
					EditorView.theme({
						"&": {
							height: "100%",
							backgroundColor: "var(--background-primary)",
							color: "var(--text-normal)"
						},
						".cm-scroller": {
							fontFamily: "var(--font-monospace)",
							lineHeight: "var(--line-height-normal, 1.5)"
						},
						".cm-gutters": {
							backgroundColor: "var(--background-primary)",
							color: "var(--text-faint)",
							borderRight: "1px solid var(--background-modifier-border)"
						},
						".cm-gutterElement": {
							color: "var(--text-faint)",
							padding: "0 8px 0 16px"
						},
						".cm-activeLineGutter": {
							backgroundColor: "var(--background-modifier-hover, rgba(255, 255, 255, 0.06))",
							color: "var(--text-normal)",
							fontWeight: "600"
						},
						".cm-activeLine": {
							backgroundColor: "var(--background-modifier-hover, rgba(255, 255, 255, 0.03))"
						},
						".cm-cursor, .cm-dropCursor": {
							borderLeftColor: "var(--text-normal)"
						},
						"&.cm-focused .cm-cursor": {
							borderLeftColor: "var(--text-normal)"
						},
						"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
							backgroundColor: "var(--text-selection) !important"
						}
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

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		if (this.editor) {
			this.editor.dispatch({
				effects: this.languageCompartment.reconfigure(this.getLanguageExtension())
			});
		}
	}

	getLanguageExtension(): Extension {
		return getLanguageExtension(this.file?.extension);
	}

	getViewData(): string {
		return this.editor ? this.editor.state.doc.toString() : this.data;
	}

	setViewData(data: string, clear: boolean): void {
		if (this.editor) {
			this.editor.dispatch({
				changes: { from: 0, to: this.editor.state.doc.length, insert: data },
				effects: this.languageCompartment.reconfigure(this.getLanguageExtension())
			});
		} else {
			this.data = data;
		}
	}

	clear(): void {
		if (this.editor) {
			this.editor.dispatch({
				changes: { from: 0, to: this.editor.state.doc.length, insert: "" }
			});
		}
	}
}
