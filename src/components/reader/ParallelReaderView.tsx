import { Check } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
	type ReactNode,
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
import { PageRail } from "./PageRail";

const ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 2.5, 3];
const FIT_INDEX = ZOOM_STEPS.indexOf(1);

/*
  The design pads its page column 36px on every side. The owner asked for the
  page borderless and fully expanded, so the horizontal padding is dropped and
  the page fills its column edge to edge; the vertical rhythm stays.
*/
const PDF_PADDING = 0;
const ROW_TOP = 36;
const NOTE_PADDING = 40;
/** How much of the reading area the page column may take, as a fraction. */
const MIN_SPLIT = 0.2;
const MAX_SPLIT = 0.8;
const DEFAULT_SPLIT = 0.5;
/** One arrow key press on the divider, as a fraction of the reading area. */
const SPLIT_STEP = 0.02;

/**
 * A click in the note column that lands on nothing — the padding, the space
 * under a short note — puts the caret at the end of that note. The panel is a
 * page of writing, so all of it should behave like one.
 */
function focusNoteFromDeadSpace(event: React.MouseEvent<HTMLElement>) {
	// Anything that already handles a click — the editor, the raw textarea, the
	// label's own controls — keeps it.
	if (
		(event.target as HTMLElement).closest(
			".note-prose, textarea, button, input, a, .plabel",
		)
	)
		return;
	const prose = event.currentTarget.querySelector<HTMLElement>(".note-prose");
	if (!prose) return;
	event.preventDefault();
	prose.focus();
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(prose);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}

const DEFAULT_ASPECT = 842 / 595;
/** How far outside the viewport a row still renders, in CSS pixels. */
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
	renderWidth: number;
	reservedHeight: number;
	initialMarkdown: string;
	isMeasured: boolean;
	isStacked: boolean;
	isFirst: boolean;
	isLast: boolean;
	/** Shared sideways offset in px, or null while the page fits its column. */
	panX: number | null;
	headerSlot?: ReactNode;
	onAspectRatio: (pageNumber: number, ratio: number) => void;
	onNoteContentChange: (pageNumber: number, hasContent: boolean) => void;
	registerRow: (pageNumber: number, element: HTMLElement | null) => void;
}

/**
 * One page and the note that belongs to it, as the two cells of a row.
 *
 * The two columns are told apart by their own grounds — the page sits in the
 * `--gutter` band, the note on `--paper` — so rows are flush with no gap
 * between them and the bands read as continuous down the whole document.
 *
 * Rows outside the render window keep their measured height but mount neither a
 * PDF canvas nor an editor, so scroll position stays exact while the cost of a
 * long document stays flat.
 */
function PageRow({
	pdfDoc,
	docId,
	pageNumber,
	renderWidth,
	reservedHeight,
	initialMarkdown,
	isMeasured,
	isStacked,
	isFirst,
	isLast,
	panX,
	headerSlot,
	onAspectRatio,
	onNoteContentChange,
	registerRow,
}: PageRowProps) {
	const rowRef = useRef<HTMLElement>(null);
	const isLive =
		useInViewport(rowRef, {
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
			minHeight={isStacked ? 200 : Math.max(reservedHeight - 40, 160)}
			onContentChange={onNoteContentChange}
		/>
	) : (
		// Same shape as a live note so the row keeps its height and the label
		// does not appear only once the editor mounts.
		<div style={{ height: isStacked ? 200 : reservedHeight }}>
			<div className="plabel mb-[11px] flex h-5 items-center">
				Page {pageNumber}
			</div>
		</div>
	);

	// Side by side is the product, but it needs roughly 760px to be readable.
	// Below that the pair stacks rather than squeezing two unusable columns onto
	// a phone.
	if (isStacked) {
		return (
			<section
				ref={rowRef}
				data-page={pageNumber}
				aria-label={`Page ${pageNumber}`}
			>
				<div
					className="overflow-x-auto bg-gutter"
					style={{ paddingTop: isFirst ? 20 : 0, paddingBottom: 18 }}
				>
					<div className="flex w-max min-w-full justify-center">{pageNode}</div>
				</div>
				<div className="px-5 pt-5" style={{ paddingBottom: isLast ? 36 : 24 }}>
					{headerSlot}
					{noteNode}
				</div>
			</section>
		);
	}

	return (
		<section
			ref={rowRef}
			data-page={pageNumber}
			aria-label={`Page ${pageNumber}`}
			// The split is a variable on the scroll container, so every row moves
			// together when the divider is dragged.
			// `minmax(0,1fr)` as the design writes it: without the 0 minimum the
			// note track cannot shrink below its content, and one wide table or
			// code line would push the whole document sideways.
			className="grid items-start [grid-template-columns:var(--split)_minmax(0,1fr)]"
		>
			{/*
			  The page pins while a longer note scrolls past it.

			  `overflow-x: clip` rather than `hidden`: hidden would make this a
			  scroll container on both axes and the pin would stick to the cell
			  instead of the window. Sideways movement is a shared offset applied
			  as a margin, driven by the one scrollbar at the foot of the column,
			  so every page pans together and the control is always reachable.
			*/}
			<div
				className="h-full overflow-x-clip bg-gutter"
				style={{
					paddingInline: PDF_PADDING,
					paddingTop: isFirst ? ROW_TOP : 0,
					paddingBottom: isLast ? ROW_TOP : 18,
				}}
			>
				<div className="sticky top-0">
					{/* Centred while the page fits its column; panned once it does not. */}
					<div
						className={cn(
							"flex w-max min-w-full",
							panX === null && "justify-center",
						)}
						style={panX === null ? undefined : { marginLeft: -panX }}
					>
						{pageNode}
					</div>
				</div>
			</div>

			{/* The whole cell is the note: clicking anywhere in it puts the caret in
			    the editor, so the note is as big a target as it looks. */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: this only forwards a click in dead space to the editor the cell already contains; the editor itself carries the textbox role. */}
			<div
				onMouseDown={focusNoteFromDeadSpace}
				className="min-w-0"
				style={{
					paddingInline: NOTE_PADDING,
					paddingTop: isFirst ? ROW_TOP : 0,
					paddingBottom: isLast ? ROW_TOP : 18,
				}}
			>
				{headerSlot}
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
	const [zoomIndex, setZoomIndex] = useState(FIT_INDEX);
	/*
	  Null while the page is fitted to its column — that is the one mode where
	  dragging the divider resizes the page. Any explicit zoom freezes the column
	  width the zoom is measured against, so resizing the panels after that moves
	  the divider without touching the page. `Fit` returns to tracking.
	*/
	const [fitBase, setFitBase] = useState<number | null>(null);
	const [panX, setPanX] = useState(0);
	const [split, setSplit] = useState(DEFAULT_SPLIT);
	const [isDragging, setIsDragging] = useState(false);
	const [availableWidth, setAvailableWidth] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT);
	const [title, setTitle] = useState(docMeta.name);
	const [isRenaming, setIsRenaming] = useState(false);
	const [confirmation, setConfirmation] = useState<string | null>(null);

	const contentRef = useRef<HTMLDivElement>(null);
	const panScrollRef = useRef<HTMLDivElement>(null);
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

	/* ---- Measurement: the page is sized from its column, never the reverse ---- */

	// Measured synchronously first so the very first paint already uses the real
	// width; the observer then only has to handle later resizes.
	useLayoutEffect(() => {
		const content = contentRef.current;
		if (!content) return;

		// `getBoundingClientRect` rather than `clientWidth`: the latter is rounded
		// to whole pixels, and half of that rounding error shows as a sliver of
		// gutter beside a page that is meant to be full-bleed.
		const measure = () =>
			setAvailableWidth(content.getBoundingClientRect().width);
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
	// Rendering before the column reports its width would draw every visible
	// page twice: once at the fallback width, once at the real one.
	const isMeasured = availableWidth > 0;
	const isStacked = isMeasured && availableWidth < STACK_BELOW;

	// Two equal columns, exactly as the design fixes them. The page fits the
	// column minus its 36px padding; zoom above 100% overflows that cell only.
	// Fractional on purpose: an odd content width splits into two half-pixel
	// columns, and rounding the page down leaves a sliver of gutter beside it.
	const pdfCellWidth = isStacked ? availableWidth : availableWidth * split;
	const baseWidth = fitBase ?? pdfCellWidth;
	const renderWidth = Math.max((baseWidth - PDF_PADDING * 2) * zoom, 160);
	const reservedHeight = renderWidth * aspectRatio;
	/** How far the page sticks out of its column, in px. */
	const overflowX = Math.max(0, renderWidth - pdfCellWidth);
	const clampedPan = Math.min(panX, overflowX);

	const enterZoom = useCallback(
		(next: (index: number) => number) => {
			// Freeze the column the zoom is measured against on the way out of fit.
			setFitBase((current) => current ?? pdfCellWidth);
			setZoomIndex(next);
		},
		[pdfCellWidth],
	);

	const fitToColumn = useCallback(() => {
		setFitBase(null);
		setZoomIndex(FIT_INDEX);
		setPanX(0);
		if (panScrollRef.current) panScrollRef.current.scrollLeft = 0;
	}, []);

	// A page that no longer overflows cannot stay panned.
	useEffect(() => {
		if (overflowX === 0 && panX !== 0) {
			setPanX(0);
			if (panScrollRef.current) panScrollRef.current.scrollLeft = 0;
		}
	}, [overflowX, panX]);

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

	/* ---- Which page am I on? The row crossing the middle of the window. ---- */

	const observerRef = useRef<IntersectionObserver | null>(null);

	// Built on the first registration rather than in an effect: rows register
	// from their own layout effect, which runs before this component's, so an
	// observer created in an effect here would miss the opening rows.
	const getObserver = useCallback(() => {
		if (observerRef.current) return observerRef.current;
		if (typeof IntersectionObserver === "undefined") return null;
		observerRef.current = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const page = Number(
						(entry.target as HTMLElement).dataset.page ?? Number.NaN,
					);
					if (Number.isFinite(page)) setCurrentPage(page);
				}
			},
			{ rootMargin: "-45% 0px -45% 0px" },
		);
		return observerRef.current;
	}, []);

	useEffect(
		() => () => {
			observerRef.current?.disconnect();
			observerRef.current = null;
		},
		[],
	);

	// Rows mount and unmount as the render window moves, so each one registers
	// itself instead of the observer binding one fixed set at mount.
	const registerRow = useCallback(
		(pageNumber: number, element: HTMLElement | null) => {
			const observer = getObserver();
			if (element) {
				rowElements.current.set(pageNumber, element);
				observer?.observe(element);
			} else {
				const previous = rowElements.current.get(pageNumber);
				if (previous) observer?.unobserve(previous);
				rowElements.current.delete(pageNumber);
			}
		},
		[getObserver],
	);

	const scrollToPage = useCallback((pageNumber: number) => {
		const row = rowElements.current.get(pageNumber);
		if (!row) return;
		window.scrollTo({
			top: row.getBoundingClientRect().top + window.scrollY - 8,
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

	/* ---- The divider: the split is dragged, not derived from zoom ---- */

	const applySplitFromClientX = useCallback((clientX: number) => {
		const content = contentRef.current;
		if (!content) return;
		const rect = content.getBoundingClientRect();
		if (rect.width <= 0) return;
		const fraction = (clientX - rect.left) / rect.width;
		setSplit(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, fraction)));
	}, []);

	// Bound to the window rather than the handle: a pointer that outruns a 9px
	// strip must keep dragging it, and releasing outside the window must still
	// end the drag.
	useEffect(() => {
		if (!isDragging) return;
		const onMove = (event: PointerEvent) => {
			event.preventDefault();
			applySplitFromClientX(event.clientX);
		};
		const onUp = () => setIsDragging(false);
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
	}, [isDragging, applySplitFromClientX]);

	function onDividerKeyDown(event: React.KeyboardEvent) {
		const delta =
			event.key === "ArrowLeft"
				? -SPLIT_STEP
				: event.key === "ArrowRight"
					? SPLIT_STEP
					: 0;
		if (delta === 0) {
			if (event.key === "Home" || event.key === "End") {
				event.preventDefault();
				setSplit(event.key === "Home" ? MIN_SPLIT : MAX_SPLIT);
			}
			return;
		}
		event.preventDefault();
		setSplit((current) =>
			Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, current + delta)),
		);
	}

	/*
	  The design has no title anywhere, but renaming is a working feature and a
	  document name does not fit in a 64px rail. It takes the `.plabel` voice at
	  the head of the note column so it reads as the quietest line on the page.
	*/
	const titleSlot = (
		<div className="mb-3">
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
					className="plabel w-full rounded-chip border border-rule-strong bg-paper px-1.5 py-1 text-ink outline-none"
				/>
			) : (
				<button
					type="button"
					onClick={() => setIsRenaming(true)}
					title="Rename this document"
					className="plabel -mx-1.5 max-w-full truncate rounded-chip px-1.5 py-1 text-left hover:bg-tint hover:text-ink"
				>
					{title}
				</button>
			)}
		</div>
	);

	return (
		<div className="flex min-h-dvh bg-paper text-ink">
			<PageRail
				pageCount={docMeta.pageCount}
				currentPage={currentPage}
				pagesWithNotes={pagesWithNotes}
				zoomPercent={Math.round(zoom * 100)}
				canZoomIn={zoomIndex < ZOOM_STEPS.length - 1}
				canZoomOut={zoomIndex > 0}
				onSelect={scrollToPage}
				isFitted={fitBase === null}
				onZoomIn={() =>
					enterZoom((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))
				}
				onZoomOut={() => enterZoom((index) => Math.max(0, index - 1))}
				onFit={fitToColumn}
				onCopy={copyAllNotes}
				onExport={exportNotes}
				onBack={onBack}
			/>

			{/* One live region carries every confirmation in the reader. */}
			<div
				aria-live="polite"
				className={cn(
					"pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center transition-opacity duration-200",
					confirmation ? "opacity-100" : "opacity-0",
				)}
			>
				{confirmation && (
					<span className="flex items-center gap-1.5 rounded-control border border-rule-strong bg-surface px-3 py-1.5 text-tiny font-medium text-ink shadow-float">
						<Check className="size-3.5 text-accent" />
						{confirmation}
					</span>
				)}
			</div>

			<div
				ref={contentRef}
				className={cn(
					"relative min-w-0 flex-1",
					isDragging && "cursor-col-resize select-none",
				)}
				style={{ "--split": `${split * 100}%` } as React.CSSProperties}
			>
				{!isStacked && (
					// biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be focused or dragged; this separator is an interactive control.
					<div
						role="separator"
						aria-orientation="vertical"
						aria-label="Resize the page and note columns"
						aria-valuemin={Math.round(MIN_SPLIT * 100)}
						aria-valuemax={Math.round(MAX_SPLIT * 100)}
						aria-valuenow={Math.round(split * 100)}
						tabIndex={0}
						onKeyDown={onDividerKeyDown}
						onPointerDown={(event) => {
							event.preventDefault();
							setIsDragging(true);
						}}
						onDoubleClick={() => setSplit(DEFAULT_SPLIT)}
						title="Drag to resize · double-click to reset"
						className={cn(
							"group absolute inset-y-0 z-20 -ml-[6px] w-3 cursor-col-resize",
							"left-[var(--split)]",
						)}
					>
						<span
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
								isDragging ? "bg-ink-2" : "bg-rule-strong group-hover:bg-ink-2",
							)}
						/>
					</div>
				)}
				{pages.map((pageNumber) => (
					<PageRow
						key={pageNumber}
						pdfDoc={pdfDoc}
						docId={docMeta.id}
						pageNumber={pageNumber}
						renderWidth={renderWidth}
						reservedHeight={reservedHeight}
						initialMarkdown={notesByPage.get(pageNumber) ?? ""}
						isMeasured={isMeasured}
						isStacked={isStacked}
						isFirst={pageNumber === 1}
						isLast={pageNumber === docMeta.pageCount}
						panX={overflowX > 0 ? clampedPan : null}
						headerSlot={pageNumber === 1 ? titleSlot : undefined}
						onAspectRatio={handleAspectRatio}
						onNoteContentChange={handleNoteContentChange}
						registerRow={registerRow}
					/>
				))}

				{/*
				  One horizontal scrollbar for the whole page column, stuck to the
				  foot of the window. The old per-page scroller sat at the bottom
				  edge of a page, so it was out of reach whenever that edge was off
				  screen — which, on a page taller than the window, is most of the
				  time.
				*/}
				{overflowX > 0 && !isStacked && (
					<div
						className="pointer-events-none sticky bottom-0 z-30 w-[var(--split)]"
						style={{ height: 0 }}
					>
						{/* No ARIA label: this is a scroll container, not a control, and
						    a page is reached by number from the rail rather than by
						    panning. Keeping it unlabelled leaves it out of the reading
						    order instead of announcing a decoration. */}
						<div
							ref={panScrollRef}
							onScroll={(event) => setPanX(event.currentTarget.scrollLeft)}
							title="Scroll the page sideways"
							className="pdf-scroll pointer-events-auto absolute inset-x-0 bottom-0 overflow-x-auto overflow-y-hidden border-t border-rule bg-gutter"
						>
							<div style={{ width: renderWidth, height: 1 }} />
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
