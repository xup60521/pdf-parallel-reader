import type { Content, Editor, Range } from "@tiptap/core";
import {
	Code2,
	Heading1,
	Heading2,
	Heading3,
	Highlighter,
	List,
	ListChecks,
	ListOrdered,
	Minus,
	Quote,
	Sigma,
	SquareSigma,
	Table2,
	Text,
} from "lucide-react";
import type { ComponentType } from "react";

export type SlashCommandItem = {
	title: string;
	subtitle: string;
	group: string;
	icon: ComponentType<{ className?: string }>;
	searchTerms: string[];
	command: (props: { editor: Editor; range: Range }) => void;
};

function clamp(pos: number, max: number) {
	return Math.min(Math.max(pos, 0), max);
}

/** Replaces the typed `/query` with a node the chain commands cannot express. */
function replaceRangeWith(editor: Editor, range: Range, content: Content) {
	editor
		.chain()
		.focus()
		.command(({ tr, commands }) => {
			const from = clamp(range.from, tr.doc.content.size);
			const to = clamp(Math.max(range.to, from), tr.doc.content.size);
			tr.delete(from, to);
			const insertAt = clamp(tr.mapping.map(from), tr.doc.content.size);
			return commands.insertContentAt(insertAt, content);
		})
		.run();
}

export const slashCommandItems: SlashCommandItem[] = [
	{
		title: "Text",
		subtitle: "Plain paragraph",
		group: "Basics",
		icon: Text,
		searchTerms: ["paragraph", "plain", "body"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).setNode("paragraph").run(),
	},
	{
		title: "Heading 1",
		subtitle: "Section title",
		group: "Basics",
		icon: Heading1,
		searchTerms: ["title", "h1", "large"],
		command: ({ editor, range }) =>
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 1 })
				.run(),
	},
	{
		title: "Heading 2",
		subtitle: "Subsection title",
		group: "Basics",
		icon: Heading2,
		searchTerms: ["subtitle", "h2", "medium"],
		command: ({ editor, range }) =>
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 2 })
				.run(),
	},
	{
		title: "Heading 3",
		subtitle: "Minor heading",
		group: "Basics",
		icon: Heading3,
		searchTerms: ["h3", "small"],
		command: ({ editor, range }) =>
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.setNode("heading", { level: 3 })
				.run(),
	},
	{
		title: "Bullet list",
		subtitle: "Unordered points",
		group: "Lists",
		icon: List,
		searchTerms: ["unordered", "bullet", "ul"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).toggleBulletList().run(),
	},
	{
		title: "Numbered list",
		subtitle: "Ordered steps",
		group: "Lists",
		icon: ListOrdered,
		searchTerms: ["ordered", "numbered", "ol"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
	},
	{
		title: "Checklist",
		subtitle: "Track follow-ups",
		group: "Lists",
		icon: ListChecks,
		searchTerms: ["task", "todo", "checkbox", "check"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).toggleTaskList().run(),
	},
	{
		title: "Quote",
		subtitle: "Cite the page",
		group: "Blocks",
		icon: Quote,
		searchTerms: ["quote", "blockquote", "cite", "excerpt"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
	},
	{
		title: "Code block",
		subtitle: "Fenced code",
		group: "Blocks",
		icon: Code2,
		searchTerms: ["code", "snippet", "pre", "fence"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
	},
	{
		title: "Table",
		subtitle: "3 by 3 grid",
		group: "Blocks",
		icon: Table2,
		searchTerms: ["table", "grid", "rows", "columns"],
		command: ({ editor, range }) =>
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
				.run(),
	},
	{
		title: "Divider",
		subtitle: "Horizontal rule",
		group: "Blocks",
		icon: Minus,
		searchTerms: ["divider", "rule", "hr", "separator", "break"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
	},
	{
		title: "Highlight",
		subtitle: "Mark the next words",
		group: "Marks",
		icon: Highlighter,
		searchTerms: ["highlight", "mark", "marker", "yellow"],
		command: ({ editor, range }) =>
			editor.chain().focus().deleteRange(range).setMark("highlight").run(),
	},
	{
		title: "Inline math",
		subtitle: "LaTeX in a sentence",
		group: "Math",
		icon: Sigma,
		searchTerms: ["math", "inline", "katex", "latex", "equation", "formula"],
		command: ({ editor, range }) =>
			replaceRangeWith(editor, range, {
				type: "inlineMath",
				attrs: { latex: "x^2" },
			}),
	},
	{
		title: "Block math",
		subtitle: "Displayed equation",
		group: "Math",
		icon: SquareSigma,
		searchTerms: ["math", "block", "katex", "latex", "display"],
		command: ({ editor, range }) =>
			replaceRangeWith(editor, range, {
				type: "blockMath",
				attrs: { latex: "\\sum_{i=1}^{n} x_i" },
			}),
	},
];

export function filterSlashItems(query: string): SlashCommandItem[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return slashCommandItems;

	return slashCommandItems.filter(
		(item) =>
			item.title.toLowerCase().includes(normalized) ||
			item.searchTerms.some((term) => term.includes(normalized)),
	);
}
