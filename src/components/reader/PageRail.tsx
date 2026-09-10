import { ArrowLeft, Minus, Plus } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import { ThemeToggle } from "../ui/ThemeToggle";

interface PageRailProps {
	pageCount: number;
	currentPage: number;
	pagesWithNotes: ReadonlySet<number>;
	zoomPercent: number;
	canZoomIn: boolean;
	canZoomOut: boolean;
	onSelect: (pageNumber: number) => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onFit: () => void;
	onCopy: () => void;
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
	onSelect,
	onZoomIn,
	onZoomOut,
	onFit,
	onCopy,
	onExport,
	onBack,
}: PageRailProps) {
	const listRef = useRef<HTMLOListElement>(null);

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
			className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-rule bg-rail px-2 py-2.5"
		>
			<div className="flex flex-col gap-px">
				<button
					type="button"
					className="sideb"
					onClick={onBack}
					title="Back to the library"
					aria-label="Back to the library"
				>
					<ArrowLeft className="size-3.5" />
				</button>
				<ThemeToggle />
			</div>

			<div className="mb-2 mt-1.5 border-b border-rule pb-2 text-center text-micro tabular-nums text-ink-2">
				{pageCount} pp
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

			<div className="mt-2 flex flex-col gap-px border-t border-rule pt-2">
				<button
					type="button"
					className="sideb"
					onClick={onZoomIn}
					disabled={!canZoomIn}
					title="Zoom in"
					aria-label="Zoom in"
				>
					<Plus className="size-3.5" />
				</button>
				<span className="py-0.5 text-center text-micro tabular-nums text-ink-2">
					{zoomPercent}%
				</span>
				<button
					type="button"
					className="sideb"
					onClick={onZoomOut}
					disabled={!canZoomOut}
					title="Zoom out"
					aria-label="Zoom out"
				>
					<Minus className="size-3.5" />
				</button>
				<button
					type="button"
					className="sideb mt-1.5"
					onClick={onFit}
					title="Fit the page to its column"
				>
					Fit
				</button>
				<button
					type="button"
					className="sideb mt-1.5"
					onClick={onCopy}
					title="Copy every note as markdown"
				>
					Copy
				</button>
				<button
					type="button"
					className="sideb mt-1.5"
					onClick={onExport}
					title="Download every note as markdown"
				>
					Export
				</button>
			</div>
		</nav>
	);
}
