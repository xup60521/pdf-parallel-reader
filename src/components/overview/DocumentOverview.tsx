import {
	Download,
	FileText,
	Loader2,
	Plus,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
	db,
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
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";

interface DocumentOverviewProps {
	onSelectDocument: (docId: string) => void;
}

const DEMO_NOTES: Array<[number, string]> = [
	[
		1,
		`## Consensus foundations

- ==Replicated state machine safety== is the core problem.
- **FLP (1985)**: no deterministic asynchronous protocol guarantees liveness with even one crash.

> Partial synchrony or randomized timeouts are required to work around FLP.

- [ ] Re-read the FLP proof sketch
- [ ] Compare with the Chandra–Toueg failure detector result
`,
	],
	[
		2,
		`## Raft, in detail

Raft splits consensus into three orthogonal parts:

1. Leader election
2. Log replication
3. Safety

### Election

Nodes start as \`Follower\`. With no heartbeat inside a randomized timeout of
150–300 ms they become \`Candidate\` and issue \`RequestVote\`.

\`\`\`ts
interface RequestVoteResponse {
  term: number;
  voteGranted: boolean;
}
\`\`\`

### Log invariants

| Property | Guarantee |
| --- | --- |
| Same index and term | Same command |
| Same index and term | All preceding entries identical |

### Split votes

Randomized timeouts make split votes rare, and the jitter means one candidate
wakes first in the next round. Quorum size is $\\lfloor n/2 \\rfloor + 1$.

Production notes:

- [ ] Bound clock drift
- [ ] Add pre-vote so a rejoining partition cannot disrupt the live leader
`,
	],
	[
		3,
		`## Comparison

- **Raft** — built for understandability, crash-fault tolerant.
- **Multi-Paxos** — most historical adoption, hardest to implement correctly.
- **EPaxos** — leaderless, removes the leader bottleneck for geo-replication.
`,
	],
];

function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number) {
	return new Date(timestamp).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function DocumentOverview({ onSelectDocument }: DocumentOverviewProps) {
	const [documents, setDocuments] = useState<PdfDocument[]>([]);
	const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [busyMessage, setBusyMessage] = useState<string | null>(null);
	const [problem, setProblem] = useState<string | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const dropZoneId = useId();

	const refresh = useCallback(async () => {
		try {
			const docs = await getAllDocuments();
			setDocuments(docs);

			const counts: Record<string, number> = {};
			await Promise.all(
				docs.map(async (doc) => {
					const notes = await getNotesForPdf(doc.id);
					counts[doc.id] = notes.filter(
						(note) => note.contentMarkdown.trim().length > 0,
					).length;
				}),
			);
			setNoteCounts(counts);
		} catch (error) {
			console.error("Could not read the local library:", error);
			setProblem(
				"Your browser blocked local storage, so the library is empty.",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	async function addDocument(file: File) {
		if (!file.name.toLowerCase().endsWith(".pdf")) {
			setProblem(`${file.name} is not a PDF. Choose a file ending in .pdf.`);
			return;
		}

		setProblem(null);
		setBusyMessage("Reading the file");

		try {
			const buffer = await file.arrayBuffer();
			setBusyMessage("Reading the page structure");
			const pdf = await loadPdfDocument(buffer);

			setBusyMessage("Drawing the cover");
			const thumbnail = await generateThumbnail(buffer);

			const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
			await db.documents.add({
				id,
				name: file.name,
				size: file.size,
				pageCount: pdf.numPages,
				thumbnailDataUrl: thumbnail,
				fileData: buffer,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});

			await refresh();
			onSelectDocument(id);
		} catch (error) {
			console.error("Could not open this PDF:", error);
			setProblem(
				`${file.name} could not be opened. The file may be encrypted or damaged.`,
			);
		} finally {
			setBusyMessage(null);
		}
	}

	async function addDemoDocument() {
		setProblem(null);
		setBusyMessage("Building the sample paper");

		try {
			const sample = await createSamplePdf();
			setBusyMessage("Drawing the cover");
			const thumbnail = await generateThumbnail(sample.fileData);

			const id = `doc_demo_${Date.now()}`;
			await db.documents.add({
				id,
				name: sample.name,
				size: sample.fileData.byteLength,
				pageCount: sample.pageCount,
				thumbnailDataUrl: thumbnail,
				fileData: sample.fileData,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});

			setBusyMessage("Writing the sample notes");
			for (const [page, markdown] of DEMO_NOTES) {
				await saveNoteForPage(id, page, markdown);
			}

			await refresh();
			onSelectDocument(id);
		} catch (error) {
			console.error("Could not build the sample document:", error);
			setProblem("The sample document could not be built.");
		} finally {
			setBusyMessage(null);
		}
	}

	async function removeDocument(id: string) {
		try {
			await deleteDocument(id);
			setPendingDelete(null);
			await refresh();
		} catch (error) {
			console.error("Could not delete this document:", error);
			setProblem("That document could not be deleted.");
		}
	}

	async function exportNotes(doc: PdfDocument) {
		try {
			const markdown = await exportDocumentNotesAsMarkdown(doc.id);
			const url = URL.createObjectURL(
				new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
			);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${doc.name.replace(/\.pdf$/i, "")}.md`;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Could not export these notes:", error);
			setProblem("Those notes could not be exported.");
		}
	}

	const isBusy = busyMessage !== null;

	return (
		<div className="min-h-dvh bg-desk text-ink">
			<header className="border-b border-rule bg-surface">
				<div className="mx-auto flex h-13 max-w-5xl items-center justify-between gap-4 px-6">
					<span className="text-ui font-semibold tracking-[-0.01em]">
						Parallel PDF Reader
					</span>
					<ThemeToggle />
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-6 pb-20 pt-12">
				{/*
				  The hero is the act the product exists for: put a PDF here and start
				  writing next to it. Nothing else competes with the drop target.
				*/}
				<div className="max-w-xl">
					<h1 className="font-serif text-[1.75rem] leading-[1.25] tracking-[-0.015em] text-ink">
						Read a page. Write about that page.
					</h1>
					<p className="mt-3 max-w-md text-ui leading-relaxed text-ink-2">
						Each PDF page gets its own note, side by side and locked together as
						you scroll. Files and notes stay in this browser.
					</p>
				</div>

				{/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target has no ARIA role; the same action is reachable from the two buttons inside it. */}
				<div
					className={cn(
						"mt-8 rounded-panel border border-dashed p-1 transition-colors",
						isDragOver ? "border-quill bg-quill-soft" : "border-rule-strong",
					)}
					onDragOver={(event) => {
						event.preventDefault();
						setIsDragOver(true);
					}}
					onDragLeave={() => setIsDragOver(false)}
					onDrop={(event) => {
						event.preventDefault();
						setIsDragOver(false);
						const file = event.dataTransfer.files?.[0];
						if (file) addDocument(file);
					}}
				>
					<div className="flex flex-col items-center gap-4 rounded-[calc(var(--radius-panel)-2px)] bg-surface px-6 py-9 text-center">
						<span className="flex size-10 items-center justify-center rounded-control bg-quill-soft text-quill">
							<Upload className="size-4.5" />
						</span>
						<div>
							<p className="text-ui font-medium text-ink" id={dropZoneId}>
								Drop a PDF here
							</p>
							<p className="mt-1 text-tiny text-ink-2">
								Nothing is uploaded. The file is stored in this browser only.
							</p>
						</div>
						<div className="flex flex-wrap items-center justify-center gap-2">
							<Button
								variant="primary"
								onClick={() => fileInputRef.current?.click()}
								disabled={isBusy}
								aria-describedby={dropZoneId}
							>
								<Plus className="size-3.5" />
								Choose a PDF
							</Button>
							<Button onClick={addDemoDocument} disabled={isBusy}>
								<Sparkles className="size-3.5 text-marker-ink" />
								Try the sample paper
							</Button>
						</div>
						<input
							ref={fileInputRef}
							type="file"
							accept="application/pdf"
							className="sr-only"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) addDocument(file);
								event.target.value = "";
							}}
						/>
					</div>
				</div>

				<div aria-live="polite" className="mt-4 empty:mt-0">
					{busyMessage && (
						<p className="flex items-center gap-2 rounded-control border border-rule bg-surface px-3 py-2 text-tiny text-ink-2">
							<Loader2 className="size-3.5 animate-spin text-quill" />
							{busyMessage}
						</p>
					)}
					{problem && (
						<p className="flex items-start justify-between gap-3 rounded-control border border-danger/35 bg-danger-soft px-3 py-2 text-tiny text-danger">
							<span>{problem}</span>
							<button
								type="button"
								onClick={() => setProblem(null)}
								className="shrink-0 font-medium underline underline-offset-2"
							>
								Dismiss
							</button>
						</p>
					)}
				</div>

				<section className="mt-14">
					<div className="flex items-baseline justify-between border-b border-rule pb-3">
						<h2 className="text-ui font-semibold text-ink">Your documents</h2>
						{documents.length > 0 && (
							<span className="text-micro tabular-nums text-ink-3">
								{documents.length}
							</span>
						)}
					</div>

					{isLoading ? (
						<p className="flex items-center gap-2 py-10 text-tiny text-ink-3">
							<Loader2 className="size-3.5 animate-spin" />
							Opening the local library
						</p>
					) : documents.length === 0 ? (
						<p className="py-10 text-ui text-ink-2">
							Nothing here yet. Add a PDF above and it will appear in this list.
						</p>
					) : (
						/*
						  A list, not a card grid: the useful comparison between documents is
						  how far along each one is, and a list puts those numbers in a column
						  you can read down.
						*/
						<ul className="divide-y divide-rule">
							{documents.map((doc) => {
								const notes = noteCounts[doc.id] ?? 0;
								const progress =
									doc.pageCount > 0
										? Math.round((notes / doc.pageCount) * 100)
										: 0;
								const isConfirming = pendingDelete === doc.id;

								return (
									<li
										key={doc.id}
										className="group flex items-center gap-4 py-3.5"
									>
										<button
											type="button"
											onClick={() => onSelectDocument(doc.id)}
											className="flex min-w-0 flex-1 items-center gap-4 text-left"
										>
											<span className="sheet flex h-14 w-[2.75rem] shrink-0 items-center justify-center overflow-hidden">
												{doc.thumbnailDataUrl ? (
													<img
														src={doc.thumbnailDataUrl}
														alt=""
														className="size-full object-cover object-top"
													/>
												) : (
													<FileText className="size-4 text-ink-3" />
												)}
											</span>

											<span className="min-w-0 flex-1">
												<span className="block truncate text-ui font-medium text-ink group-hover:text-quill">
													{doc.name}
												</span>
												<span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-micro text-ink-3">
													<span className="tabular-nums">
														{doc.pageCount}{" "}
														{doc.pageCount === 1 ? "page" : "pages"}
													</span>
													<span className="tabular-nums">
														{formatSize(doc.size)}
													</span>
													<span>Opened {formatDate(doc.updatedAt)}</span>
												</span>
											</span>

											<span className="hidden w-32 shrink-0 sm:block">
												{notes > 0 ? (
													<>
														<span className="block text-micro tabular-nums text-marker-ink">
															{notes} of {doc.pageCount} annotated
														</span>
														<span className="mt-1 block h-1 overflow-hidden rounded-full bg-surface-3">
															<span
																className="block h-full rounded-full bg-marker"
																style={{ width: `${progress}%` }}
															/>
														</span>
													</>
												) : (
													<span className="block text-micro text-ink-3">
														No notes yet
													</span>
												)}
											</span>
										</button>

										{isConfirming ? (
											<span className="flex shrink-0 items-center gap-1.5 text-micro text-ink-2">
												Delete this and its notes?
												<Button
													size="sm"
													variant="ghost"
													onClick={() => removeDocument(doc.id)}
													className="text-danger hover:bg-danger-soft hover:text-danger"
												>
													Delete
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => setPendingDelete(null)}
												>
													Keep
												</Button>
											</span>
										) : (
											<span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
												<Button
													size="icon"
													variant="ghost"
													onClick={() => exportNotes(doc)}
													title="Download the notes as markdown"
													aria-label={`Download the notes for ${doc.name}`}
												>
													<Download className="size-3.5" />
												</Button>
												<Button
													size="icon"
													variant="danger"
													onClick={() => setPendingDelete(doc.id)}
													title="Delete this document"
													aria-label={`Delete ${doc.name}`}
												>
													<Trash2 className="size-3.5" />
												</Button>
											</span>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</section>
			</main>
		</div>
	);
}
