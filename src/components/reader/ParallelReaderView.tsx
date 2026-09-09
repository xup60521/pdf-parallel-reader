import { ArrowLeft, Copy, Download, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	exportDocumentNotesAsMarkdown,
	type PageNote,
	type PdfDocument,
	renameDocument,
} from "../../lib/db";
import { MarkdownNoteEditor } from "../editor/MarkdownNoteEditor";
import { PdfPageView } from "../pdf/PdfPageView";

interface ParallelReaderViewProps {
	pdfDoc: PDFDocumentProxy;
	docMeta: PdfDocument;
	initialNotes: PageNote[];
	onBack: () => void;
}

type SplitRatio = "equal" | "pdf-focus" | "note-focus";

export function ParallelReaderView({
	pdfDoc,
	docMeta,
	initialNotes,
	onBack,
}: ParallelReaderViewProps) {
	const [scale, setScale] = useState<number>(1.0);
	const [splitRatio, setSplitRatio] = useState<SplitRatio>("equal");
	const [pageHeights, setPageHeights] = useState<Record<number, number>>({});
	const [docTitle, setDocTitle] = useState(docMeta.name);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [exportMessage, setExportMessage] = useState<string | null>(null);
	const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
	const titleInputRef = useRef<HTMLInputElement>(null);

	// Focus title input when editing starts
	useEffect(() => {
		if (isEditingTitle && titleInputRef.current) {
			titleInputRef.current.focus();
		}
	}, [isEditingTitle]);

	// Map initial notes by page number
	const notesMap = useRef<Map<number, string>>(new Map());
	useEffect(() => {
		const map = new Map<number, string>();
		for (const n of initialNotes) {
			map.set(n.pageNumber, n.contentMarkdown);
		}
		notesMap.current = map;
	}, [initialNotes]);

	// Track height of each PDF page to set minHeight on note editor
	const handlePdfDimensionChange = useCallback(
		(pageNumber: number, _width: number, height: number) => {
			setPageHeights((prev) => {
				if (prev[pageNumber] === height) return prev;
				return { ...prev, [pageNumber]: height };
			});
		},
		[],
	);

	// Zoom helpers
	const handleZoomIn = () =>
		setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)));
	const handleZoomOut = () =>
		setScale((s) => Math.max(0.6, +(s - 0.15).toFixed(2)));
	const handleZoomReset = () => setScale(1.0);

	// Jump to specific page
	const scrollToPage = (pageNum: number) => {
		const el = rowRefs.current[pageNum];
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	// Handle document title rename
	const handleSaveTitle = async () => {
		setIsEditingTitle(false);
		if (docTitle.trim() && docTitle !== docMeta.name) {
			await renameDocument(docMeta.id, docTitle.trim());
		}
	};

	// Export all notes as Markdown file
	const handleExportNotes = async () => {
		try {
			const md = await exportDocumentNotesAsMarkdown(docMeta.id);
			const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${docTitle.replace(/\.pdf$/i, "")}_notes.md`;
			a.click();
			URL.revokeObjectURL(url);

			setExportMessage("Exported!");
			setTimeout(() => setExportMessage(null), 2000);
		} catch (e) {
			console.error("Export failed:", e);
		}
	};

	// Copy all notes to clipboard
	const handleCopyAllNotes = async () => {
		try {
			const md = await exportDocumentNotesAsMarkdown(docMeta.id);
			await navigator.clipboard.writeText(md);
			setExportMessage("Copied all!");
			setTimeout(() => setExportMessage(null), 2000);
		} catch (e) {
			console.error("Copy all failed:", e);
		}
	};

	// Column width classes based on splitRatio
	const pdfColClass =
		splitRatio === "equal"
			? "w-1/2"
			: splitRatio === "pdf-focus"
				? "w-[58%]"
				: "w-[42%]";
	const noteColClass =
		splitRatio === "equal"
			? "w-1/2"
			: splitRatio === "pdf-focus"
				? "w-[42%]"
				: "w-[58%]";

	const pagesArray = Array.from({ length: docMeta.pageCount }, (_, i) => i + 1);

	return (
		<div className="flex min-h-screen flex-col bg-stone-100 text-stone-800 dark:bg-stone-950 dark:text-stone-100">
			{/* Sticky Reader Header Bar */}
			<header className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-200/80 bg-white/90 px-4 py-2.5 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/90 shadow-xs">
				{/* Left: Back button & Title */}
				<div className="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={onBack}
						className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-colors"
					>
						<ArrowLeft className="size-4" />
						<span className="hidden sm:inline">Overview</span>
					</button>

					<div className="h-4 w-px bg-stone-200 dark:bg-stone-800" />

					{/* Editable Document Title */}
					<div className="min-w-0 flex items-center">
						{isEditingTitle ? (
							<input
								ref={titleInputRef}
								type="text"
								value={docTitle}
								onChange={(e) => setDocTitle(e.target.value)}
								onBlur={handleSaveTitle}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSaveTitle();
									if (e.key === "Escape") {
										setDocTitle(docMeta.name);
										setIsEditingTitle(false);
									}
								}}
								className="rounded border border-emerald-500 bg-white px-2 py-0.5 text-sm font-semibold text-stone-900 dark:bg-stone-800 dark:text-stone-100 outline-none"
							/>
						) : (
							<button
								type="button"
								onClick={() => setIsEditingTitle(true)}
								title="Click to rename"
								className="truncate text-left text-sm font-semibold text-stone-800 hover:text-emerald-700 dark:text-stone-200 dark:hover:text-emerald-400"
							>
								{docTitle}
							</button>
						)}
						<span className="ml-2 hidden md:inline rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">
							{docMeta.pageCount} pages
						</span>
					</div>
				</div>

				{/* Center: Quick Page Navigator */}
				<div className="hidden lg:flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400">
					<span className="text-[11px]">Jump to:</span>
					<div className="flex items-center gap-1 max-w-[260px] overflow-x-auto py-1">
						{pagesArray.map((p) => (
							<button
								key={p}
								type="button"
								onClick={() => scrollToPage(p)}
								className="flex size-6 items-center justify-center rounded bg-stone-100 text-[11px] font-medium text-stone-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 transition-colors"
							>
								{p}
							</button>
						))}
					</div>
				</div>

				{/* Right: Controls & Actions */}
				<div className="flex items-center gap-2">
					{/* Zoom controls */}
					<div className="flex items-center rounded-lg border border-stone-200/80 bg-stone-50 p-0.5 dark:border-stone-800 dark:bg-stone-900">
						<button
							type="button"
							onClick={handleZoomOut}
							title="Zoom out"
							className="rounded p-1 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
						>
							<Minus className="size-3.5" />
						</button>
						<button
							type="button"
							onClick={handleZoomReset}
							title="Reset zoom to 100%"
							className="px-1.5 text-[11px] font-medium text-stone-700 dark:text-stone-300"
						>
							{Math.round(scale * 100)}%
						</button>
						<button
							type="button"
							onClick={handleZoomIn}
							title="Zoom in"
							className="rounded p-1 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
						>
							<Plus className="size-3.5" />
						</button>
					</div>

					{/* Split Ratio Toggle */}
					<div className="hidden sm:flex items-center rounded-lg border border-stone-200/80 bg-stone-50 p-0.5 dark:border-stone-800 dark:bg-stone-900">
						<button
							type="button"
							onClick={() => setSplitRatio("equal")}
							title="Balanced 50/50 split"
							className={`rounded px-2 py-1 text-[11px] font-medium ${splitRatio === "equal" ? "bg-white text-emerald-700 shadow-xs dark:bg-stone-800 dark:text-emerald-400" : "text-stone-600 dark:text-stone-400"}`}
						>
							50:50
						</button>
						<button
							type="button"
							onClick={() => setSplitRatio("pdf-focus")}
							title="Wider PDF (58:42)"
							className={`rounded px-2 py-1 text-[11px] font-medium ${splitRatio === "pdf-focus" ? "bg-white text-emerald-700 shadow-xs dark:bg-stone-800 dark:text-emerald-400" : "text-stone-600 dark:text-stone-400"}`}
						>
							PDF+
						</button>
						<button
							type="button"
							onClick={() => setSplitRatio("note-focus")}
							title="Wider Notes (42:58)"
							className={`rounded px-2 py-1 text-[11px] font-medium ${splitRatio === "note-focus" ? "bg-white text-emerald-700 shadow-xs dark:bg-stone-800 dark:text-emerald-400" : "text-stone-600 dark:text-stone-400"}`}
						>
							Notes+
						</button>
					</div>

					{/* Copy All Notes */}
					<button
						type="button"
						onClick={handleCopyAllNotes}
						title="Copy all document notes as Markdown"
						className="hidden md:flex items-center gap-1.5 rounded-lg border border-stone-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
					>
						<Copy className="size-3.5 text-stone-500" />
						<span>Copy All</span>
					</button>

					{/* Export Notes button */}
					<button
						type="button"
						onClick={handleExportNotes}
						title="Export all notes to .md file"
						className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors"
					>
						<Download className="size-3.5" />
						<span>Export Notes</span>
					</button>

					{exportMessage && (
						<span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fade-in">
							{exportMessage}
						</span>
					)}
				</div>
			</header>

			{/* Main Dual-Column Header Labels */}
			<div className="sticky top-[49px] z-30 flex border-b border-stone-200 bg-stone-100/90 px-6 py-2 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/90">
				<div className={`${pdfColClass} pr-3 text-center`}>
					<span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
						PDF Document
					</span>
				</div>
				<div className={`${noteColClass} pl-3 text-center`}>
					<span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
						Markdown Notes
					</span>
				</div>
			</div>

			{/* Synchronously Coupled Parallel Page Rows */}
			<main className="flex-1 px-4 sm:px-6 py-6 max-w-[1700px] w-full mx-auto">
				<div className="space-y-12">
					{pagesArray.map((pageNum) => {
						const minNoteHeight = pageHeights[pageNum] || 500;
						const initialNoteContent = notesMap.current.get(pageNum) || "";

						return (
							<div
								key={pageNum}
								ref={(el) => {
									rowRefs.current[pageNum] = el;
								}}
								className="page-row flex items-start gap-6 pb-4"
							>
								{/* Left Column: PDF Page */}
								<div
									className={`${pdfColClass} flex justify-center sticky top-20`}
								>
									<PdfPageView
										pdfDoc={pdfDoc}
										pageNumber={pageNum}
										scale={scale}
										onDimensionsChange={handlePdfDimensionChange}
									/>
								</div>

								{/* Right Column: Coupled Markdown Note Field */}
								<div className={`${noteColClass} flex flex-col`}>
									<MarkdownNoteEditor
										pdfId={docMeta.id}
										pageNumber={pageNum}
										initialMarkdown={initialNoteContent}
										minHeight={minNoteHeight}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</main>
		</div>
	);
}
