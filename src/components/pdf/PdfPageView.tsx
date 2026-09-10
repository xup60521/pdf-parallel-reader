import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { getPdfjs } from "../../lib/pdf-service";
import "./pdf-page.css";

interface PdfPageViewProps {
	pdfDoc: PDFDocumentProxy;
	pageNumber: number;
	/** Rendered width in CSS pixels. The page always fits exactly. */
	width: number;
	onAspectRatio?: (pageNumber: number, ratio: number) => void;
}

/**
 * Renders one page at exactly the width it is given, so a page can never
 * overflow its column or float undersized inside it. Zoom is applied by the
 * reader as a multiplier on the available column width, not as a raw PDF scale.
 */
export function PdfPageView({
	pdfDoc,
	pageNumber,
	width,
	onAspectRatio,
}: PdfPageViewProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const textLayerRef = useRef<HTMLDivElement>(null);
	const renderTaskRef = useRef<RenderTask | null>(null);
	const [height, setHeight] = useState<number | null>(null);
	const [failed, setFailed] = useState(false);

	const onAspectRatioRef = useRef(onAspectRatio);
	onAspectRatioRef.current = onAspectRatio;

	useEffect(() => {
		let cancelled = false;

		async function render() {
			const canvas = canvasRef.current;
			if (!canvas || width <= 0) return;

			renderTaskRef.current?.cancel();
			renderTaskRef.current = null;

			try {
				const page = await pdfDoc.getPage(pageNumber);
				if (cancelled) return;

				const natural = page.getViewport({ scale: 1 });
				const scale = width / natural.width;
				const viewport = page.getViewport({ scale });
				// Kept fractional: the column width is half of an odd number as often
				// as not, and rounding here leaves a hairline of the gutter showing
				// down the edge of a page that is meant to be full-bleed.
				const cssHeight = viewport.height;

				setHeight(cssHeight);
				onAspectRatioRef.current?.(pageNumber, natural.height / natural.width);

				const ratio = window.devicePixelRatio || 1;
				canvas.width = Math.floor(viewport.width * ratio);
				canvas.height = Math.floor(viewport.height * ratio);
				canvas.style.width = `${viewport.width}px`;
				canvas.style.height = `${cssHeight}px`;

				const context = canvas.getContext("2d", { alpha: false });
				if (!context) return;
				context.setTransform(ratio, 0, 0, ratio, 0, 0);

				const task = page.render({ canvas, canvasContext: context, viewport });
				renderTaskRef.current = task;
				await task.promise;
				if (cancelled) return;

				// The text layer is what makes a quotation draggable into the note.
				const container = textLayerRef.current;
				if (container) {
					container.replaceChildren();
					container.style.setProperty("--total-scale-factor", String(scale));
					container.style.width = `${viewport.width}px`;
					container.style.height = `${cssHeight}px`;

					const { TextLayer } = await getPdfjs();
					if (cancelled) return;
					await new TextLayer({
						textContentSource: page.streamTextContent(),
						container,
						viewport,
					}).render();
				}

				setFailed(false);
			} catch (error) {
				if (
					(error as { name?: string })?.name === "RenderingCancelledException"
				) {
					return;
				}
				console.error(`Could not render page ${pageNumber}:`, error);
				if (!cancelled) setFailed(true);
			}
		}

		render();

		return () => {
			cancelled = true;
			renderTaskRef.current?.cancel();
			renderTaskRef.current = null;
		};
	}, [pdfDoc, pageNumber, width]);

	return (
		<div
			className="sheet relative shrink-0 overflow-hidden"
			style={{ width, height: height ?? undefined, minHeight: height ?? 200 }}
		>
			<canvas ref={canvasRef} className="block" />
			{/*
			  pdf.js owns this subtree. The runs are transparent but they are the
			  only machine-readable form of the page, so they stay exposed to
			  assistive technology rather than hidden behind aria-hidden.
			*/}
			<div ref={textLayerRef} className="pdf-text-layer" />
			{failed && (
				/* On the sheet, not on the page: this text sits on white paper in
				   both skins, so it cannot take its colour from the skin. */
				<div className="absolute inset-0 grid place-content-center gap-1 p-6 text-center">
					<p className="text-ui font-medium text-on-sheet">
						Page {pageNumber} did not render
					</p>
					<p className="text-tiny text-on-sheet-2">
						The page data may be damaged. Other pages are unaffected.
					</p>
				</div>
			)}
		</div>
	);
}
