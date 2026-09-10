import { Download, FileText, Loader2, Trash2 } from "lucide-react";
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

/** The widest a ribbon gets before pages start sharing a tick. */
const RIBBON_TICKS = 44;

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

/** The reader shows a document by name, so the extension is noise here. */
function titleOf(fileName: string) {
	return fileName.replace(/\.pdf$/i, "");
}

/**
 * One tick per page, raised and coloured where a note exists. A percentage says
 * how much is done; this says *where* the work is — whether you stopped at page
 * four or have been picking at the middle. Ticks are a fixed width rather than
 * a share of the row, so the ribbon is as long as the document is: a three-page
 * handout gets a stub, a long paper gets a full span. Past the cap several
 * pages fold into one tick, and a tick then means "something written in here".
 */
function PageRibbon({
	pageCount,
	annotatedPages,
}: {
	pageCount: number;
	annotatedPages: number[];
}) {
	const count = Math.max(1, Math.min(pageCount, RIBBON_TICKS));
	const marked = new Set<number>();
	for (const page of annotatedPages) {
		marked.add(
			Math.min(count - 1, Math.floor(((page - 1) / pageCount) * count)),
		);
	}
	const ticks = Array.from({ length: count }, (_, index) => ({
		id: `tick-${index}`,
		isMarked: marked.has(index),
	}));

	return (
		<span aria-hidden className="flex h-2.5 items-end gap-px">
			{ticks.map((tick) => (
				<span
					key={tick.id}
					className={cn(
						"w-1.5",
						tick.isMarked ? "h-2.5 bg-accent" : "h-[3px] bg-tint-strong",
					)}
				/>
			))}
		</span>
	);
}

interface DocumentOverviewProps {
	onSelectDocument: (docId: string) => void;
}

export function DocumentOverview({ onSelectDocument }: DocumentOverviewProps) {
	const [documents, setDocuments] = useState<PdfDocument[]>([]);
	const [annotated, setAnnotated] = useState<Record<string, number[]>>({});
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

			const pages: Record<string, number[]> = {};
			await Promise.all(
				docs.map(async (doc) => {
					const notes = await getNotesForPdf(doc.id);
					pages[doc.id] = notes
						.filter((note) => note.contentMarkdown.trim().length > 0)
						.map((note) => note.pageNumber);
				}),
			);
			setAnnotated(pages);
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
			anchor.download = `${titleOf(doc.name)}.md`;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Could not export these notes:", error);
			setProblem("Those notes could not be exported.");
		}
	}

	const isBusy = busyMessage !== null;

	return (
		<div className="min-h-dvh bg-paper text-ink">
			{/*
			  The screen is the reader at rest: the page column on the left, the
			  writing column on the right, one rule between them, and no bar across
			  the top — the reader has no header either. Both columns start at the
			  same line, the way a page and its note do. The sheet then holds still
			  while the writing scrolls past it, which is what a page does in the
			  reader once its note runs long.
			*/}
			<div className="lg:grid lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
				{/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target has no ARIA role; the same action is reachable from the two buttons inside it. */}
				<div
					className="bg-gutter"
					onDragOver={(event) => {
						event.preventDefault();
						setIsDragOver(true);
					}}
					onDragLeave={(event) => {
						// Moving onto a child fires dragleave too, and the sheet changes
						// its wording on drag, so a flicker would be visible.
						if (event.currentTarget.contains(event.relatedTarget as Node))
							return;
						setIsDragOver(false);
					}}
					onDrop={(event) => {
						event.preventDefault();
						setIsDragOver(false);
						const file = event.dataTransfer.files?.[0];
						if (file) addDocument(file);
					}}
				>
					<div className="relative flex flex-col items-center gap-5 px-6 pt-14 pb-10 lg:sticky lg:top-0 lg:min-h-dvh lg:px-10 lg:py-16">
						{/* The reader keeps this at the top of its rail; this is the same
						    corner of the same column. The width is the rail's own 40px:
						    `.sideb` sizes to its container, so the container sets it. */}
						<span className="absolute left-3 top-3 w-10 lg:left-4 lg:top-4">
							<ThemeToggle />
						</span>
						<div
							className={cn(
								"flex aspect-[595/842] w-full max-w-[17rem] flex-col rounded-sheet border bg-paper p-3 transition-colors duration-150 sm:max-w-[19rem] lg:max-w-[21rem] lg:p-4",
								isDragOver ? "border-ink" : "border-rule-strong",
							)}
						>
							<div
								className={cn(
									"flex flex-1 flex-col justify-center gap-4 border px-4 py-6 lg:gap-5 lg:px-7",
									isDragOver
										? "border-solid border-ink bg-tint"
										: "border-dashed border-rule-strong",
								)}
							>
								<div>
									<p
										id={dropZoneId}
										className="font-serif text-[1.375rem] leading-tight text-ink"
									>
										{isDragOver ? "Release to open it" : "Drop a PDF here"}
									</p>
									<p className="mt-2 text-tiny leading-relaxed text-ink-2">
										The file is stored in this browser. Nothing is uploaded.
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Button
										variant="primary"
										onClick={() => fileInputRef.current?.click()}
										disabled={isBusy}
										aria-describedby={dropZoneId}
									>
										Choose a PDF
									</Button>
									<Button onClick={addDemoDocument} disabled={isBusy}>
										Open the sample
									</Button>
								</div>
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

						{/* Both messages report on the file going in, so they belong to
						    this column rather than to the writing. */}
						<div
							aria-live="polite"
							className="w-full max-w-[21rem] empty:hidden"
						>
							{busyMessage && (
								<p className="flex items-center gap-2 text-tiny text-ink-2">
									<Loader2 className="size-3.5 animate-spin" />
									{busyMessage}
								</p>
							)}
							{problem && (
								<p className="flex items-start justify-between gap-3 rounded-control bg-danger-soft px-3 py-2 text-tiny leading-relaxed text-danger">
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
					</div>
				</div>

				<main className="border-t border-rule px-6 py-12 lg:border-t-0 lg:border-l lg:border-rule-strong lg:px-12 lg:py-16 xl:px-16">
					<div className="max-w-[36rem]">
						<h1 className="font-serif text-display font-normal tracking-[-0.012em] text-balance text-ink">
							Read a page. Write about that page.
						</h1>
						<p className="mt-6 font-serif text-lede text-ink-2">
							Every page of a PDF gets a note of its own, beside it and held to
							it as you scroll — quote from the page on the left, work it out on
							the right.
						</p>

						<section className="mt-14">
							<div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2.5">
								<h2 className="text-ui font-medium text-ink">Your documents</h2>
								{documents.length > 0 && (
									<span className="text-micro tabular-nums text-ink-2">
										{documents.length}
									</span>
								)}
							</div>

							{isLoading ? (
								<p className="flex items-center gap-2 py-10 text-tiny text-ink-2">
									<Loader2 className="size-3.5 animate-spin" />
									Opening the local library
								</p>
							) : documents.length === 0 ? (
								<p className="max-w-[42ch] py-10 font-serif text-lede text-ink-2">
									Nothing here yet. Add a PDF and it opens straight into the
									reader, with an empty note waiting beside page one.
								</p>
							) : (
								<ul className="divide-y divide-rule">
									{documents.map((doc) => {
										const pages = annotated[doc.id] ?? [];
										const isConfirming = pendingDelete === doc.id;

										return (
											<li key={doc.id} className="group flex items-start gap-3">
												<button
													type="button"
													onClick={() => onSelectDocument(doc.id)}
													className="flex min-w-0 flex-1 items-start gap-4 py-3.5 text-left"
												>
													<span className="flex h-[3.9rem] w-11 shrink-0 items-center justify-center overflow-hidden rounded-sheet border border-rule-strong bg-sheet">
														{doc.thumbnailDataUrl ? (
															<img
																src={doc.thumbnailDataUrl}
																alt=""
																className="size-full object-cover object-top"
															/>
														) : (
															<FileText className="size-4 text-on-sheet-2" />
														)}
													</span>

													<span className="min-w-0 flex-1">
														<span className="block truncate font-serif text-lede leading-snug text-ink group-hover:underline group-hover:underline-offset-2">
															{titleOf(doc.name)}
														</span>
														<span className="mt-1 flex flex-wrap items-center gap-x-3 text-micro text-ink-2">
															<span className="tabular-nums">
																{doc.pageCount}{" "}
																{doc.pageCount === 1 ? "page" : "pages"}
															</span>
															<span className="tabular-nums">
																{formatSize(doc.size)}
															</span>
															<span>Opened {formatDate(doc.updatedAt)}</span>
														</span>
														<span className="mt-2 block">
															<PageRibbon
																pageCount={doc.pageCount}
																annotatedPages={pages}
															/>
															<span className="mt-1 block text-micro tabular-nums text-ink-2">
																{pages.length > 0
																	? `Notes on ${pages.length} of ${doc.pageCount} pages`
																	: "No notes yet"}
															</span>
														</span>
													</span>
												</button>

												{isConfirming ? (
													<span className="flex shrink-0 items-center gap-1.5 py-3.5 text-micro text-ink-2">
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
													<span className="flex shrink-0 items-center gap-0.5 py-3.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
														<Button
															size="icon"
															variant="ghost"
															onClick={() => exportNotes(doc)}
															title="Download the notes as markdown"
															aria-label={`Download the notes for ${titleOf(doc.name)}`}
														>
															<Download className="size-3.5" />
														</Button>
														<Button
															size="icon"
															variant="danger"
															onClick={() => setPendingDelete(doc.id)}
															title="Delete this document"
															aria-label={`Delete ${titleOf(doc.name)}`}
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
					</div>
				</main>
			</div>
		</div>
	);
}
