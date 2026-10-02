import { Extension } from "@codemirror/state";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage, StreamParser } from "@codemirror/language";

import { toml } from "@codemirror/legacy-modes/mode/toml";
import { javascript, typescript } from "@codemirror/legacy-modes/mode/javascript";
import { python } from "@codemirror/legacy-modes/mode/python";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { standardSQL } from "@codemirror/legacy-modes/mode/sql";
import { cpp, c } from "@codemirror/legacy-modes/mode/clike";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { go } from "@codemirror/legacy-modes/mode/go";
import { css } from "@codemirror/legacy-modes/mode/css";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { lua } from "@codemirror/legacy-modes/mode/lua";

type LanguageFactory = () => Extension;

const languageRegistry = new Map<string, LanguageFactory>();

function register(extensions: string[], factory: LanguageFactory): void {
	for (const ext of extensions) {
		languageRegistry.set(ext.toLowerCase().replace(/^\.+/, ""), factory);
	}
}

// Helper to create and cache StreamLanguage instances lazily
function stream(parser: StreamParser<unknown>): LanguageFactory {
	let cached: Extension | null = null;
	return () => (cached ??= StreamLanguage.define(parser));
}

// 1. Lezer AST parsers
register(["json", "jsonc", "json5"], () => json());
register(["xml", "html", "htm", "svg"], () => xml());
register(["yaml", "yml"], () => yaml());

// 2. StreamLanguage legacy parsers
register(["js", "jsx", "mjs", "cjs"], stream(javascript));
register(["ts", "tsx", "mts", "cts"], stream(typescript));
register(["py", "pyw", "pyx"], stream(python));
register(["sh", "bash", "zsh"], stream(shell));
register(["sql"], stream(standardSQL));
register(["cpp", "hpp", "cc", "cxx"], stream(cpp));
register(["c", "h"], stream(c));
register(["rs"], stream(rust));
register(["go"], stream(go));
register(["css", "scss", "less"], stream(css));
register(["ini", "conf", "env", "properties"], stream(properties));
register(["toml"], stream(toml));
register(["diff", "patch"], stream(diff));
register(["dockerfile"], stream(dockerFile));
register(["lua"], stream(lua));

/**
 * Returns the CodeMirror syntax highlighting Extension for a given extension,
 * or an empty array (plain text mode) if not supported.
 */
export function getLanguageExtension(extension?: string): Extension {
	if (!extension) return [];
	const cleanExt = extension.toLowerCase().replace(/^\.+/, "").trim();
	const factory = languageRegistry.get(cleanExt);
	return factory ? factory() : [];
}

/**
 * Checks whether a given extension has a dedicated syntax highlighting parser.
 */
export function hasLanguageSupport(extension?: string): boolean {
	if (!extension) return false;
	const cleanExt = extension.toLowerCase().replace(/^\.+/, "").trim();
	return languageRegistry.has(cleanExt);
}
