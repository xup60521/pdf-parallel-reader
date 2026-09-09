import Dexie, { type Table } from "dexie";

export interface PdfDocument {
	id: string;
	name: string;
	size: number;
	pageCount: number;
	thumbnailDataUrl?: string;
	fileData: ArrayBuffer;
	createdAt: number;
	updatedAt: number;
}

export interface PageNote {
	id: string;
	pdfId: string;
	pageNumber: number;
	contentMarkdown: string;
	contentJson?: string;
	updatedAt: number;
}

export class ParallelReaderDatabase extends Dexie {
	documents!: Table<PdfDocument, string>;
	notes!: Table<PageNote, string>;

	constructor() {
		super("ParallelPdfReaderDB");
		this.version(1).stores({
			documents: "id, name, createdAt, updatedAt",
			notes: "id, [pdfId+pageNumber], pdfId, pageNumber, updatedAt",
		});
	}
}

export const db = new ParallelReaderDatabase();

export async function getAllDocuments(): Promise<PdfDocument[]> {
	return db.documents.orderBy("updatedAt").reverse().toArray();
}

export async function getDocumentById(
	id: string,
): Promise<PdfDocument | undefined> {
	return db.documents.get(id);
}

export async function deleteDocument(id: string): Promise<void> {
	await db.transaction("rw", db.documents, db.notes, async () => {
		await db.documents.delete(id);
		await db.notes.where("pdfId").equals(id).delete();
	});
}

export async function renameDocument(
	id: string,
	newName: string,
): Promise<void> {
	await db.documents.update(id, {
		name: newName,
		updatedAt: Date.now(),
	});
}

export async function getNotesForPdf(pdfId: string): Promise<PageNote[]> {
	return db.notes.where("pdfId").equals(pdfId).toArray();
}

export async function getNoteForPage(
	pdfId: string,
	pageNumber: number,
): Promise<PageNote | undefined> {
	const id = `${pdfId}_p${pageNumber}`;
	return db.notes.get(id);
}

export async function saveNoteForPage(
	pdfId: string,
	pageNumber: number,
	contentMarkdown: string,
	contentJson?: string,
): Promise<void> {
	const id = `${pdfId}_p${pageNumber}`;
	await db.notes.put({
		id,
		pdfId,
		pageNumber,
		contentMarkdown,
		contentJson,
		updatedAt: Date.now(),
	});
	await db.documents.update(pdfId, {
		updatedAt: Date.now(),
	});
}

export async function exportDocumentNotesAsMarkdown(
	pdfId: string,
): Promise<string> {
	const doc = await db.documents.get(pdfId);
	if (!doc) throw new Error("Document not found");

	const notes = await db.notes.where("pdfId").equals(pdfId).toArray();
	const notesByPage = new Map<number, string>();
	for (const note of notes) {
		if (note.contentMarkdown.trim()) {
			notesByPage.set(note.pageNumber, note.contentMarkdown.trim());
		}
	}

	let output = `# Notes: ${doc.name}\n\n`;
	output += `> Document contains ${doc.pageCount} pages. Notes exported on ${new Date().toLocaleDateString()}.\n\n---\n\n`;

	let hasNotes = false;
	for (let p = 1; p <= doc.pageCount; p++) {
		const note = notesByPage.get(p);
		if (note) {
			hasNotes = true;
			output += `## Page ${p}\n\n${note}\n\n---\n\n`;
		}
	}

	if (!hasNotes) {
		output += `*(No notes have been recorded for this document yet.)*\n`;
	}

	return output;
}
