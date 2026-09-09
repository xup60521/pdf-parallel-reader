import {
	BookOpen,
	Download,
	FileCheck,
	FileText,
	FileUp,
	HardDrive,
	Loader2,
	Plus,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	deleteDocument,
	exportDocumentNotesAsMarkdown,
	getAllDocuments,
	getNotesForPdf,
	type PdfDocument,
	saveNoteForPage,
} from "../../lib/db";
import {
	createSamplePdf,
	generateThumbnail,
	loadPdfDocument,
} from "../../lib/pdf-service";

interface DocumentOverviewProps {
	onSelectDocument: (docId: string) => void;
}

export function DocumentOverview({ onSelectDocument }: DocumentOverviewProps) {
	const [documents, setDocuments] = useState<PdfDocument[]>([]);
	const [notesCountMap, setNotesCountMap] = useState<Record<string, number>>(
		{},
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<string | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const refreshDocuments = useCallback(async () => {
		try {
			const docs = await getAllDocuments();
			setDocuments(docs);

			// Fetch note counts for each document
			const counts: Record<string, number> = {};
			for (const doc of docs) {
				const notes = await getNotesForPdf(doc.id);
				const activeNotes = notes.filter(
					(n) => n.contentMarkdown.trim().length > 0,
				);
				counts[doc.id] = activeNotes.length;
			}
			setNotesCountMap(counts);
		} catch (err) {
			console.error("Failed to load documents from IndexedDB:", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		refreshDocuments();
	}, [refreshDocuments]);

	// Process a PDF File (from upload or drop)
	const handleProcessFile = async (file: File) => {
		if (!file.name.toLowerCase().endsWith(".pdf")) {
			alert("Please upload a valid PDF file.");
			return;
		}

		setIsUploading(true);
		setUploadStatus("Reading file...");

		try {
			const arrayBuffer = await file.arrayBuffer();
			setUploadStatus("Parsing PDF structure...");

			const pdfDoc = await loadPdfDocument(arrayBuffer);
			const pageCount = pdfDoc.numPages;

			setUploadStatus("Generating thumbnail...");
			const thumbnail = await generateThumbnail(arrayBuffer);

			const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

			const newDoc: PdfDocument = {
				id: docId,
				name: file.name,
				size: file.size,
				pageCount,
				thumbnailDataUrl: thumbnail,
				fileData: arrayBuffer,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			// Store in Dexie IndexedDB
			const { db } = await import("../../lib/db");
			await db.documents.add(newDoc);

			await refreshDocuments();
			onSelectDocument(docId);
		} catch (err) {
			console.error("Error saving PDF to IndexedDB:", err);
			alert("Could not parse the PDF. Please check if the file is corrupted.");
		} finally {
			setIsUploading(false);
			setUploadStatus(null);
		}
	};

	// Handle Load Demo Document
	const handleLoadDemoDoc = async () => {
		setIsUploading(true);
		setUploadStatus("Generating demo PDF...");

		try {
			const sample = await createSamplePdf();
			setUploadStatus("Generating thumbnail...");
			const thumbnail = await generateThumbnail(sample.fileData);

			const docId = `doc_demo_${Date.now()}`;
			const newDoc: PdfDocument = {
				id: docId,
				name: sample.name,
				size: sample.fileData.byteLength,
				pageCount: sample.pageCount,
				thumbnailDataUrl: thumbnail,
				fileData: sample.fileData,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			const { db } = await import("../../lib/db");
			await db.documents.add(newDoc);

			// Add pre-populated notes demonstrating the outpacing height feature
			setUploadStatus("Populating sample notes...");
			await saveNoteForPage(
				docId,
				1,
				`# Notes: Consensus Foundations\n\n- **Core problem**: Replicated state machine safety.\n- **FLP Impossibility (1985)**: In an asynchronous network, no deterministic consensus protocol can guarantee liveness in the presence of even a single crash.\n\n> Key requirement: Partial synchrony or randomized timeouts are necessary to overcome FLP.\n`,
			);

			// Note 2 is intentionally long to demonstrate the outpacing height layout!
			await saveNoteForPage(
				docId,
				2,
				`# Raft Protocol Detailed Notes\n\n## 1. Subproblems Decomposition\n\nRaft simplifies consensus by decomposing it into 3 orthogonal parts:\n1. **Leader Election**\n2. **Log Replication**\n3. **Safety Guarantee**\n\n## 2. Election Mechanism\n\n- Nodes begin in \`Follower\` state.\n- If no heartbeat received within randomized timeout (150-300ms), transition to \`Candidate\`.\n- Vote request sent via \`RequestVote\` RPC.\n\n\`\`\`typescript\ninterface RequestVoteResponse {\n  term: number;\n  voteGranted: boolean;\n}\n\`\`\`\n\n## 3. Log Invariant Properties\n\n- If two entries in different logs have the same index and term, they store the same command.\n- If two entries in different logs have the same index and term, then their logs are identical in all preceding entries.\n\n## 4. Extended Analysis on Split Votes\n\nRandomized election timeouts drastically diminish the frequency of split votes.\nEven if a split occurs, the random jitter ensures that one candidate times out first in the subsequent round, winning a majority before competitors can reset.\n\n### Practical observations in Production:\n- Clock drift must remain within tight bounds.\n- Network partitions require pre-vote extensions to avoid disrupting the active leader when partitioned nodes rejoin.\n`,
			);

			await saveNoteForPage(
				docId,
				3,
				`# Protocol Comparison Matrix\n\n- **Raft**: Designed for understandability and CFT.\n- **Multi-Paxos**: Highest historical adoption, but complex to implement correctly.\n- **EPaxos**: Leaderless design eliminates the leader bottleneck for geo-replication.\n`,
			);

			await refreshDocuments();
			onSelectDocument(docId);
		} catch (err) {
			console.error("Failed to create demo document:", err);
			alert("Error generating demo document.");
		} finally {
			setIsUploading(false);
			setUploadStatus(null);
		}
	};

	// Delete Document
	const handleDelete = async (docId: string, name: string) => {
		if (
			confirm(`Are you sure you want to delete "${name}" and all its notes?`)
		) {
			await deleteDocument(docId);
			await refreshDocuments();
		}
	};

	// Export Notes
	const handleExport = async (docId: string, name: string) => {
		try {
			const md = await exportDocumentNotesAsMarkdown(docId);
			const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${name.replace(/\.pdf$/i, "")}_notes.md`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error("Export failed:", e);
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<div className="min-h-screen bg-stone-100/70 text-stone-800 dark:bg-stone-950 dark:text-stone-100">
			{/* Top Banner Header */}
			<header className="border-b border-stone-200/80 bg-white/80 px-6 py-6 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/80 shadow-xs">
				<div className="mx-auto flex max-w-6xl flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/20">
								<BookOpen className="size-5" />
							</div>
							<div>
								<h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
									Parallel PDF Reader
								</h1>
								<p className="text-xs text-stone-500 dark:text-stone-400">
									Synchronized PDF reading & page-coupled Markdown note taking •
									Local-first
								</p>
							</div>
						</div>
					</div>

					{/* Quick Action Buttons */}
					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={handleLoadDemoDoc}
							disabled={isUploading}
							className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 transition-all disabled:opacity-50"
						>
							<Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
							<span>Load Demo PDF</span>
						</button>

						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={isUploading}
							className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs shadow-emerald-600/30 hover:bg-emerald-500 transition-all disabled:opacity-50"
						>
							<Plus className="size-4" />
							<span>Upload PDF</span>
						</button>

						<input
							type="file"
							ref={fileInputRef}
							accept="application/pdf"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) handleProcessFile(file);
								e.target.value = "";
							}}
						/>
					</div>
				</div>
			</header>

			{/* Main Content Area */}
			<main className="mx-auto max-w-6xl px-6 py-8">
				{/* Upload Status Alert */}
				{isUploading && (
					<div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
						<Loader2 className="size-5 animate-spin text-emerald-600" />
						<span>{uploadStatus || "Processing..."}</span>
					</div>
				)}

				{/* Drag & Drop Upload Hero Area */}
				<button
					type="button"
					onDragOver={(e) => {
						e.preventDefault();
						setIsDragOver(true);
					}}
					onDragLeave={() => setIsDragOver(false)}
					onDrop={(e) => {
						e.preventDefault();
						setIsDragOver(false);
						const file = e.dataTransfer.files?.[0];
						if (file) handleProcessFile(file);
					}}
					onClick={() => fileInputRef.current?.click()}
					className={`group mb-10 w-full cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
						isDragOver
							? "border-emerald-500 bg-emerald-50/50 dark:border-emerald-400 dark:bg-emerald-950/30"
							: "border-stone-300/80 bg-white/60 hover:border-emerald-400 hover:bg-emerald-50/20 dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-emerald-500"
					}`}
				>
					<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-stone-100 group-hover:bg-emerald-100/70 dark:bg-stone-800 dark:group-hover:bg-emerald-950/80 transition-colors">
						<FileUp className="size-6 text-stone-500 group-hover:text-emerald-700 dark:text-stone-400 dark:group-hover:text-emerald-300" />
					</div>
					<h3 className="mt-3 text-sm font-semibold text-stone-800 dark:text-stone-200">
						Drop your PDF file here, or browse
					</h3>
					<p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
						PDFs are stored locally in your browser with Dexie.js (IndexedDB).
						No cloud upload required.
					</p>
				</button>

				{/* Document Grid Header */}
				<div className="mb-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h2 className="text-base font-bold text-stone-800 dark:text-stone-200">
							Your Documents
						</h2>
						<span className="rounded-full bg-stone-200/70 px-2 py-0.5 text-xs font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300">
							{documents.length}
						</span>
					</div>

					<div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
						<HardDrive className="size-3.5 text-emerald-600" />
						<span>Local-first storage</span>
					</div>
				</div>

				{/* Documents Grid / Empty State */}
				{isLoading ? (
					<div className="flex flex-col items-center justify-center py-16">
						<Loader2 className="size-8 animate-spin text-emerald-600" />
						<span className="mt-3 text-xs text-stone-500">
							Loading documents...
						</span>
					</div>
				) : documents.length === 0 ? (
					<div className="rounded-2xl border border-stone-200 bg-white/70 p-12 text-center dark:border-stone-800 dark:bg-stone-900/60">
						<div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800">
							<FileText className="size-8 text-stone-400" />
						</div>
						<h3 className="mt-4 text-base font-bold text-stone-800 dark:text-stone-200">
							No PDFs in your library yet
						</h3>
						<p className="mx-auto mt-1 max-w-md text-xs text-stone-500 dark:text-stone-400">
							Upload any PDF paper, article, or textbook to begin taking
							side-by-side synchronized notes, or load the demo document.
						</p>
						<div className="mt-6 flex justify-center gap-3">
							<button
								type="button"
								onClick={handleLoadDemoDoc}
								className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
							>
								<Sparkles className="size-4" />
								<span>Load Demo Document</span>
							</button>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{documents.map((doc) => {
							const notesCount = notesCountMap[doc.id] || 0;

							return (
								<div
									key={doc.id}
									className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
								>
									{/* Thumbnail / Preview Area */}
									<button
										type="button"
										onClick={() => onSelectDocument(doc.id)}
										className="relative flex h-48 w-full cursor-pointer items-center justify-center overflow-hidden bg-stone-100 dark:bg-stone-950/80 border-b border-stone-100 dark:border-stone-800/80"
									>
										{doc.thumbnailDataUrl ? (
											<img
												src={doc.thumbnailDataUrl}
												alt={`Preview of ${doc.name}`}
												className="h-full w-auto object-contain transition-transform duration-300 group-hover:scale-105"
											/>
										) : (
											<div className="flex flex-col items-center justify-center text-stone-400">
												<FileText className="size-12" />
												<span className="mt-2 text-xs">PDF Document</span>
											</div>
										)}

										{/* Page count pill */}
										<div className="absolute top-3 left-3 rounded-lg bg-stone-900/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm shadow-xs">
											{doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
										</div>

										{/* Notes count badge */}
										{notesCount > 0 && (
											<div className="absolute top-3 right-3 flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow-xs">
												<FileCheck className="size-3" />
												<span>{notesCount} notes</span>
											</div>
										)}
									</button>

									{/* Document Info Body */}
									<div className="flex flex-1 flex-col p-4">
										<button
											type="button"
											onClick={() => onSelectDocument(doc.id)}
											title={doc.name}
											className="cursor-pointer truncate text-left text-sm font-bold text-stone-800 group-hover:text-emerald-700 dark:text-stone-200 dark:group-hover:text-emerald-400 transition-colors"
										>
											{doc.name}
										</button>

										<div className="mt-2 flex items-center gap-3 text-[11px] text-stone-600 dark:text-stone-300">
											<span>{formatFileSize(doc.size)}</span>
											<span>•</span>
											<span>
												{new Date(doc.updatedAt).toLocaleDateString()}
											</span>
										</div>

										{/* Action Buttons */}
										<div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
											<button
												type="button"
												onClick={() => onSelectDocument(doc.id)}
												className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors"
											>
												<BookOpen className="size-3.5" />
												<span>Open</span>
											</button>

											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={() => handleExport(doc.id, doc.name)}
													title="Export notes as Markdown"
													className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
												>
													<Download className="size-4" />
												</button>

												<button
													type="button"
													onClick={() => handleDelete(doc.id, doc.name)}
													title="Delete document"
													className="rounded-lg p-1.5 text-stone-600 hover:bg-red-50 hover:text-red-700 dark:text-stone-300 dark:hover:bg-red-950/60 dark:hover:text-red-300"
												>
													<Trash2 className="size-4" />
												</button>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</main>
		</div>
	);
}
