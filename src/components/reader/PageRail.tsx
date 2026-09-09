import type { PDFDocumentProxy } from "pdfjs-dist";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useInViewport } from "../../lib/use-in-viewport";
import { cn } from "../../lib/utils";

const THUMBNAIL_WIDTH = 76;

/**
 * One rail thumbnail, rendered the first time it scrolls into the rail. A
 * five-hundred-page book therefore costs five hundred cheap placeholders and
 * only as many canvases as have actually been looked at.
 */
function RailThumbnail({
	pdfDoc,
	pageNumber,
	hasNote,
	isCurrent,
	listRef,
	onSelect,
}: {
	pdfDoc: PDFDocumentProxy;
	pageNumber: number;
	hasNote: boolean;
	isCurrent: boolean;
	listRef: RefObject<HTMLElement | null>;
	onSelect: (pageNumber: number) => void;
}) {
	const holderRef = useRef<HTMLLIElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const shouldRender = useInViewport(holderRef, {
		root: listRef,
		rootMargin: "600px 0px",
		once: true,
	});
	const [aspect, setAspect] = useState(842 / 595);

	useEffect(() => {
		if (!shouldRender) return;
		let cancelled = false;

		pdfDoc
			.getPage(pageNumber)
			.then((page) => {
				const canvas = canvasRef.current;
				if (cancelled || !canvas) return;

				const natural = page.getViewport({ scale: 1 });
				setAspect(natural.height / natural.width);

				const viewport = page.getViewport({
					scale: THUMBNAIL_WIDTH / natural.width,
				});
				const ratio = window.devicePixelRatio || 1;
				canvas.width = Math.floor(viewport.width * ratio);
				canvas.height = Math.floor(viewport.height * ratio);
				canvas.style.width = `${THUMBNAIL_WIDTH}px`;
				canvas.style.height = `${Math.round(viewport.height)}px`;

				const context = canvas.getContext("2d", { alpha: false });
				if (!context) return;
				context.setTransform(ratio, 0, 0, ratio, 0, 0);
				return page.render({ canvas, canvasContext: context, viewport })
					.promise;
			})
			.catch((error) => {
				if (
					(error as { name?: string })?.name === "RenderingCancelledException"
				)
					return;
				console.error(
					`Could not draw the thumbnail for page ${pageNumber}`,
					error,
				);
			});

		return () => {
			cancelled = true;
		};
	}, [pdfDoc, pageNumber, shouldRender]);

	return (
		<li ref={holderRef}>
			<button
				type="button"
				onClick={() => onSelect(pageNumber)}
				aria-current={isCurrent ? "true" : undefined}
				className="group flex w-full flex-col items-center gap-1 rounded-chip px-1 py-1.5 transition-colors hover:bg-surface-2"
			>
				<span
					className={cn(
						"relative block overflow-hidden rounded-[2px] border bg-paper transition-colors",
						isCurrent
							? "border-quill ring-2 ring-quill/30"
							: "border-rule group-hover:border-rule-strong",
					)}
					style={{
						width: THUMBNAIL_WIDTH,
						height: Math.round(THUMBNAIL_WIDTH * aspect),
					}}
				>
					<canvas ref={canvasRef} className="block" />
					{hasNote && (
						<span
							aria-hidden
							className="absolute right-1 top-1 size-1.5 rounded-full bg-marker shadow-[0_0_0_2px_var(--paper)]"
						/>
					)}
				</span>
				<span
					className={cn(
						"text-micro tabular-nums transition-colors",
						isCurrent ? "font-semibold text-quill" : "text-ink-3",
					)}
				>
					{pageNumber}
					{hasNote && <span className="sr-only"> — has a note</span>}
				</span>
			</button>
		</li>
	);
}

export function PageRail({
	pdfDoc,
	pageCount,
	currentPage,
	pagesWithNotes,
	onSelect,
}: {
	pdfDoc: PDFDocumentProxy;
	pageCount: number;
	currentPage: number;
	pagesWithNotes: ReadonlySet<number>;
	onSelect: (pageNumber: number) => void;
}) {
	const listRef = useRef<HTMLElement>(null);

	// Follow the reader. `nearest` is a no-op while the current page is already
	// visible, so scrolling the rail by hand is not fought for as long as the
	// active thumbnail stays in view.
	useEffect(() => {
		const entry = listRef.current?.children[currentPage - 1];
		entry?.scrollIntoView({ block: "nearest" });
	}, [currentPage]);

	return (
		<nav
			aria-label="Pages"
			className="flex h-full w-[6.25rem] shrink-0 flex-col border-r border-rule bg-surface"
		>
			<div className="flex items-baseline justify-between border-b border-rule px-3 py-2">
				<span className="text-micro font-semibold text-ink-2">Pages</span>
				<span className="text-micro tabular-nums text-ink-3">{pageCount}</span>
			</div>
			<ol
				ref={listRef as RefObject<HTMLOListElement>}
				className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5"
			>
				{Array.from({ length: pageCount }, (_, index) => index + 1).map(
					(pageNumber) => (
						<RailThumbnail
							key={pageNumber}
							pdfDoc={pdfDoc}
							pageNumber={pageNumber}
							hasNote={pagesWithNotes.has(pageNumber)}
							isCurrent={pageNumber === currentPage}
							listRef={listRef}
							onSelect={onSelect}
						/>
					),
				)}
			</ol>
		</nav>
	);
}
