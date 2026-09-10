import type { AnyExtension } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Mathematics } from "@tiptap/extension-mathematics";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { MarkdownPaste } from "./markdown";
import { SlashCommand } from "./slash/slash-command";

/**
 * One extension list for every note surface, so the editable editor and any
 * read-only render can never drift apart in what markdown they understand.
 *
 * Beyond the basics, the set is chosen for what someone actually writes while
 * reading a paper: highlights, checkboxes for follow-ups, tables, and math.
 */
const slashHint = "Type / for commands";

export function createNoteExtensions(options: {
	placeholder: string;
	interactive?: boolean;
}): AnyExtension[] {
	const { placeholder, interactive = true } = options;

	const extensions: AnyExtension[] = [
		StarterKit.configure({
			heading: { levels: [1, 2, 3] },
			link: {
				openOnClick: false,
				autolink: true,
				defaultProtocol: "https",
				HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
			},
			codeBlock: { languageClassPrefix: "language-" },
		}),
		Highlight.configure({ multicolor: false }),
		TaskList,
		TaskItem.configure({ nested: true }),
		TableKit.configure({
			table: { resizable: true, cellMinWidth: 72 },
		}),
		Mathematics,
		MarkdownPaste,
		/*
		  Two hints, as the design draws them: the empty note says what it is for,
		  and an empty line inside a written note points at the slash menu.
		*/
		Placeholder.configure({
			placeholder: ({ editor }) => (editor.isEmpty ? placeholder : slashHint),
			showOnlyWhenEditable: true,
			showOnlyCurrent: true,
		}),
	];

	if (interactive) {
		extensions.push(SlashCommand);
	}

	return extensions;
}
