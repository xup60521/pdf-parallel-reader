import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	Bold,
	Check,
	Code,
	Copy,
	FileCode,
	FileEdit,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	List,
	ListOrdered,
	Quote,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveNoteForPage } from "../../lib/db";
import { EditorBubbleToolbar } from "./EditorBubbleToolbar";
import {
	htmlToMarkdown,
	MarkdownPasteExtension,
	markdownToHtml,
} from "./markdown-converter";
import "./editor.css";

interface MarkdownNoteEditorProps {
	pdfId: string;
	pageNumber: number;
	initialMarkdown?: string;
	minHeight?: number;
	onHeightChange?: (pageNumber: number, height: number) => void;
}

export function MarkdownNoteEditor({
	pdfId,
	pageNumber,
	initialMarkdown = "",
	minHeight = 400,
	onHeightChange,
}: MarkdownNoteEditorProps) {
	const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "dirty">(
		"saved",
	);
	const [isRawMode, setIsRawMode] = useState(false);
	const [rawText, setRawText] = useState(initialMarkdown);
	const [copied, setCopied] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const lastSavedMarkdown = useRef<string>(initialMarkdown);

	// TipTap Editor instance
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
			}),
			Placeholder.configure({
				placeholder: `Write markdown notes for page ${pageNumber}... (Supports # heading, - lists, > quotes, \`\`\`code)`,
			}),
			MarkdownPasteExtension,
		],
		content: markdownToHtml(initialMarkdown),
		editorProps: {
			attributes: {
				class:
					"min-h-[160px] p-4 text-[var(--sea-ink)] focus:outline-none font-sans",
			},
		},
		onUpdate: ({ editor: ed }) => {
			setSaveStatus("dirty");
			const html = ed.getHTML();
			const md = htmlToMarkdown(html);
			setRawText(md);
			triggerDebouncedSave(md, JSON.stringify(ed.getJSON()));
		},
	});

	// Debounced auto-save function
	const triggerDebouncedSave = useCallback(
		(markdown: string, jsonStr?: string) => {
			setSaveStatus("saving");
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}

			saveTimeoutRef.current = setTimeout(async () => {
				try {
					await saveNoteForPage(pdfId, pageNumber, markdown, jsonStr);
					lastSavedMarkdown.current = markdown;
					setSaveStatus("saved");
				} catch (err) {
					console.error("Failed to save note:", err);
					setSaveStatus("dirty");
				}
			}, 600);
		},
		[pdfId, pageNumber],
	);

	// Handle Raw Text Change
	const handleRawChange = (text: string) => {
		setRawText(text);
		setSaveStatus("dirty");
		triggerDebouncedSave(text);
		if (editor && !editor.isDestroyed) {
			editor.commands.setContent(markdownToHtml(text), { emitUpdate: false });
		}
	};

	// Measure note container height to allow parent synchronization if needed
	useEffect(() => {
		if (!containerRef.current) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				if (onHeightChange) {
					onHeightChange(pageNumber, entry.contentRect.height);
				}
			}
		});
		ro.observe(containerRef.current);
		return () => ro.disconnect();
	}, [pageNumber, onHeightChange]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	// Sync initialMarkdown if changed externally
	useEffect(() => {
		if (initialMarkdown !== lastSavedMarkdown.current) {
			setRawText(initialMarkdown);
			lastSavedMarkdown.current = initialMarkdown;
			if (editor && !editor.isDestroyed) {
				editor.commands.setContent(markdownToHtml(initialMarkdown), {
					emitUpdate: false,
				});
			}
		}
	}, [initialMarkdown, editor]);

	const copyMarkdown = async () => {
		try {
			await navigator.clipboard.writeText(rawText);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch (e) {
			console.error("Failed to copy note", e);
		}
	};

	// Calculate words and characters
	const wordCount = rawText.trim()
		? rawText.trim().split(/\s+/).filter(Boolean).length
		: 0;
	const charCount = rawText.length;

	return (
		<div
			ref={containerRef}
			style={{ minHeight: `${minHeight}px` }}
			className="group relative flex flex-col rounded-xl border border-stone-200/80 bg-white/95 shadow-xs transition-all duration-200 hover:border-emerald-500/40 hover:shadow-md dark:border-stone-800 dark:bg-stone-900/95"
		>
			{/* Editor Header Bar */}
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 px-4 py-2.5 bg-stone-50/70 dark:border-stone-800 dark:bg-stone-900/60 rounded-t-xl">
				<div className="flex items-center gap-2.5">
					<span className="inline-flex items-center justify-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
						Note {pageNumber}
					</span>

					{/* Save Status Pill */}
					<span className="text-[11px] text-stone-600 dark:text-stone-300">
						{saveStatus === "saving" && "Saving..."}
						{saveStatus === "saved" && (
							<span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
								<Check className="size-3" /> Saved
							</span>
						)}
						{saveStatus === "dirty" && "Unsaved changes"}
					</span>
				</div>

				{/* Quick actions & stats */}
				<div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
					<span className="hidden sm:inline-block text-[11px]">
						{wordCount} {wordCount === 1 ? "word" : "words"} ({charCount} chars)
					</span>

					{/* Copy Button */}
					<button
						type="button"
						onClick={copyMarkdown}
						title="Copy markdown content"
						className="flex items-center gap-1 rounded px-2 py-1 text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
					>
						{copied ? (
							<>
								<Check className="size-3.5 text-emerald-600" />
								<span className="text-[11px]">Copied</span>
							</>
						) : (
							<>
								<Copy className="size-3.5" />
								<span className="text-[11px]">Copy</span>
							</>
						)}
					</button>

					{/* Mode Switcher */}
					<button
						type="button"
						onClick={() => setIsRawMode(!isRawMode)}
						title={
							isRawMode ? "Switch to Rich Editor" : "Switch to Raw Markdown"
						}
						className="flex items-center gap-1 rounded bg-stone-200/60 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-300/60 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
					>
						{isRawMode ? (
							<>
								<FileEdit className="size-3" /> Visual
							</>
						) : (
							<>
								<FileCode className="size-3" /> Raw MD
							</>
						)}
					</button>
				</div>
			</div>

			{/* Editor Main Content */}
			<div className="relative flex-1 flex flex-col">
				{!isRawMode ? (
					<>
						{/* Quick formatting toolbar */}
						<div className="flex flex-wrap items-center gap-1 border-b border-stone-100 px-3 py-1.5 text-stone-500 dark:border-stone-800/60 dark:text-stone-400">
							<button
								type="button"
								onClick={() => editor?.chain().focus().toggleBold().run()}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("bold") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Bold"
							>
								<Bold className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() => editor?.chain().focus().toggleItalic().run()}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("italic") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Italic"
							>
								<Italic className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() =>
									editor?.chain().focus().toggleHeading({ level: 1 }).run()
								}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("heading", { level: 1 }) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Heading 1 (#)"
							>
								<Heading1 className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() =>
									editor?.chain().focus().toggleHeading({ level: 2 }).run()
								}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("heading", { level: 2 }) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Heading 2 (##)"
							>
								<Heading2 className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() =>
									editor?.chain().focus().toggleHeading({ level: 3 }).run()
								}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("heading", { level: 3 }) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Heading 3 (###)"
							>
								<Heading3 className="size-3.5" />
							</button>
							<div className="h-4 w-px bg-stone-200 dark:bg-stone-700 mx-1" />
							<button
								type="button"
								onClick={() => editor?.chain().focus().toggleBulletList().run()}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("bulletList") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Bullet List (-)"
							>
								<List className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() =>
									editor?.chain().focus().toggleOrderedList().run()
								}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("orderedList") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Numbered List (1.)"
							>
								<ListOrdered className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() => editor?.chain().focus().toggleBlockquote().run()}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("blockquote") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Quote (>)"
							>
								<Quote className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
								className={`p-1.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800 ${editor?.isActive("codeBlock") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""}`}
								title="Code Block (```)"
							>
								<Code className="size-3.5" />
							</button>
						</div>

						{/* Bubble menu when text is selected */}
						<EditorBubbleToolbar editor={editor} />

						{/* TipTap content area */}
						<div className="flex-1 flex flex-col">
							<EditorContent editor={editor} className="flex-1" />
						</div>
					</>
				) : (
					/* Raw Markdown Editor textarea */
					<div className="flex-1 p-3 flex flex-col">
						<textarea
							value={rawText}
							onChange={(e) => handleRawChange(e.target.value)}
							placeholder={`Write raw markdown for page ${pageNumber}...`}
							className="flex-1 w-full resize-none font-mono text-sm leading-relaxed p-3 rounded-lg bg-stone-50/70 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-stone-800 dark:text-stone-200 min-h-[220px]"
						/>
					</div>
				)}
			</div>
		</div>
	);
}
