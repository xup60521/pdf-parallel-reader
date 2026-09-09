import { EditorContent, useEditor } from "@tiptap/react";
import { Check, Copy, PenLine, SquareCode } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveNoteForPage } from "../../lib/db";
import { cn } from "../../lib/utils";
import { createNoteExtensions } from "./extensions";
import { htmlToMarkdown, markdownToHtml } from "./markdown";
import { NoteBubbleMenu } from "./NoteBubbleMenu";
import "katex/dist/katex.min.css";
import "./editor.css";

type SaveState = "idle" | "pending" | "saved";

interface NoteEditorProps {
	pdfId: string;
	pageNumber: number;
	initialMarkdown?: string;
	minHeight?: number;
	onContentChange?: (pageNumber: number, hasContent: boolean) => void;
}

const SAVE_DEBOUNCE_MS = 600;

export function NoteEditor({
	pdfId,
	pageNumber,
	initialMarkdown = "",
	minHeight = 320,
	onContentChange,
}: NoteEditorProps) {
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [isRawMode, setIsRawMode] = useState(false);
	const [rawText, setRawText] = useState(initialMarkdown);
	const [copied, setCopied] = useState(false);

	const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingRead = useRef<
		(() => { markdown: string; json?: string }) | null
	>(null);
	const lastSaved = useRef(initialMarkdown);
	const onContentChangeRef = useRef(onContentChange);
	onContentChangeRef.current = onContentChange;

	const persist = useCallback(
		(markdown: string, json?: string) => {
			saveNoteForPage(pdfId, pageNumber, markdown, json)
				.then(() => {
					lastSaved.current = markdown;
					setSaveState("saved");
					onContentChangeRef.current?.(pageNumber, markdown.trim().length > 0);
				})
				.catch((error) => {
					console.error("Could not save this note:", error);
					setSaveState("pending");
				});
		},
		[pdfId, pageNumber],
	);

	/**
	 * Serialization runs on the debounce, never on the keystroke. The old build
	 * ran getHTML + Turndown for every character typed.
	 */
	const scheduleSave = useCallback(
		(read: () => { markdown: string; json?: string }) => {
			setSaveState("pending");
			pendingRead.current = read;
			if (saveTimeout.current) clearTimeout(saveTimeout.current);
			saveTimeout.current = setTimeout(() => {
				saveTimeout.current = null;
				pendingRead.current = null;
				const { markdown, json } = read();
				setRawText(markdown);
				persist(markdown, json);
			}, SAVE_DEBOUNCE_MS);
		},
		[persist],
	);

	const flushPendingSave = useCallback(() => {
		if (!saveTimeout.current || !pendingRead.current) return;
		clearTimeout(saveTimeout.current);
		saveTimeout.current = null;
		const { markdown, json } = pendingRead.current();
		pendingRead.current = null;
		persist(markdown, json);
	}, [persist]);

	const editor = useEditor({
		immediatelyRender: false,
		extensions: createNoteExtensions({
			placeholder: "Write about this page, or press / for blocks",
		}),
		content: markdownToHtml(initialMarkdown),
		editorProps: {
			attributes: {
				class: "note-prose",
				spellcheck: "true",
				role: "textbox",
				"aria-multiline": "true",
				"aria-label": `Notes for page ${pageNumber}`,
			},
		},
		onUpdate: ({ editor: instance }) => {
			scheduleSave(() => ({
				markdown: htmlToMarkdown(instance.getHTML()),
				json: JSON.stringify(instance.getJSON()),
			}));
		},
	});

	function handleRawChange(text: string) {
		setRawText(text);
		scheduleSave(() => ({ markdown: text }));
		if (editor && !editor.isDestroyed) {
			editor.commands.setContent(markdownToHtml(text), { emitUpdate: false });
		}
	}

	/** Leaving raw mode should not wait out the debounce. */
	function toggleRawMode() {
		if (!isRawMode && editor && !editor.isDestroyed) {
			setRawText(htmlToMarkdown(editor.getHTML()));
		}
		setIsRawMode((raw) => !raw);
	}

	/**
	 * Rows unmount when they leave the render window, and the tab can close
	 * mid-debounce. Both paths flush instead of dropping the edit. Reading the
	 * editor here is safe because TipTap defers its own teardown by a tick.
	 */
	useEffect(() => {
		window.addEventListener("pagehide", flushPendingSave);
		return () => {
			window.removeEventListener("pagehide", flushPendingSave);
			flushPendingSave();
		};
	}, [flushPendingSave]);

	// Adopt content that changed underneath us (document reload, import).
	useEffect(() => {
		if (initialMarkdown === lastSaved.current) return;
		lastSaved.current = initialMarkdown;
		setRawText(initialMarkdown);
		if (editor && !editor.isDestroyed) {
			editor.commands.setContent(markdownToHtml(initialMarkdown), {
				emitUpdate: false,
			});
		}
	}, [initialMarkdown, editor]);

	async function copyMarkdown() {
		const markdown =
			editor && !editor.isDestroyed
				? htmlToMarkdown(editor.getHTML())
				: rawText;
		try {
			await navigator.clipboard.writeText(markdown);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch (error) {
			console.error("Could not copy this note:", error);
		}
	}

	const words = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;

	return (
		<div
			style={{ minHeight }}
			className="group/note flex flex-col rounded-panel border border-rule bg-surface transition-colors focus-within:border-quill/45"
		>
			<div className="relative flex-1">
				{isRawMode ? (
					<textarea
						value={rawText}
						onChange={(event) => handleRawChange(event.target.value)}
						spellCheck={false}
						aria-label={`Raw markdown for page ${pageNumber}`}
						placeholder={`# Page ${pageNumber}`}
						className="size-full min-h-[inherit] resize-none rounded-panel bg-transparent p-4 font-mono text-tiny leading-relaxed text-ink outline-none placeholder:text-ink-3"
					/>
				) : (
					<>
						{editor && <NoteBubbleMenu editor={editor} />}
						<EditorContent editor={editor} className="note-surface" />
					</>
				)}
			</div>

			{/* Status strip. Reading, not writing, is the default state, so the
			    controls stay quiet until the note is hovered or focused. */}
			<div className="flex items-center justify-between gap-2 border-t border-rule px-3 py-1.5 text-micro text-ink-3">
				<span className="flex items-center gap-1.5">
					<span
						aria-hidden
						className={cn(
							"size-1.5 rounded-full transition-colors",
							saveState === "pending" && "bg-marker",
							saveState === "saved" && "bg-quill",
							saveState === "idle" && "bg-rule-strong",
						)}
					/>
					{/* The dot already carries the save state, so the label spends its
					    room on the number you actually want while writing. */}
					{saveState === "pending"
						? "Saving"
						: words > 0
							? `${words} ${words === 1 ? "word" : "words"}`
							: "Empty"}
				</span>

				<span className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/note:opacity-100">
					<button
						type="button"
						onClick={copyMarkdown}
						title="Copy this note as markdown"
						aria-label="Copy this note as markdown"
						className="flex items-center gap-1 rounded-chip px-1.5 py-1 hover:bg-surface-3 hover:text-ink"
					>
						{copied ? (
							<Check className="size-3 text-quill" />
						) : (
							<Copy className="size-3" />
						)}
						{copied ? "Copied" : "Copy"}
					</button>
					<button
						type="button"
						onClick={toggleRawMode}
						aria-pressed={isRawMode}
						title={isRawMode ? "Back to the editor" : "Edit raw markdown"}
						className="flex items-center gap-1 rounded-chip px-1.5 py-1 hover:bg-surface-3 hover:text-ink"
					>
						{isRawMode ? (
							<PenLine className="size-3" />
						) : (
							<SquareCode className="size-3" />
						)}
						{isRawMode ? "Editor" : "Markdown"}
					</button>
				</span>
			</div>
		</div>
	);
}
