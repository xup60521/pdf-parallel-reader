import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

let pdfjsLibPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function pdfjsAssetUrl(version: string, asset: string) {
	return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/${asset}`;
}

export async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
	if (typeof window === "undefined") {
		throw new Error("PDF.js can only be loaded in a browser environment");
	}

	if (!pdfjsLibPromise) {
		pdfjsLibPromise = import("pdfjs-dist").then((pdfjs) => {
			// Keep the worker and auxiliary assets on the same PDF.js build. A
			// mismatched worker or missing fallback font data can produce a page that
			// loads successfully but paints only some glyphs.
			if (!pdfjs.GlobalWorkerOptions.workerSrc) {
				pdfjs.GlobalWorkerOptions.workerSrc = pdfjsAssetUrl(
					pdfjs.version,
					"build/pdf.worker.min.mjs",
				);
			}
			return pdfjs;
		});
	}

	return pdfjsLibPromise;
}

export async function loadPdfDocument(data: ArrayBuffer) {
	const pdfjs = await getPdfjs();
	// Create a copy of the ArrayBuffer to prevent detached buffer issues
	const copy = data.slice(0);
	const loadingTask = pdfjs.getDocument({
		data: copy,
		cMapUrl: pdfjsAssetUrl(pdfjs.version, "cmaps/"),
		cMapPacked: true,
		standardFontDataUrl: pdfjsAssetUrl(pdfjs.version, "standard_fonts/"),
		wasmUrl: pdfjsAssetUrl(pdfjs.version, "wasm/"),
		iccUrl: pdfjsAssetUrl(pdfjs.version, "iccs/"),
	});
	return loadingTask.promise;
}

export async function generateThumbnail(
	data: ArrayBuffer,
): Promise<string | undefined> {
	if (typeof window === "undefined") return undefined;
	try {
		const pdfDoc = await loadPdfDocument(data);
		const page = await pdfDoc.getPage(1);
		// Scale for thumbnail (around 220px width)
		const originalViewport = page.getViewport({ scale: 1 });
		const targetWidth = 220;
		const scale = targetWidth / originalViewport.width;
		const viewport = page.getViewport({ scale });

		const canvas = document.createElement("canvas");
		canvas.width = Math.floor(viewport.width);
		canvas.height = Math.floor(viewport.height);
		const ctx = canvas.getContext("2d");
		if (!ctx) return undefined;

		await page.render({
			canvas,
			canvasContext: ctx,
			viewport,
		}).promise;

		return canvas.toDataURL("image/jpeg", 0.85);
	} catch (err) {
		console.error("Failed to generate thumbnail:", err);
		return undefined;
	}
}

export async function createSamplePdf(): Promise<{
	name: string;
	fileData: ArrayBuffer;
	pageCount: number;
}> {
	const pdfDoc = await PDFDocument.create();
	const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const helveticaOblique = await pdfDoc.embedFont(
		StandardFonts.HelveticaOblique,
	);
	const courier = await pdfDoc.embedFont(StandardFonts.Courier);

	// Color palette for PDF pages
	const primaryColor = rgb(0.09, 0.23, 0.25);
	const secondaryColor = rgb(0.26, 0.38, 0.4);
	const accentColor = rgb(0.2, 0.56, 0.59);
	const lightGray = rgb(0.92, 0.94, 0.93);
	const textDark = rgb(0.12, 0.15, 0.16);

	// Page 1: Title & Overview
	{
		const page = pdfDoc.addPage([595, 842]);
		// Header decorative bar
		page.drawRectangle({
			x: 48,
			y: 770,
			width: 500,
			height: 4,
			color: accentColor,
		});

		page.drawText("PARALLEL COMPUTING & DISTRIBUTED SYSTEMS", {
			x: 50,
			y: 745,
			size: 10,
			font: helveticaBold,
			color: accentColor,
		});

		page.drawText("Architecture of Modern Consensus Protocols", {
			x: 50,
			y: 715,
			size: 20,
			font: helveticaBold,
			color: primaryColor,
		});

		page.drawText(
			"An In-Depth Comparative Study of Raft, Paxos, and Byzantine Fault Tolerance",
			{
				x: 50,
				y: 692,
				size: 12,
				font: helveticaOblique,
				color: secondaryColor,
			},
		);

		// Section 1: Abstract
		page.drawText("1. Abstract & System Model", {
			x: 50,
			y: 645,
			size: 14,
			font: helveticaBold,
			color: primaryColor,
		});

		const abstractLines = [
			"Modern cloud infrastructures demand highly available and strictly consistent storage systems.",
			"Distributed consensus protocols provide the foundation for replicated state machines, allowing",
			"a cluster of nodes to agree on values despite network partitions, message loss, and node crashes.",
			"This document reviews the evolution of consensus algorithms over three decades.",
			"",
			"We examine how leadership election, log replication, and commitment safety interact to guarantee",
			"linearizability. Special emphasis is given to real-world edge cases including split-vote scenarios,",
			"network flapping, and dynamic membership reconfiguration.",
		];

		let y = 620;
		for (const line of abstractLines) {
			if (line) {
				page.drawText(line, {
					x: 50,
					y,
					size: 10,
					font: helvetica,
					color: textDark,
				});
			}
			y -= 18;
		}

		// Callout box
		page.drawRectangle({
			x: 50,
			y: 400,
			width: 495,
			height: 64,
			color: lightGray,
		});
		page.drawText("Key Takeaway:", {
			x: 65,
			y: 442,
			size: 10,
			font: helveticaBold,
			color: primaryColor,
		});
		page.drawText(
			"Consensus is formally impossible in an asynchronous system with even a single unannounced crash",
			{
				x: 65,
				y: 426,
				size: 9.5,
				font: helvetica,
				color: textDark,
			},
		);
		page.drawText(
			"(the famous FLP Impossibility Result, Fischer-Lynch-Paterson, 1985).",
			{
				x: 65,
				y: 412,
				size: 9.5,
				font: helveticaOblique,
				color: textDark,
			},
		);

		// Footer
		page.drawText("Page 1 of 3 | Section 1: Foundations", {
			x: 50,
			y: 40,
			size: 9,
			font: helvetica,
			color: secondaryColor,
		});
	}

	// Page 2: Raft Algorithm Details
	{
		const page = pdfDoc.addPage([595, 842]);

		page.drawText("2. The Raft Consensus Algorithm", {
			x: 50,
			y: 780,
			size: 16,
			font: helveticaBold,
			color: primaryColor,
		});

		const p2Intro = [
			"Raft divides the consensus problem into three relatively independent subproblems:",
			"  (1) Leader election: A new leader must be chosen when an existing leader fails.",
			"  (2) Log replication: The leader accepts log entries and forces followers to agree.",
			"  (3) Safety: If any server has applied a particular log entry, no other server will ever",
			"      apply a different entry for that index.",
		];

		let y = 745;
		for (const line of p2Intro) {
			page.drawText(line, {
				x: 50,
				y,
				size: 10,
				font: helvetica,
				color: textDark,
			});
			y -= 18;
		}

		y -= 15;
		page.drawText("2.1 State Representation & RPC Protocol", {
			x: 50,
			y,
			size: 13,
			font: helveticaBold,
			color: primaryColor,
		});
		y -= 25;

		page.drawRectangle({
			x: 50,
			y: y - 100,
			width: 495,
			height: 105,
			color: rgb(0.95, 0.96, 0.98),
		});

		const codeSnippet = [
			"type Term = uint64;",
			"type NodeId = string;",
			"interface RequestVoteArgs {",
			"  term: Term;",
			"  candidateId: NodeId;",
			"  lastLogIndex: uint64;",
			"  lastLogTerm: Term;",
			"}",
		];

		let codeY = y - 16;
		for (const line of codeSnippet) {
			page.drawText(line, {
				x: 65,
				y: codeY,
				size: 9,
				font: courier,
				color: rgb(0.15, 0.25, 0.35),
			});
			codeY -= 12;
		}

		y -= 130;
		page.drawText("2.2 Leader Election & Randomized Timeouts", {
			x: 50,
			y,
			size: 13,
			font: helveticaBold,
			color: primaryColor,
		});
		y -= 22;

		const p2Body = [
			"Raft uses randomized election timeouts (typically 150-300ms) to ensure split votes",
			"are rare and resolved quickly. Each candidate restarts its randomized election timer",
			"at the start of an election, and waits for that timeout to elapse before starting the",
			"next election; this reduces the likelihood of another split vote in the next term.",
		];
		for (const line of p2Body) {
			page.drawText(line, {
				x: 50,
				y,
				size: 10,
				font: helvetica,
				color: textDark,
			});
			y -= 18;
		}

		// Footer
		page.drawText("Page 2 of 3 | Section 2: Raft Protocol", {
			x: 50,
			y: 40,
			size: 9,
			font: helvetica,
			color: secondaryColor,
		});
	}

	// Page 3: Comparison & Practical Implementations
	{
		const page = pdfDoc.addPage([595, 842]);

		page.drawText("3. Performance Matrix & Production Considerations", {
			x: 50,
			y: 780,
			size: 16,
			font: helveticaBold,
			color: primaryColor,
		});

		const p3Intro = [
			"Selecting an appropriate consensus engine requires balancing latency, throughput,",
			"and complexity. Below is an overview of production deployments:",
		];
		let y = 745;
		for (const line of p3Intro) {
			page.drawText(line, {
				x: 50,
				y,
				size: 10,
				font: helvetica,
				color: textDark,
			});
			y -= 18;
		}

		y -= 15;
		// Table Header
		page.drawRectangle({
			x: 50,
			y: y - 24,
			width: 495,
			height: 24,
			color: rgb(0.85, 0.91, 0.91),
		});
		page.drawText("Algorithm", {
			x: 60,
			y: y - 16,
			size: 10,
			font: helveticaBold,
			color: primaryColor,
		});
		page.drawText("Fault Model", {
			x: 160,
			y: y - 16,
			size: 10,
			font: helveticaBold,
			color: primaryColor,
		});
		page.drawText("Quorum Size", {
			x: 280,
			y: y - 16,
			size: 10,
			font: helveticaBold,
			color: primaryColor,
		});
		page.drawText("Notable Users", {
			x: 390,
			y: y - 16,
			size: 10,
			font: helveticaBold,
			color: primaryColor,
		});
		y -= 24;

		const tableRows = [
			[
				"Raft",
				"Crash-Stop (CFT)",
				"2F + 1 (F faults)",
				"etcd, Kubernetes, TiKV",
			],
			[
				"Multi-Paxos",
				"Crash-Stop (CFT)",
				"2F + 1 (F faults)",
				"Google Chubby, Spanner",
			],
			[
				"PBFT",
				"Byzantine (BFT)",
				"3F + 1 (F faults)",
				"Hyperledger Fabric, Tendermint",
			],
			[
				"EPaxos",
				"Crash-Stop (Leaderless)",
				"2F + 1 / Fast Quorum",
				"Academic research systems",
			],
		];

		for (let r = 0; r < tableRows.length; r++) {
			const row = tableRows[r];
			const rowBg = r % 2 === 0 ? rgb(0.97, 0.98, 0.98) : rgb(1, 1, 1);
			page.drawRectangle({
				x: 50,
				y: y - 24,
				width: 495,
				height: 24,
				color: rowBg,
			});
			page.drawText(row[0], {
				x: 60,
				y: y - 16,
				size: 9,
				font: helveticaBold,
				color: textDark,
			});
			page.drawText(row[1], {
				x: 160,
				y: y - 16,
				size: 9,
				font: helvetica,
				color: textDark,
			});
			page.drawText(row[2], {
				x: 280,
				y: y - 16,
				size: 9,
				font: helvetica,
				color: textDark,
			});
			page.drawText(row[3], {
				x: 390,
				y: y - 16,
				size: 9,
				font: helvetica,
				color: textDark,
			});
			y -= 24;
		}

		y -= 30;
		page.drawText("3.1 Summary", {
			x: 50,
			y,
			size: 13,
			font: helveticaBold,
			color: primaryColor,
		});
		y -= 22;

		const summaryLines = [
			"In conclusion, consensus protocols are not one-size-fits-all. While Raft has won the",
			"battle for understandability in CFT systems, specialized architectures like EPaxos",
			"provide lower latency for geo-distributed deployments. When untrusted actors exist,",
			"BFT protocols provide necessary resilience at the cost of message complexity.",
		];
		for (const line of summaryLines) {
			page.drawText(line, {
				x: 50,
				y,
				size: 10,
				font: helvetica,
				color: textDark,
			});
			y -= 18;
		}

		// Footer
		page.drawText("Page 3 of 3 | Section 3: Synthesis & Benchmarks", {
			x: 50,
			y: 40,
			size: 9,
			font: helvetica,
			color: secondaryColor,
		});
	}

	const pdfBytes = await pdfDoc.save();
	// Cast to ArrayBuffer for type compatibility
	const arrayBuffer = pdfBytes.buffer.slice(
		pdfBytes.byteOffset,
		pdfBytes.byteOffset + pdfBytes.byteLength,
	) as ArrayBuffer;

	return {
		name: "Distributed_Consensus_Architecture.pdf",
		fileData: arrayBuffer,
		pageCount: 3,
	};
}
