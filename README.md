# Parallel PDF Reader

A local-first web application for synchronized PDF reading and page-coupled Markdown note-taking.

![Parallel PDF Reader](https://raw.githubusercontent.com/xup60521/pdf-parallel-reader/main/preview.png)

## Features

- **Synchronized Parallel Layout**: Left panel renders the PDF page, right panel provides a page-coupled Markdown editor.
- **Adaptive Note Height**: When Markdown notes outpace the height of a PDF page, the page stays pinned sticky at the top while the note expands smoothly, with subsequent pages aligned directly beneath.
- **Local-First & Offline**: PDFs and Markdown notes are stored locally in the browser with [Dexie.js](https://dexie.js.org/) (IndexedDB). No cloud upload required.
- **Rich Markdown Editor**: TipTap-based visual editor with floating bubble menu, syntax blocks, headings, lists, raw Markdown toggle, and Markdown paste conversion.
- **Navigation & Controls**: Quick jump-to-page bar, PDF zoom controls, and adjustable split ratios (`50:50`, `PDF+`, `Notes+`).
- **Exporting**: 1-click Markdown export of all notes for any document or quick copy to clipboard.
- **Document Library**: Overview dashboard with drag-and-drop PDF upload and automated thumbnail generation.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) & [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Lucide React icons
- **Editor**: [TipTap](https://tiptap.dev/) (`@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`) + Markdown serializer (`turndown`)
- **PDF Rendering & Generation**: [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) & [pdf-lib](https://pdf-lib.js.org/)
- **Database**: [Dexie.js](https://dexie.js.org/) (IndexedDB)
- **Tooling**: [Vite](https://vitejs.dev/) & [Biome](https://biomejs.dev/)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
bun run build
```

### Lint & Formatting

```bash
bun run check
bun run format
```

## License

MIT
