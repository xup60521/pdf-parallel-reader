import { Extension } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import MarkdownIt from "markdown-it";
import TurndownService from "turndown";

/* ------------------------------------------------------------------ */
/* Markdown -> HTML                                                     */
/* ------------------------------------------------------------------ */

const md = new MarkdownIt({ breaks: true, html: false, linkify: true });

function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/** `$$ … $$`, either on one line or fenced across several. */
md.block.ruler.before(
	"paragraph",
	"math_block",
	(state, startLine, endLine) => {
		const start = state.bMarks[startLine] + state.tShift[startLine];
		const firstLine = state.src.slice(start, state.eMarks[startLine]);
		if (!firstLine.startsWith("$$")) return false;

		const inline = firstLine.slice(2).trim();
		if (inline.endsWith("$$") && inline.length > 2) {
			const token = state.push("math_block", "div", 0);
			token.block = true;
			token.content = inline.slice(0, -2).trim();
			token.map = [startLine, startLine + 1];
			state.line = startLine + 1;
			return true;
		}

		const lines = inline ? [inline] : [];
		for (let line = startLine + 1; line < endLine; line++) {
			const text = state.src.slice(
				state.bMarks[line] + state.tShift[line],
				state.eMarks[line],
			);
			if (text.trim() === "$$") {
				const token = state.push("math_block", "div", 0);
				token.block = true;
				token.content = lines.join("\n").trim();
				token.map = [startLine, line + 1];
				state.line = line + 1;
				return true;
			}
			lines.push(text);
		}
		return false;
	},
);

/** `$ … $`, skipping escaped and doubled delimiters. */
md.inline.ruler.before("escape", "math_inline", (state, silent) => {
	if (state.src.charCodeAt(state.pos) !== 0x24) return false;
	if (state.src.charCodeAt(state.pos + 1) === 0x24) return false;

	let end = state.pos + 1;
	while (end < state.posMax) {
		end = state.src.indexOf("$", end);
		if (end === -1) return false;
		const escaped = state.src.charCodeAt(end - 1) === 0x5c;
		const doubled = state.src.charCodeAt(end + 1) === 0x24;
		if (!escaped && !doubled) break;
		end += 1;
	}

	const latex = state.src.slice(state.pos + 1, end).trim();
	if (!latex) return false;

	if (!silent) {
		const token = state.push("math_inline", "span", 0);
		token.content = latex;
	}
	state.pos = end + 1;
	return true;
});

md.renderer.rules.math_block = (tokens, idx) =>
	`<div data-type="block-math" data-latex="${escapeAttribute(tokens[idx]?.content ?? "")}"></div>`;

md.renderer.rules.math_inline = (tokens, idx) =>
	`<span data-type="inline-math" data-latex="${escapeAttribute(tokens[idx]?.content ?? "")}"></span>`;

/**
 * Rewrites GitHub task-list items into the `<ul data-type="taskList">` shape
 * TipTap's TaskList parses. markdown-it emits them as plain list items whose
 * text still starts with `[ ]`.
 */
function promoteTaskLists(container: HTMLElement): void {
	for (const list of Array.from(container.querySelectorAll("ul"))) {
		const items = Array.from(list.children).filter(
			(child): child is HTMLLIElement => child.tagName === "LI",
		);
		if (items.length === 0) continue;

		const parsed = items.map((item) => {
			const match = item.textContent?.match(/^\s*\[([ xX])\]\s?/);
			return match ? { item, checked: match[1].toLowerCase() === "x" } : null;
		});
		if (parsed.some((entry) => entry === null)) continue;

		list.setAttribute("data-type", "taskList");
		for (const entry of parsed) {
			if (!entry) continue;
			entry.item.setAttribute("data-type", "taskItem");
			entry.item.setAttribute("data-checked", String(entry.checked));
			// Strip the `[ ] ` marker from the first text node only.
			const walker = document.createTreeWalker(
				entry.item,
				NodeFilter.SHOW_TEXT,
			);
			const first = walker.nextNode();
			if (first?.nodeValue) {
				first.nodeValue = first.nodeValue.replace(/^\s*\[[ xX]\]\s?/, "");
			}
		}
	}
}

/** `==text==` is not core markdown-it; map it onto a `<mark>`. */
function promoteHighlights(container: HTMLElement): void {
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
	const targets: Text[] = [];
	let node = walker.nextNode();
	while (node) {
		if (node.nodeValue && /==[^=]+==/.test(node.nodeValue)) {
			targets.push(node as Text);
		}
		node = walker.nextNode();
	}

	for (const text of targets) {
		const fragment = document.createDocumentFragment();
		const parts = (text.nodeValue ?? "").split(/==([^=]+)==/g);
		parts.forEach((part, index) => {
			if (index % 2 === 1) {
				const mark = document.createElement("mark");
				mark.textContent = part;
				fragment.appendChild(mark);
			} else if (part) {
				fragment.appendChild(document.createTextNode(part));
			}
		});
		text.replaceWith(fragment);
	}
}

export function markdownToHtml(markdown: string): string {
	if (!markdown?.trim()) return "<p></p>";
	const html = md.render(markdown);
	if (typeof document === "undefined") return html;

	const container = document.createElement("div");
	container.innerHTML = html;
	promoteTaskLists(container);
	promoteHighlights(container);
	return container.innerHTML;
}

/* ------------------------------------------------------------------ */
/* HTML -> Markdown                                                     */
/* ------------------------------------------------------------------ */

const turndown = new TurndownService({
	headingStyle: "atx",
	hr: "---",
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
	emDelimiter: "*",
	strongDelimiter: "**",
});

turndown.addRule("fencedCodeBlock", {
	filter: (node) =>
		node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
	replacement: (_content, node) => {
		const code = node.textContent ?? "";
		const language =
			(node.firstChild as HTMLElement | null)?.className?.match(
				/language-([\w-]+)/,
			)?.[1] ?? "";
		return `\n\n\`\`\`${language}\n${code.replace(/\n$/, "")}\n\`\`\`\n\n`;
	},
});

turndown.addRule("taskListItem", {
	filter: (node) =>
		node.nodeName === "LI" && node.getAttribute("data-type") === "taskItem",
	replacement: (content, node) => {
		const checked =
			(node as HTMLElement).getAttribute("data-checked") === "true";
		const body = content
			.replace(/^\n+/, "")
			.replace(/\n+$/, "")
			.replace(/\n/g, "\n  ")
			.trim();
		return `- [${checked ? "x" : " "}] ${body}\n`;
	},
});

turndown.addRule("highlight", {
	filter: ["mark"],
	replacement: (content) => (content ? `==${content}==` : ""),
});

turndown.addRule("underline", {
	filter: ["u"],
	replacement: (content) => (content ? `<u>${content}</u>` : ""),
});

turndown.addRule("inlineMath", {
	filter: (node) => node.getAttribute("data-type") === "inline-math",
	replacement: (_content, node) =>
		`$${(node as HTMLElement).getAttribute("data-latex") ?? ""}$`,
});

turndown.addRule("blockMath", {
	filter: (node) => node.getAttribute("data-type") === "block-math",
	replacement: (_content, node) =>
		`\n\n$$\n${(node as HTMLElement).getAttribute("data-latex") ?? ""}\n$$\n\n`,
});

function cellText(cell: Element): string {
	return turndown
		.turndown(cell.innerHTML)
		.replace(/\n+/g, " ")
		.replace(/\|/g, "\\|")
		.trim();
}

/** Turndown has no table support; emit GitHub pipe tables. */
turndown.addRule("gfmTable", {
	filter: "table",
	replacement: (_content, node) => {
		const rows = Array.from((node as HTMLTableElement).querySelectorAll("tr"));
		if (rows.length === 0) return "";

		const grid = rows.map((row) =>
			Array.from(row.querySelectorAll("th, td")).map(cellText),
		);
		const columns = Math.max(...grid.map((row) => row.length));
		const pad = (row: string[]) => {
			const padded = [...row];
			while (padded.length < columns) padded.push("");
			return `| ${padded.join(" | ")} |`;
		};

		const [header, ...body] = grid;
		const divider = `| ${Array.from({ length: columns }, () => "---").join(" | ")} |`;
		return `\n\n${[pad(header), divider, ...body.map(pad)].join("\n")}\n\n`;
	},
});

/**
 * Turndown treats an element with no text as blank and swaps it out before any
 * custom rule can run. A math node carries its whole payload in `data-latex`
 * with an empty body, so without this every equation is silently dropped on
 * save. The placeholder text is discarded by the math rules above.
 */
function keepMathFromBeingBlank(container: HTMLElement): void {
	for (const node of container.querySelectorAll(
		'[data-type="inline-math"], [data-type="block-math"]',
	)) {
		if (!node.textContent?.trim()) node.textContent = "math";
	}
}

export function htmlToMarkdown(html: string): string {
	if (!html?.trim()) return "";
	if (typeof document === "undefined") return turndown.turndown(html).trim();

	const container = document.createElement("div");
	container.innerHTML = html;
	keepMathFromBeingBlank(container);
	return turndown.turndown(container).trim();
}

/* ------------------------------------------------------------------ */
/* Paste                                                                */
/* ------------------------------------------------------------------ */

function hasMarkdownTable(text: string): boolean {
	const lines = text.split("\n");
	for (let index = 0; index < lines.length - 1; index++) {
		const header = lines[index]?.trim();
		const separator = lines[index + 1]?.trim();
		if (!header || !separator) continue;
		if (
			header.includes("|") &&
			/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator)
		) {
			return true;
		}
	}
	return false;
}

export function looksLikeMarkdown(text: string): boolean {
	if (hasMarkdownTable(text)) return true;

	for (const line of text.split("\n")) {
		if (/^\s{0,3}#{1,6}\s/.test(line)) return true;
		if (/^\s{0,3}>\s/.test(line)) return true;
		if (/^\s{0,3}[-*+]\s\[[ xX]\]\s/.test(line)) return true;
		if (/^\s{0,3}[-*+]\s/.test(line)) return true;
		if (/^\s{0,3}\d+\.\s/.test(line)) return true;
		if (/^\s{0,3}`{3,}/.test(line)) return true;
		if (/^\s{0,3}(---|\*\*\*)\s*$/.test(line)) return true;
		if (/^\s{0,3}\$\$/.test(line)) return true;
	}

	if (/\*\*[^*]+\*\*/.test(text)) return true;
	if (/~~[^~]+~~/.test(text)) return true;
	if (/==[^=]+==/.test(text)) return true;
	if (/\[.+\]\(.+\)/.test(text)) return true;
	if (/`[^`]+`/.test(text)) return true;
	if (/(^|[^$])\$[^$\n]+\$(?!\$)/.test(text)) return true;
	return false;
}

/**
 * Pasting markdown from another note, a chat, or a README should keep its
 * structure rather than landing as one grey paragraph.
 */
export const MarkdownPaste = Extension.create({
	name: "markdownPaste",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("markdownPaste"),
				props: {
					handlePaste: (view, event) => {
						const plainText = event.clipboardData?.getData("text/plain");
						if (!plainText || !looksLikeMarkdown(plainText)) return false;

						const html = markdownToHtml(plainText);
						if (!html) return false;

						const container = document.createElement("div");
						container.innerHTML = html;

						const slice = ProseMirrorDOMParser.fromSchema(
							view.state.schema,
						).parseSlice(container);
						if (slice.content.size === 0) return false;

						event.preventDefault();
						view.dispatch(
							view.state.tr.replaceSelection(slice).scrollIntoView(),
						);
						return true;
					},
				},
			}),
		];
	},
});
