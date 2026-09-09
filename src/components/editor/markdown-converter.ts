import { Extension } from "@tiptap/core";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import MarkdownIt from "markdown-it";
import TurndownService from "turndown";

const md = new MarkdownIt({
	breaks: true,
	html: false,
	linkify: true,
});

const turndown = new TurndownService({
	headingStyle: "atx",
	hr: "---",
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
});

// Custom rule for code blocks in turndown
turndown.addRule("fencedCodeBlock", {
	filter: (node) => {
		return (
			node.nodeName === "PRE" &&
			node.firstChild !== null &&
			node.firstChild.nodeName === "CODE"
		);
	},
	replacement: (_content, node) => {
		const code = node.textContent || "";
		return `\n\`\`\`\n${code}\n\`\`\`\n\n`;
	},
});

export function markdownToHtml(markdown: string): string {
	if (!markdown || !markdown.trim()) return "<p></p>";
	return md.render(markdown);
}

export function htmlToMarkdown(html: string): string {
	if (!html || !html.trim()) return "";
	const mdResult = turndown.turndown(html);
	return mdResult.trim();
}

export function looksLikeMarkdown(text: string): boolean {
	const lines = text.split("\n");
	for (const line of lines) {
		if (/^\s{0,3}(#{1,6})\s/.test(line)) return true;
		if (/^\s{0,3}>\s/.test(line)) return true;
		if (/^\s{0,3}[-*+]\s/.test(line)) return true;
		if (/^\s{0,3}\d+\.\s/.test(line)) return true;
		if (/^\s{0,3}`{3,}/.test(line)) return true;
		if (/^\s{0,3}---\s*$/.test(line)) return true;
		if (/^\s{0,3}\$\$/.test(line)) return true;
	}
	if (/\*\*[^*]+\*\*/.test(text)) return true;
	if (/\[.+\]\(.+\)/.test(text)) return true;
	if (/`[^`]+`/.test(text)) return true;
	return false;
}

export const MarkdownPasteExtension = Extension.create({
	name: "markdownPaste",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("markdownPaste"),
				props: {
					handlePaste: (view, event) => {
						const clipboardData = event.clipboardData;
						if (!clipboardData) return false;

						const plainText = clipboardData.getData("text/plain");
						if (!plainText || !looksLikeMarkdown(plainText)) return false;

						const html = md.render(plainText);
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
