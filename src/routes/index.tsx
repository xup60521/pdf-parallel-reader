import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import { DocumentOverview } from "../components/overview/DocumentOverview";
import { ParallelReaderView } from "../components/reader/ParallelReaderView";
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
						setLoadError("Document not found in local storage.");
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
				console.error("Failed to load reader:", err);
				if (!isCancelled) {
					setLoadError("Failed to load the PDF document. Please try again.");
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
			<div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
				<Loader2 className="size-8 animate-spin text-emerald-600" />
			</div>
		);
	}

	// Selected document reader view
	if (selectedDocId) {
		if (isLoadingReader) {
			return (
				<div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 dark:bg-stone-950">
					<Loader2 className="size-10 animate-spin text-emerald-600 dark:text-emerald-400" />
					<p className="mt-4 text-sm font-medium text-stone-600 dark:text-stone-400">
						Opening PDF & loading notes...
					</p>
				</div>
			);
		}

		if (loadError || !activeDocMeta || !activePdfDoc) {
			return (
				<div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 p-6 dark:bg-stone-950">
					<div className="rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900 shadow-md max-w-md">
						<h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
							{loadError || "Error loading document"}
						</h3>
						<p className="mt-2 text-sm text-stone-500">
							The requested PDF document could not be retrieved from IndexedDB.
						</p>
						<button
							type="button"
							onClick={() => navigate({ search: {} })}
							className="mt-6 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
						>
							Back to Overview
						</button>
					</div>
				</div>
			);
		}

		return (
			<ParallelReaderView
				pdfDoc={activePdfDoc}
				docMeta={activeDocMeta}
				initialNotes={activeNotes}
				onBack={() => navigate({ search: {} })}
			/>
		);
	}

	// Document library overview view
	return (
		<DocumentOverview
			onSelectDocument={(id) => navigate({ search: { doc: id } })}
		/>
	);
}
