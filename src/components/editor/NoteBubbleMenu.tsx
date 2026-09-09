import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
	Bold,
	Code,
	Heading2,
	Heading3,
	Highlighter,
	Italic,
	Link2,
	Link2Off,
	Quote,
	Strikethrough,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "../../lib/utils";

type MarkButtonProps = {
	icon: ComponentType<{ className?: string }>;
	label: string;
	isActive: boolean;
	onClick: () => void;
};

function MarkButton({ icon: Icon, label, isActive, onClick }: MarkButtonProps) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			aria-pressed={isActive}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
			className={cn(
				"flex size-7 items-center justify-center rounded-chip transition-colors",
				isActive
					? "bg-quill text-white dark:text-[color:var(--primary-foreground)]"
					: "text-ink-2 hover:bg-surface-3 hover:text-ink",
			)}
		>
			<Icon className="size-3.5" />
		</button>
	);
}

/**
 * Appears only on a selection. Everything else in the editor is reachable from
 * the slash menu or a markdown shortcut, so the note itself carries no chrome.
 */
export function NoteBubbleMenu({ editor }: { editor: Editor }) {
	// The editor does not re-render per transaction, so active states are read
	// through a selector that only wakes this component when they actually change.
	const active = useEditorState({
		editor,
		selector: ({ editor: instance }) => ({
			bold: instance.isActive("bold"),
			italic: instance.isActive("italic"),
			strike: instance.isActive("strike"),
			highlight: instance.isActive("highlight"),
			code: instance.isActive("code"),
			h2: instance.isActive("heading", { level: 2 }),
			h3: instance.isActive("heading", { level: 3 }),
			quote: instance.isActive("blockquote"),
			link: instance.isActive("link"),
		}),
	});

	function toggleLink() {
		if (editor.isActive("link")) {
			editor.chain().focus().unsetLink().run();
			return;
		}
		const href = window.prompt("Link address");
		if (!href) return;
		editor
			.chain()
			.focus()
			.setLink({ href, target: "_blank", rel: "noopener noreferrer" })
			.run();
	}

	return (
		<BubbleMenu
			editor={editor}
			options={{ placement: "top", offset: 8 }}
			shouldShow={({ editor: instance, from, to }) =>
				from !== to &&
				!instance.isActive("codeBlock") &&
				!instance.isActive("inlineMath") &&
				!instance.isActive("blockMath")
			}
			className="flex items-center gap-0.5 rounded-control border border-rule bg-surface p-1 shadow-float"
		>
			<MarkButton
				icon={Bold}
				label="Bold"
				isActive={active.bold}
				onClick={() => editor.chain().focus().toggleBold().run()}
			/>
			<MarkButton
				icon={Italic}
				label="Italic"
				isActive={active.italic}
				onClick={() => editor.chain().focus().toggleItalic().run()}
			/>
			<MarkButton
				icon={Strikethrough}
				label="Strikethrough"
				isActive={active.strike}
				onClick={() => editor.chain().focus().toggleStrike().run()}
			/>
			<MarkButton
				icon={Highlighter}
				label="Highlight"
				isActive={active.highlight}
				onClick={() => editor.chain().focus().toggleHighlight().run()}
			/>
			<MarkButton
				icon={Code}
				label="Inline code"
				isActive={active.code}
				onClick={() => editor.chain().focus().toggleCode().run()}
			/>

			<span className="mx-0.5 h-4 w-px bg-rule" />

			<MarkButton
				icon={Heading2}
				label="Heading 2"
				isActive={active.h2}
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
			/>
			<MarkButton
				icon={Heading3}
				label="Heading 3"
				isActive={active.h3}
				onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
			/>
			<MarkButton
				icon={Quote}
				label="Quote"
				isActive={active.quote}
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
			/>

			<span className="mx-0.5 h-4 w-px bg-rule" />

			<MarkButton
				icon={active.link ? Link2Off : Link2}
				label={active.link ? "Remove link" : "Add link"}
				isActive={active.link}
				onClick={toggleLink}
			/>
		</BubbleMenu>
	);
}
