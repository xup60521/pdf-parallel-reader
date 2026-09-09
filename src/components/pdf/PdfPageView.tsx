import { Loader2 } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

interface PdfPageViewProps {
	pdfDoc: PDFDocumentProxy;
	pageNumber: number;
	scale?: number;
	onDimensionsChange?: (
		pageNumber: number,
		width: number,
		height: number,
	) => void;
}

export function PdfPageView({
	pdfDoc,
	pageNumber,
	scale = 1.0,
	onDimensionsChange,
}: PdfPageViewProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [dimensions, setDimensions] = useState<{
		width: number;
		height: number;
	}>({
		width: 595,
		height: 842,
	});
	const renderTaskRef = useRef<RenderTask | null>(null);

	useEffect(() => {
		let isCancelled = false;

		async function renderPage() {
			if (!canvasRef.current || !pdfDoc) return;

			setIsLoading(true);

			// Cancel any ongoing render task
			if (renderTaskRef.current) {
				try {
					renderTaskRef.current.cancel();
				} catch {
					// ignore cancel error
				}
				renderTaskRef.current = null;
			}

			try {
				const page = await pdfDoc.getPage(pageNumber);
				if (isCancelled) return;

				const pixelRatio =
					typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
				const viewport = page.getViewport({ scale });

				const displayWidth = Math.floor(viewport.width);
				const displayHeight = Math.floor(viewport.height);

				setDimensions({ width: displayWidth, height: displayHeight });
				if (onDimensionsChange) {
					onDimensionsChange(pageNumber, displayWidth, displayHeight);
				}

				const canvas = canvasRef.current;
				if (!canvas) return;

				canvas.width = Math.floor(viewport.width * pixelRatio);
				canvas.height = Math.floor(viewport.height * pixelRatio);
				canvas.style.width = `${displayWidth}px`;
				canvas.style.height = `${displayHeight}px`;

				const ctx = canvas.getContext("2d", { alpha: false });
				if (!ctx) return;

				// Scale context to support high DPI displays
				ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

				const renderContext = {
					canvasContext: ctx,
					viewport,
				};

				const renderTask = page.render(renderContext);
				renderTaskRef.current = renderTask;

				await renderTask.promise;
				if (!isCancelled) {
					setIsLoading(false);
				}
			} catch (err: unknown) {
				const errorName = (err as { name?: string })?.name;
				if (errorName !== "RenderingCancelledException") {
					console.error(`Error rendering PDF page ${pageNumber}:`, err);
				}
			}
		}

		renderPage();

		return () => {
			isCancelled = true;
			if (renderTaskRef.current) {
				try {
					renderTaskRef.current.cancel();
				} catch {
					// ignore
				}
			}
		};
	}, [pdfDoc, pageNumber, scale, onDimensionsChange]);

	return (
		<div className="relative flex flex-col items-center">
			{/* Page frame with paper shadow */}
			<div
				className="relative overflow-hidden rounded-xl bg-white shadow-md border border-stone-200/80 transition-shadow hover:shadow-lg dark:border-stone-800 dark:bg-stone-900"
				style={{
					width: `${dimensions.width}px`,
					minHeight: `${dimensions.height}px`,
				}}
			>
				{/* Page top tag */}
				<div className="absolute top-2 left-3 z-10 select-none rounded bg-stone-900/70 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm shadow-xs">
					Page {pageNumber}
				</div>

				{/* Loading overlay */}
				{isLoading && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-stone-50/80 dark:bg-stone-900/80 backdrop-blur-[2px]">
						<Loader2 className="size-6 animate-spin text-emerald-600 dark:text-emerald-400" />
						<span className="mt-2 text-xs font-medium text-stone-500 dark:text-stone-400">
							Rendering page {pageNumber}...
						</span>
					</div>
				)}

				{/* Canvas */}
				<canvas ref={canvasRef} className="block mx-auto" />
			</div>
		</div>
	);
}
