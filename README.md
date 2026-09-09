# Parallel PDF Reader

A local-first web application for synchronized PDF reading and page-coupled Markdown note-taking.

![Parallel PDF Reader](https://raw.githubusercontent.com/xup60521/pdf-parallel-reader/main/preview.png)

## Features

- **Page and note, locked together.** Every PDF page has its own Markdown note beside it, joined by a
  ruled spine that carries the page number and marks the pages you have annotated.
- **The page always fits.** Pages render to the width of their column, so they never overflow the row
  or float undersized inside it. Zoom scales from that fit and overflows only inside the page column.
- **The page pins while the note grows.** When a note outruns its page, the page holds at the top of
  the viewport and the note scrolls past it, with the following pages aligned underneath.
- **Selectable page text.** A text layer sits over each rendered page, so a quotation can be selected
  from the paper and dropped straight into the note beside it.
- **Long documents stay cheap.** Only the rows near the viewport render a canvas or mount an editor;
  the rest hold their exact height, so scroll position never jumps.
- **Thumbnail rail.** Real page previews with a mark on every annotated page, rendered on demand.
- **Markdown editor without chrome.** A slash menu (`/`) for blocks and a selection bubble menu for
  marks, plus headings, lists, checklists, tables, code, links, highlights, and KaTeX math. Markdown
  pasted from anywhere keeps its structure, and a raw Markdown view is one click away.
- **Local-first.** PDFs and notes live in this browser via [Dexie.js](https://dexie.js.org/)
  (IndexedDB). Nothing is uploaded.
- **Light and dark.** One palette, resolved before first paint, remembered between visits.
- **Export.** Download or copy a whole document's notes as one Markdown file.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) & [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Lucide React icons
- **Editor**: [TipTap](https://tiptap.dev/) with `@tiptap/suggestion` and `@floating-ui/dom` for the
  slash menu, KaTeX for math, and `markdown-it` / `turndown` for the Markdown round trip
- **PDF Rendering & Generation**: [PDF.js](https://mozilla.github.io/pdf.js/) & [pdf-lib](https://pdf-lib.js.org/)
- **Database**: [Dexie.js](https://dexie.js.org/) (IndexedDB)
- **Tooling**: [Vite](https://vitejs.dev/) & [Biome](https://biomejs.dev/)

## Keyboard

| Keys | Action |
| --- | --- |
| `/` | Open the block menu in a note |
| `Alt` + `↑` / `↓` | Move to the previous or next page |
| `Ctrl`/`Cmd` + `B`, `I` | Bold, italic |

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
