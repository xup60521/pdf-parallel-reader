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
/** The design caps the note at 560px so a wide window cannot stretch the measure. */
const NOTE_MEASURE = 560;

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
			className="grid grid-cols-2 items-start"
		>
			{/*
			  The page pins while a longer note scrolls past it. Horizontal overflow
			  from zoom lives on the sticky element itself, because a scroll
			  container around a sticky child would cancel the pin.
			*/}
			<div
				className="h-full bg-gutter"
				style={{
					paddingInline: PDF_PADDING,
					paddingTop: isFirst ? ROW_TOP : 0,
					paddingBottom: isLast ? ROW_TOP : 18,
				}}
			>
				<div className="sticky top-0 overflow-x-auto">
					<div className="flex w-max min-w-full">{pageNode}</div>
				</div>
			</div>

			<div
				style={{
					paddingInline: NOTE_PADDING,
					paddingTop: isFirst ? ROW_TOP : 0,
					paddingBottom: isLast ? ROW_TOP : 18,
				}}
			>
				<div style={{ maxWidth: NOTE_MEASURE }}>
					{headerSlot}
					{noteNode}
				</div>
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
	const [availableWidth, setAvailableWidth] = useState(0);
	const [currentPage, setCurrentPage] = useState(1);
	const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT);
	const [title, setTitle] = useState(docMeta.name);
	const [isRenaming, setIsRenaming] = useState(false);
	const [confirmation, setConfirmation] = useState<string | null>(null);

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
	const pdfCellWidth = isStacked ? availableWidth : availableWidth / 2;
	const renderWidth = Math.max((pdfCellWidth - PDF_PADDING * 2) * zoom, 160);
	const reservedHeight = renderWidth * aspectRatio;

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
				onZoomIn={() =>
					setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))
				}
				onZoomOut={() => setZoomIndex((index) => Math.max(0, index - 1))}
				onFit={() => setZoomIndex(FIT_INDEX)}
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

			<div ref={contentRef} className="min-w-0 flex-1">
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
						headerSlot={pageNumber === 1 ? titleSlot : undefined}
						onAspectRatio={handleAspectRatio}
						onNoteContentChange={handleNoteContentChange}
						registerRow={registerRow}
					/>
				))}
			</div>
		</div>
	);
}
