import { ArrowLeft, Download, Maximize2, Minus, Plus } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { ThemeToggle } from "../ui/ThemeToggle";

interface PageRailProps {
	pageCount: number;
	currentPage: number;
	pagesWithNotes: ReadonlySet<number>;
	zoomPercent: number;
	canZoomIn: boolean;
	canZoomOut: boolean;
	/** True while the page is tracking its column rather than a frozen zoom. */
	isFitted: boolean;
	onSelect: (pageNumber: number) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onZoomChange: (percent: number) => void;
	onFit: () => void;
	onExport: () => void;
	onBack: () => void;
}

/**
 * The design's 64px rail. It is the entire chrome of the reader — there is no
 * header bar — so it carries navigation at the top, the page list in the
 * middle, and the document actions at the bottom.
 *
 * The list is plain numbers rather than thumbnails: at 64px a thumbnail is too
 * small to recognise a page by, and the number is what the design asks for.
 */
export function PageRail({
	pageCount,
	currentPage,
	pagesWithNotes,
	zoomPercent,
	canZoomIn,
	canZoomOut,
	isFitted,
	onSelect,
	onZoomIn,
	onZoomOut,
	onZoomChange,
	onFit,
	onExport,
	onBack,
}: PageRailProps) {
	const listRef = useRef<HTMLOListElement>(null);
	const [zoomDraft, setZoomDraft] = useState(`${zoomPercent}%`);

	useEffect(() => setZoomDraft(`${zoomPercent}%`), [zoomPercent]);

	const commitZoom = () => {
		const normalizedValue = zoomDraft.replace("%", "").trim();
		const value = Number(normalizedValue);
		if (normalizedValue && Number.isFinite(value)) onZoomChange(value);
		else setZoomDraft(`${zoomPercent}%`);
	};

	// Follow the reader. `nearest` is a no-op while the current page is already
	// visible, so scrolling the rail by hand is not fought for as long as the
	// active number stays in view.
	useEffect(() => {
		const entry = listRef.current?.children[currentPage - 1];
		entry?.scrollIntoView({ block: "nearest" });
	}, [currentPage]);

	return (
		<nav
			aria-label="Pages"
			className="sticky top-0 flex h-dvh w-12 shrink-0 flex-col border-r border-rule bg-rail px-1 py-2"
		>
			<div className="flex flex-col gap-px">
				<button
					type="button"
					className="sideb"
					onClick={onBack}
					title="Back to the library"
					aria-label="Back to the library"
				>
					<ArrowLeft className="size-3" />
				</button>
				<ThemeToggle />
			</div>

			<ol
				ref={listRef as RefObject<HTMLOListElement>}
				className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain"
			>
				{Array.from({ length: pageCount }, (_, index) => index + 1).map(
					(pageNumber) => {
						const hasNote = pagesWithNotes.has(pageNumber);
						return (
							<li key={pageNumber}>
								<button
									type="button"
									className="sideb relative"
									aria-current={pageNumber === currentPage ? "page" : undefined}
									onClick={() => onSelect(pageNumber)}
								>
									{pageNumber}
									{hasNote && (
										<>
											<span className="sideb-dot" aria-hidden />
											<span className="sr-only"> — has a note</span>
										</>
									)}
								</button>
							</li>
						);
					},
				)}
			</ol>

			<div className="mt-1.5 flex flex-col gap-px border-t border-rule pt-1.5">
				<button
					type="button"
					className="sideb"
					onClick={onZoomIn}
					disabled={!canZoomIn}
					title="Zoom in"
					aria-label="Zoom in"
				>
					<Plus className="size-3" />
				</button>
				<label className="block" title="Enter a zoom percentage">
					<span className="sr-only">Zoom percentage</span>
					<input
						type="text"
						inputMode="decimal"
						value={zoomDraft}
						onChange={(event) => setZoomDraft(event.target.value)}
						onBlur={commitZoom}
						onKeyDown={(event) => {
							if (event.key === "Enter") event.currentTarget.blur();
							if (event.key === "Escape") {
								setZoomDraft(`${zoomPercent}%`);
								event.currentTarget.blur();
							}
						}}
						aria-label="Zoom percentage"
						className="h-[22px] w-full rounded-chip border border-transparent bg-transparent px-0.5 text-center text-micro tabular-nums text-ink-2 outline-none hover:bg-tint focus:border-rule-strong focus:bg-paper"
					/>
				</label>
				<button
					type="button"
					className="sideb"
					onClick={onZoomOut}
					disabled={!canZoomOut}
					title="Zoom out"
					aria-label="Zoom out"
				>
					<Minus className="size-3" />
				</button>
				<button
					type="button"
					className="sideb mt-1"
					onClick={onFit}
					aria-pressed={isFitted}
					title="Fit page to panel"
					aria-label="Fit page to panel"
				>
					<Maximize2 className="size-3" />
				</button>
				<button
					type="button"
					className="sideb mt-1"
					onClick={onExport}
					title="Export all notes as Markdown"
					aria-label="Export all notes as Markdown"
				>
					<Download className="size-3" />
				</button>
			</div>
		</nav>
	);
}
