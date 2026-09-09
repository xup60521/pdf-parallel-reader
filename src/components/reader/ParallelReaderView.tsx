import {
	ArrowLeft,
	Check,
	Copy,
	Download,
	Minus,
	PanelLeftClose,
	PanelLeftOpen,
	Plus,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	exportDocumentNotesAsMarkdown,
	type PageNote,
	type PdfDocument,
	renameDocument,
} from "../../lib/db";
import { useInViewport } from "../../lib/use-in-viewport";
import { cn } from "../../lib/utils";
import { NoteEditor } from "../editor/NoteEditor";
import { PdfPageView } from "../pdf/PdfPageView";
import { Button, ControlGroup, SegmentButton } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { PageRail } from "./PageRail";

type SplitRatio = "equal" | "pdf" | "notes";

const SPLIT_FRACTIONS: Record<SplitRatio, number> = {
	equal: 0.5,
	pdf: 0.6,
	notes: 0.4,
};

const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];
const SPINE_WIDTH = 36;
const COLUMN_GAP = 32;
const DEFAULT_ASPECT = 842 / 595;
/** How far outside the pane a row still renders, in CSS pixels. */
const RENDER_MARGIN = "1400px 0px";
/** Rows that start live without waiting for an intersection callback. */
const EAGER_PAGES = 2;
/** Below this content width the pair stacks instead of sitting side by side. */
const STACK_BELOW = 760;

interface ParallelReaderViewProps {
	pdfDoc: PDFDocumentProxy;
	docMeta: PdfDocument;
	initialNotes: PageNote[];
	onBack: () => void;
}

interface PageRowProps {
	pdfDoc: PDFDocumentProxy;
	docId: string;
	pageNumber: number;
	pdfColumnWidth: number;
	noteColumnWidth: number;
	renderWidth: number;
	reservedHeight: number;
	initialMarkdown: string;
	hasNote: boolean;
	isCurrent: boolean;
	isMeasured: boolean;
	isStacked: boolean;
	scrollRootRef: RefObject<HTMLElement | null>;
	onAspectRatio: (pageNumber: number, ratio: number) => void;
	onNoteContentChange: (pageNumber: number, hasContent: boolean) => void;
	registerRow: (pageNumber: number, element: HTMLElement | null) => void;
}

/**
 * One page and the note that belongs to it, joined by the spine.
 *
 * Rows outside the render window keep their measured height but mount neither a
 * PDF canvas nor an editor, so scroll position stays exact while the cost of a
 * long document stays flat.
 */
function PageRow({
	pdfDoc,
	docId,
	pageNumber,
	pdfColumnWidth,
	noteColumnWidth,
	renderWidth,
	reservedHeight,
	initialMarkdown,
	hasNote,
	isCurrent,
	isMeasured,
	isStacked,
	scrollRootRef,
	onAspectRatio,
	onNoteContentChange,
	registerRow,
}: PageRowProps) {
	const rowRef = useRef<HTMLElement>(null);
	const isLive =
		useInViewport(rowRef, {
			root: scrollRootRef,
			rootMargin: RENDER_MARGIN,
			// The opening spread is on screen by definition, so it skips the
			// observer round trip and paints with the first frame.
			initial: pageNumber <= EAGER_PAGES,
		}) && isMeasured;

	useLayoutEffect(() => {
		registerRow(pageNumber, rowRef.current);
		return () => registerRow(pageNumber, null);
	}, [pageNumber, registerRow]);

	const pageNode = isLive ? (
		<PdfPageView
			pdfDoc={pdfDoc}
			pageNumber={pageNumber}
			width={renderWidth}
			onAspectRatio={onAspectRatio}
		/>
	) : (
		<div
			className="sheet shrink-0"
			style={{ width: renderWidth, height: reservedHeight }}
		/>
	);

	const noteNode = isLive ? (
		<NoteEditor
			pdfId={docId}
			pageNumber={pageNumber}
			initialMarkdown={initialMarkdown}
			minHeight={isStacked ? 260 : reservedHeight}
			onContentChange={onNoteContentChange}
		/>
	) : (
		<div
			className="rounded-panel border border-rule bg-surface"
			style={{ height: isStacked ? 260 : reservedHeight }}
		/>
	);

	// Side by side is the product, but it needs roughly 760px to be readable.
	// Below that the pair stacks and the spine turns on its side rather than
	// squeezing two unusable columns onto a phone.
	if (isStacked) {
		return (
			<section
				ref={rowRef}
				data-page={pageNumber}
				aria-label={`Page ${pageNumber}`}
				className="flex flex-col gap-3"
			>
				<div className="spine-rule" data-current={isCurrent}>
					<span className="spine-number">Page {pageNumber}</span>
					{hasNote && <span className="spine-dot" aria-hidden />}
				</div>
				<div className="overflow-x-auto">
					<div className="flex w-max min-w-full justify-center">{pageNode}</div>
				</div>
				{noteNode}
			</section>
		);
	}

	return (
		<section
			ref={rowRef}
			data-page={pageNumber}
			aria-label={`Page ${pageNumber}`}
			className="flex"
		>
			{/*
			  The column stretches to the full row height so the page can pin while a
			  longer note scrolls past it. Horizontal overflow lives on the sticky
			  element itself rather than the column, because a scroll container
			  around a sticky child would cancel the pin.
			*/}
			<div className="shrink-0 pr-4" style={{ width: pdfColumnWidth }}>
				<div className="sticky top-4 overflow-x-auto">
					<div className="flex w-max min-w-full justify-center">{pageNode}</div>
				</div>
			</div>

			<div className="spine">
				<div className="spine-tick" data-current={isCurrent}>
					<span className="spine-number">{pageNumber}</span>
					{hasNote && <span className="spine-dot" aria-hidden />}
				</div>
			</div>

			<div className="shrink-0 pl-4" style={{ width: noteColumnWidth }}>
				{noteNode}
			</div>
		</section>
	);
}

export function ParallelReaderView({
	pdfDoc,
	docMeta,
	initialNotes,
	onBack,
}: ParallelReaderViewProps) {
	const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
	const [splitRatio, setSplitRatio] = useState<SplitRatio>("equal");
	const [isRailOpen, setIsRailOpen] = useState(true);
	const [wasRailAutoClosed, setWasRailAutoClosed] = useState(false);
	const [availableWidth, setAvailableWidth] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageInput, setPageInput] = useState("1");
	const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT);
	const [title, setTitle] = useState(docMeta.name);
	const [isRenaming, setIsRenaming] = useState(false);
	const [confirmation, setConfirmation] = useState<string | null>(null);

	const scrollRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const rowElements = useRef(new Map<number, HTMLElement>());
	const titleInputRef = useRef<HTMLInputElement>(null);

	const [pagesWithNotes, setPagesWithNotes] = useState<ReadonlySet<number>>(
		() =>
			new Set(
				initialNotes
					.filter((note) => note.contentMarkdown.trim().length > 0)
					.map((note) => note.pageNumber),
			),
	);

	const notesByPage = useMemo(() => {
		const map = new Map<number, string>();
		for (const note of initialNotes)
			map.set(note.pageNumber, note.contentMarkdown);
		return map;
	}, [initialNotes]);

	const pages = useMemo(
		() => Array.from({ length: docMeta.pageCount }, (_, index) => index + 1),
		[docMeta.pageCount],
	);

	/* ---- Measurement: the page is sized from the column, never the reverse ---- */

	// Measured synchronously first so the very first paint already uses the real
	// width; the observer then only has to handle later resizes.
	useLayoutEffect(() => {
		const content = contentRef.current;
		if (!content) return;

		const measure = () => setAvailableWidth(content.clientWidth);
		measure();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", measure);
			return () => window.removeEventListener("resize", measure);
		}

		const observer = new ResizeObserver(measure);
		observer.observe(content);
		return () => observer.disconnect();
	}, []);

	const zoom = ZOOM_STEPS[zoomIndex] ?? 1;
	// Rendering before the pane reports its width would draw every visible page
	// twice: once at the fallback width, once at the real one.
	const isMeasured = availableWidth > 0;
	const isStacked = isMeasured && availableWidth < STACK_BELOW;

	const columnsWidth = isStacked
		? availableWidth
		: Math.max(availableWidth - SPINE_WIDTH - COLUMN_GAP, 320);
	const pdfColumnWidth = isStacked
		? availableWidth
		: Math.round(columnsWidth * SPLIT_FRACTIONS[splitRatio]);
	const noteColumnWidth = isStacked
		? availableWidth
		: columnsWidth - pdfColumnWidth;
	// Zoom above 100% overflows inside the PDF column only, which scrolls
	// horizontally on its own. The row layout is never affected.
	const renderWidth = Math.max(
		Math.round((pdfColumnWidth - (isStacked ? 0 : 16)) * zoom),
		160,
	);
	const reservedHeight = Math.round(renderWidth * aspectRatio);

	const handleAspectRatio = useCallback((pageNumber: number, ratio: number) => {
		if (pageNumber !== 1) return;
		setAspectRatio((previous) =>
			Math.abs(previous - ratio) < 0.001 ? previous : ratio,
		);
	}, []);

	const handleNoteContentChange = useCallback(
		(pageNumber: number, hasContent: boolean) => {
			setPagesWithNotes((previous) => {
				if (previous.has(pageNumber) === hasContent) return previous;
				const next = new Set(previous);
				if (hasContent) next.add(pageNumber);
				else next.delete(pageNumber);
				return next;
			});
		},
		[],
	);

	const registerRow = useCallback(
		(pageNumber: number, element: HTMLElement | null) => {
			if (element) rowElements.current.set(pageNumber, element);
			else rowElements.current.delete(pageNumber);
		},
		[],
	);

	/* ---- Which page am I on? The row crossing the middle of the pane. ---- */

	useEffect(() => {
		const pane = scrollRef.current;
		if (!pane || typeof IntersectionObserver === "undefined") return;

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const page = Number(
						(entry.target as HTMLElement).dataset.page ?? Number.NaN,
					);
					if (Number.isFinite(page)) {
						setCurrentPage(page);
						setPageInput(String(page));
					}
				}
			},
			{ root: pane, rootMargin: "-45% 0px -45% 0px" },
		);

		for (const element of rowElements.current.values())
			observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const scrollToPage = useCallback((pageNumber: number) => {
		const row = rowElements.current.get(pageNumber);
		const pane = scrollRef.current;
		if (!row || !pane) return;
		pane.scrollTo({
			top: row.offsetTop - pane.offsetTop - 12,
			behavior: "smooth",
		});
	}, []);

	/* ---- Keyboard: move between pages without leaving the note ---- */

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (!event.altKey || event.ctrlKey || event.metaKey) return;
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				const delta = event.key === "ArrowDown" ? 1 : -1;
				const target = Math.min(
					Math.max(currentPage + delta, 1),
					docMeta.pageCount,
				);
				if (target !== currentPage) {
					event.preventDefault();
					scrollToPage(target);
				}
			}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [currentPage, docMeta.pageCount, scrollToPage]);

	useEffect(() => {
		if (isRenaming) titleInputRef.current?.select();
	}, [isRenaming]);

	// On a narrow screen the rail costs width the reading area needs. Give it
	// back automatically, and only once, so a deliberate reopen is respected.
	useEffect(() => {
		if (isStacked && isRailOpen && !wasRailAutoClosed) {
			setIsRailOpen(false);
			setWasRailAutoClosed(true);
		}
	}, [isStacked, isRailOpen, wasRailAutoClosed]);

	function announce(message: string) {
		setConfirmation(message);
		setTimeout(() => setConfirmation(null), 2200);
	}

	async function saveTitle() {
		setIsRenaming(false);
		const trimmed = title.trim();
		if (!trimmed) {
			setTitle(docMeta.name);
			return;
		}
		if (trimmed !== docMeta.name) await renameDocument(docMeta.id, trimmed);
	}

	async function exportNotes() {
		try {
			const markdown = await exportDocumentNotesAsMarkdown(docMeta.id);
			const url = URL.createObjectURL(
				new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
			);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${title.replace(/\.pdf$/i, "")}.md`;
			anchor.click();
			URL.revokeObjectURL(url);
			announce("Downloaded");
		} catch (error) {
			console.error("Could not export these notes:", error);
			announce("Export failed");
		}
	}

	async function copyAllNotes() {
		try {
			await navigator.clipboard.writeText(
				await exportDocumentNotesAsMarkdown(docMeta.id),
			);
			announce("Copied");
		} catch (error) {
			console.error("Could not copy these notes:", error);
			announce("Copy failed");
		}
	}

	function commitPageInput() {
		const parsed = Number.parseInt(pageInput, 10);
		if (Number.isFinite(parsed) && parsed >= 1 && parsed <= docMeta.pageCount) {
			scrollToPage(parsed);
		} else {
			setPageInput(String(currentPage));
		}
	}

	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-desk text-ink">
			<header className="flex h-13 shrink-0 items-center gap-3 border-b border-rule bg-surface px-3">
				<Button variant="ghost" size="md" onClick={onBack} className="-ml-1">
					<ArrowLeft className="size-4" />
					<span className="hidden sm:inline">Library</span>
				</Button>

				<span className="h-5 w-px bg-rule" />

				<div className="flex min-w-0 flex-1 items-center gap-2">
					{isRenaming ? (
						<input
							ref={titleInputRef}
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							onBlur={saveTitle}
							onKeyDown={(event) => {
								if (event.key === "Enter") saveTitle();
								if (event.key === "Escape") {
									setTitle(docMeta.name);
									setIsRenaming(false);
								}
							}}
							aria-label="Document name"
							className="w-full max-w-md rounded-chip border border-quill bg-surface px-2 py-1 text-ui font-semibold text-ink outline-none"
						/>
					) : (
						<button
							type="button"
							onClick={() => setIsRenaming(true)}
							title="Rename this document"
							className="truncate rounded-chip px-1.5 py-1 text-left text-ui font-semibold text-ink hover:bg-surface-2"
						>
							{title}
						</button>
					)}
				</div>

				<div className="flex items-center gap-2">
					<div className="hidden items-center gap-1 text-micro text-ink-3 md:flex">
						<input
							value={pageInput}
							onChange={(event) =>
								setPageInput(event.target.value.replace(/\D/g, ""))
							}
							onBlur={commitPageInput}
							onKeyDown={(event) => {
								if (event.key === "Enter") event.currentTarget.blur();
							}}
							aria-label="Go to page"
							inputMode="numeric"
							className="h-7 w-11 rounded-chip border border-rule bg-surface-2 px-1.5 text-center text-tiny tabular-nums text-ink outline-none focus:border-quill"
						/>
						<span className="tabular-nums">of {docMeta.pageCount}</span>
					</div>

					<ControlGroup>
						<SegmentButton
							onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
							disabled={zoomIndex === 0}
							title="Zoom out"
							aria-label="Zoom out"
							className="px-1.5"
						>
							<Minus className="size-3.5" />
						</SegmentButton>
						<span className="w-10 text-center text-micro tabular-nums text-ink-2">
							{Math.round(zoom * 100)}%
						</span>
						<SegmentButton
							onClick={() =>
								setZoomIndex((index) =>
									Math.min(ZOOM_STEPS.length - 1, index + 1),
								)
							}
							disabled={zoomIndex === ZOOM_STEPS.length - 1}
							title="Zoom in"
							aria-label="Zoom in"
							className="px-1.5"
						>
							<Plus className="size-3.5" />
						</SegmentButton>
					</ControlGroup>

					<ControlGroup className="hidden lg:flex">
						<SegmentButton
							active={splitRatio === "pdf"}
							onClick={() => setSplitRatio("pdf")}
							title="Give the page more room"
						>
							Page
						</SegmentButton>
						<SegmentButton
							active={splitRatio === "equal"}
							onClick={() => setSplitRatio("equal")}
							title="Split evenly"
						>
							Even
						</SegmentButton>
						<SegmentButton
							active={splitRatio === "notes"}
							onClick={() => setSplitRatio("notes")}
							title="Give the notes more room"
						>
							Notes
						</SegmentButton>
					</ControlGroup>

					<Button
						variant="ghost"
						size="icon-lg"
						onClick={() => setIsRailOpen((open) => !open)}
						title={isRailOpen ? "Hide the page rail" : "Show the page rail"}
						aria-label={
							isRailOpen ? "Hide the page rail" : "Show the page rail"
						}
						aria-pressed={isRailOpen}
					>
						{isRailOpen ? (
							<PanelLeftClose className="size-4" />
						) : (
							<PanelLeftOpen className="size-4" />
						)}
					</Button>

					<ThemeToggle />

					<Button
						variant="ghost"
						size="icon-lg"
						onClick={copyAllNotes}
						title="Copy every note as markdown"
						aria-label="Copy every note as markdown"
						className="hidden md:inline-flex"
					>
						<Copy className="size-4" />
					</Button>

					<Button variant="primary" size="md" onClick={exportNotes}>
						<Download className="size-3.5" />
						<span className="hidden sm:inline">Export</span>
					</Button>
				</div>
			</header>

			{/* One live region carries every confirmation in the reader. */}
			<div
				aria-live="polite"
				className={cn(
					"pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center transition-opacity duration-200",
					confirmation ? "opacity-100" : "opacity-0",
				)}
			>
				{confirmation && (
					<span className="flex items-center gap-1.5 rounded-full border border-rule bg-surface px-3 py-1.5 text-tiny font-medium text-ink shadow-float">
						<Check className="size-3.5 text-quill" />
						{confirmation}
					</span>
				)}
			</div>

			<div className="flex min-h-0 flex-1">
				{isRailOpen && (
					<PageRail
						pdfDoc={pdfDoc}
						pageCount={docMeta.pageCount}
						currentPage={currentPage}
						pagesWithNotes={pagesWithNotes}
						onSelect={scrollToPage}
					/>
				)}

				<main
					ref={scrollRef as RefObject<HTMLElement>}
					className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4"
				>
					<div ref={contentRef} className="flex flex-col gap-8">
						{pages.map((pageNumber) => (
							<PageRow
								key={pageNumber}
								pdfDoc={pdfDoc}
								docId={docMeta.id}
								pageNumber={pageNumber}
								pdfColumnWidth={pdfColumnWidth}
								noteColumnWidth={noteColumnWidth}
								renderWidth={renderWidth}
								reservedHeight={reservedHeight}
								initialMarkdown={notesByPage.get(pageNumber) ?? ""}
								hasNote={pagesWithNotes.has(pageNumber)}
								isCurrent={pageNumber === currentPage}
								isMeasured={isMeasured}
								isStacked={isStacked}
								scrollRootRef={scrollRef}
								onAspectRatio={handleAspectRatio}
								onNoteContentChange={handleNoteContentChange}
								registerRow={registerRow}
							/>
						))}
					</div>
					<p className="py-10 text-center text-micro text-ink-3">
						End of {docMeta.pageCount}{" "}
						{docMeta.pageCount === 1 ? "page" : "pages"}
					</p>
				</main>
			</div>
		</div>
	);
}
