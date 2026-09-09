import type { Editor } from "@tiptap/react";
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	Italic,
	List,
	Quote,
	Strikethrough,
} from "lucide-react";
import { useEffect, useState } from "react";

interface BubbleToolbarProps {
	editor: Editor | null;
}

export function EditorBubbleToolbar({ editor }: BubbleToolbarProps) {
	const [position, setPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);

	useEffect(() => {
		if (!editor) return;

		const updatePosition = () => {
			const { view, state } = editor;
			const { from, to, empty } = state.selection;

			if (empty || !view.hasFocus()) {
				setPosition(null);
				return;
			}

			try {
				const start = view.coordsAtPos(from);
				const end = view.coordsAtPos(to);
				const box = view.dom.getBoundingClientRect();

				const left = Math.max(10, (start.left + end.left) / 2 - box.left - 120);
				const top = Math.max(10, start.top - box.top - 42);

				setPosition({ top, left });
			} catch {
				setPosition(null);
			}
		};

		editor.on("selectionUpdate", updatePosition);
		editor.on("blur", () => setPosition(null));

		return () => {
			editor.off("selectionUpdate", updatePosition);
		};
	}, [editor]);

	if (!editor || !position) return null;

	return (
		<div
			role="toolbar"
			aria-label="Text formatting"
			className="editor-bubble-menu absolute"
			style={{
				top: `${position.top}px`,
				left: `${position.left}px`,
			}}
			onMouseDown={(e) => e.preventDefault()}
		>
			<button
				type="button"
				title="Bold (Ctrl+B)"
				onClick={() => editor.chain().focus().toggleBold().run()}
				className={`editor-bubble-btn ${editor.isActive("bold") ? "is-active" : ""}`}
			>
				<Bold className="size-3.5" />
			</button>
			<button
				type="button"
				title="Italic (Ctrl+I)"
				onClick={() => editor.chain().focus().toggleItalic().run()}
				className={`editor-bubble-btn ${editor.isActive("italic") ? "is-active" : ""}`}
			>
				<Italic className="size-3.5" />
			</button>
			<button
				type="button"
				title="Strikethrough"
				onClick={() => editor.chain().focus().toggleStrike().run()}
				className={`editor-bubble-btn ${editor.isActive("strike") ? "is-active" : ""}`}
			>
				<Strikethrough className="size-3.5" />
			</button>
			<button
				type="button"
				title="Code"
				onClick={() => editor.chain().focus().toggleCode().run()}
				className={`editor-bubble-btn ${editor.isActive("code") ? "is-active" : ""}`}
			>
				<Code className="size-3.5" />
			</button>
			<div className="mx-1 h-3.5 w-px bg-stone-300 dark:bg-stone-600" />
			<button
				type="button"
				title="Heading 1"
				onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				className={`editor-bubble-btn ${editor.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
			>
				<Heading1 className="size-3.5" />
			</button>
			<button
				type="button"
				title="Heading 2"
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				className={`editor-bubble-btn ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
			>
				<Heading2 className="size-3.5" />
			</button>
			<button
				type="button"
				title="Bullet List"
				onClick={() => editor.chain().focus().toggleBulletList().run()}
				className={`editor-bubble-btn ${editor.isActive("bulletList") ? "is-active" : ""}`}
			>
				<List className="size-3.5" />
			</button>
			<button
				type="button"
				title="Blockquote"
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
				className={`editor-bubble-btn ${editor.isActive("blockquote") ? "is-active" : ""}`}
			>
				<Quote className="size-3.5" />
			</button>
		</div>
	);
}
