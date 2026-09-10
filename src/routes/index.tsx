import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import { DocumentOverview } from "../components/overview/DocumentOverview";
import { ParallelReaderView } from "../components/reader/ParallelReaderView";
import { Button } from "../components/ui/Button";
import {
	getDocumentById,
	getNotesForPdf,
	type PageNote,
	type PdfDocument,
} from "../lib/db";
import { loadPdfDocument } from "../lib/pdf-service";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): { doc?: string } => {
		return {
			doc: typeof search.doc === "string" ? search.doc : undefined,
		};
	},
	component: AppIndexPage,
});

function AppIndexPage() {
	const { doc: selectedDocId } = Route.useSearch();
	const navigate = useNavigate();

	const [isClient, setIsClient] = useState(false);
	const [activeDocMeta, setActiveDocMeta] = useState<PdfDocument | null>(null);
	const [activePdfDoc, setActivePdfDoc] = useState<PDFDocumentProxy | null>(
		null,
	);
	const [activeNotes, setActiveNotes] = useState<PageNote[]>([]);
	const [isLoadingReader, setIsLoadingReader] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		setIsClient(true);
	}, []);

	// Load document when selectedDocId changes
	useEffect(() => {
		if (!isClient) return;

		if (!selectedDocId) {
			setActiveDocMeta(null);
			setActivePdfDoc(null);
			setActiveNotes([]);
			setIsLoadingReader(false);
			setLoadError(null);
			return;
		}

		const currentDocId = selectedDocId;
		let isCancelled = false;
		setIsLoadingReader(true);
		setLoadError(null);

		async function loadReaderData() {
			try {
				const doc = await getDocumentById(currentDocId);
				if (!doc) {
					if (!isCancelled) {
						setLoadError("That document is not in this browser");
						setIsLoadingReader(false);
					}
					return;
				}

				const notes = await getNotesForPdf(currentDocId);
				const loadedPdf = await loadPdfDocument(doc.fileData);

				if (!isCancelled) {
					setActiveDocMeta(doc);
					setActivePdfDoc(loadedPdf);
					setActiveNotes(notes);
					setIsLoadingReader(false);
				}
			} catch (err: unknown) {
				console.error("Could not open the reader:", err);
				if (!isCancelled) {
					setLoadError("That PDF could not be opened");
					setIsLoadingReader(false);
				}
			}
		}

		loadReaderData();

		return () => {
			isCancelled = true;
		};
	}, [selectedDocId, isClient]);

	if (!isClient) {
		return (
			<div className="grid min-h-dvh place-content-center bg-paper">
				<Loader2 className="size-5 animate-spin text-ink-faint" />
			</div>
		);
	}

	// Selected document reader view
	if (selectedDocId) {
		if (isLoadingReader) {
			return (
				<div className="grid min-h-dvh place-content-center justify-items-center gap-3 bg-paper">
					<Loader2 className="size-5 animate-spin text-ink-2" />
					<p className="text-ui text-ink-2">Opening the document</p>
				</div>
			);
		}

		if (loadError || !activeDocMeta || !activePdfDoc) {
			return (
				<div className="grid min-h-dvh place-content-center bg-paper p-6">
					<div className="max-w-sm rounded-control border border-rule-strong bg-surface p-6">
						<h1 className="text-ui font-semibold text-ink">
							{loadError ?? "That document is not in this browser"}
						</h1>
						<p className="mt-2 text-tiny leading-relaxed text-ink-2">
							Documents live only in the browser that added them, so a link
							opened elsewhere, or storage that has since been cleared, will not
							resolve. Add the PDF again from the library.
						</p>
						<Button
							variant="primary"
							className="mt-5"
							onClick={() => navigate({ to: "/", search: {} })}
						>
							Back to the library
						</Button>
					</div>
				</div>
			);
		}

		return (
			<ParallelReaderView
				pdfDoc={activePdfDoc}
				docMeta={activeDocMeta}
				initialNotes={activeNotes}
				onBack={() => navigate({ to: "/", search: {} })}
			/>
		);
	}

	// Document library overview view
	return (
		<DocumentOverview
			onSelectDocument={(id) => navigate({ to: "/", search: { doc: id } })}
		/>
	);
}
