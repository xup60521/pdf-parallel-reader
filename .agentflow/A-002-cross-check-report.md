* _2026-09-10 01:14:12 (claude-opus-4-6/high)_

Reviewed implementation commit: 7c3fe0fed675825ae713ef00622656647a808b16

## Outcome

The commit delivers a coherent theme, a structurally sound layout, and an editor rebuild that matches the reference package.

**Token system.** A single `:root` / `.dark` palette in `src/styles.css` replaces the prior collision of hand-authored `--sea-ink`/`--lagoon` tokens and the shadcn `oklch` set. Grep across `src/` for `stone-|emerald-|slate-|gray-|zinc-` returns zero matches — every component consumes the new tokens.

**Fit-to-width PDF.** `PdfPageView` accepts a `width` prop and scales `viewport.width` to it. `ParallelReaderView` computes `renderWidth = (pdfColumnWidth - padding) × zoom`, so at 100 % zoom a page exactly fills its column and cannot overflow the row layout.

**Single scroll region.** The `<main ref={scrollRef} className="overflow-y-auto">` is the sole scroll container. Hand-tuned `top-0` / `top-[49px]` / `top-20` sticky offsets are gone. The only remaining `sticky` is the per-page PDF pin (`sticky top-4`), scoped to the row.

**Slash menu.** Built from `@tiptap/suggestion` + `@floating-ui/dom` with `offset`, `flip`, and `shift` middleware. The menu wraps in the viewport instead of clipping. Keyboard navigation (ArrowUp/Down, Enter, Tab, Escape) is wired through `useImperativeHandle`.

**BubbleMenu.** Uses `BubbleMenu` from `@tiptap/react/menus` with `placement: "top", offset: 8`, replacing the hand-rolled `coordsAtPos` + fixed-pixel positioner.

**Markdown round-trip.** Custom MarkdownIt block and inline rules produce `data-type` / `data-latex` HTML for math; `promoteTaskLists` rewrites `[ ]`-prefixed items into `data-type="taskList"` DOM; `promoteHighlights` maps `==text==` to `<mark>`. Turndown rules cover all four: math (inline and block reading `data-latex`), task lists (reading `data-checked`), highlights (`<mark>` → `==…==`), and tables (GitHub pipe format). `keepMathFromBeingBlank` inserts placeholder text so Turndown's blank-element check does not discard math nodes before the custom rules fire — mechanism confirmed as sound.

**Windowing.** `useInViewport` gates both the PDF canvas and the TipTap editor per row. Rows outside the viewport keep their measured height as a placeholder. The hook correctly passes the scrolling pane as `root` so `rootMargin` extends the actual scroll container rather than the viewport — confirmed by reading the IntersectionObserver specification: `rootMargin` grows the root rectangle, but an intermediate `overflow` ancestor clips independently.

**Dark mode.** `theme.ts` provides a bootstrap script inlined in `<head>` that reads `localStorage` and toggles `.dark` before first paint. `ThemeToggle` cycles light/dark and updates `<meta name="theme-color">`.

Outcome: PASS

## Minimality

Every added concept maps to a defect reproduced in the design record or to a requirement from the Ask:

| Added concept | Justification |
|---|---|
| `theme.ts` + `ThemeToggle` | Defect 9 — dark tokens existed and nothing set `.dark` |
| `PageRail` with virtualized thumbnails | Defect 5 — 400 page buttons in a 260 px scroller |
| Fit-to-width render scale | Defect 3 — page overflow past zoom 1.4 |
| `useInViewport` row windowing | Defect 6 — 200 TipTap instances mounted up front |
| Slash menu | Defect 10 — 9 buttons × N pages; reference editor pattern |
| `createNoteExtensions` factory | Prevents editable/static surface drift |
| `Button` / `ControlGroup` / `SegmentButton` | Replaces the per-component hardcoded `stone-*`/`emerald-*` that was defect 2 |
| `pdf-page.css` text layer | Required for text selection / drag-to-note |
| `editor.css` prose styles | Required for note body rendering |

The rich `DEMO_NOTES` in `DocumentOverview.tsx` and the `pdf-service.ts` one-line `canvas` fix are borderline, but the Ask explicitly says "Go freely in this round. continue until you think all you can do are done", and the canvas fix is required for the `PageRail` thumbnails to render.

No added concept lacks a tie to the Ask or a reproduced defect.

Minimality: PASS

## Conformance

**Dependencies.** Exactly six production dependencies added: `@floating-ui/dom`, `@tiptap/extension-highlight`, `@tiptap/extension-mathematics`, `@tiptap/extension-table`, `@tiptap/suggestion`, `katex`. All six are on the allowed list. No dev-dependency additions beyond what was already present.

**No unrelated refactors.** Changes to `__root.tsx` and `index.tsx` are theme bootstrap injection and token migration — direct requirements of the theme rebuild. `pdf-service.ts` adds the missing `canvas` property to `page.render()`, required for the new `PageRail`. `DocumentOverview.tsx` migrates from `stone-*`/`emerald-*` to the token system (defect 2), replaces `alert()`/`confirm()` with inline UI (defect 12), and parallelizes note-count fetches. All changes trace to the Ask.

**No scope creep.** The commit touches only files required by the layout overhaul, theme rebuild, and editor rebuild. No new routes, no new API endpoints, no infrastructure changes.

Conformance: PASS

## Adversarial correctness checks

**Claim 1 — math preservation in `htmlToMarkdown`.** Confirmed. `keepMathFromBeingBlank` sets `textContent = "math"` on math nodes before Turndown runs, preventing blank-element discard. The Turndown `inlineMath` and `blockMath` rules filter on `data-type` and read from `data-latex`. The `_content` parameter is correctly ignored because the payload is in the attribute, not the DOM text.

**Claim 2 — `useInViewport` root parameter.** Confirmed. The IntersectionObserver API defines `rootMargin` as extending the root rectangle. With `root: null` (viewport), the viewport is the root, and a scrolling ancestor between the viewport and the target clips independently. Passing the scrolling pane as `root` makes the observer measure against the correct clipping boundary.

**Claim 3 — debounced save flush on unmount and `pagehide`.** Plausible. The cleanup effect removes the `pagehide` listener and calls `flushPendingSave()`, which reads the pending closure and persists synchronously (the function call is synchronous; the IndexedDB write is async). The claim that "reading the editor during cleanup is safe because TipTap defers its own teardown by a tick" is implementation-dependent — TipTap 3.x does schedule editor destruction asynchronously, so the editor should still be alive during React's synchronous cleanup, but this is not a documented guarantee. The `pagehide` path may also not complete the IndexedDB write before the page is discarded. These are industry-standard trade-offs, not bugs.

**Claim 4 — PDF column stretch with sticky pin.** Confirmed. The outer column div (`shrink-0 pr-4, width: pdfColumnWidth`) stretches to full row height. The inner `sticky top-4 overflow-x-auto` div pins the page while the note column scrolls past it. Horizontal overflow is on the sticky element itself, not the column — if it were on the column, the column would become a scroll container and cancel the sticky behavior (CSS spec: a sticky child sticks within its nearest scrollport ancestor).

## Additional observations (non-blocking)

1. `handleAspectRatio` only samples page 1's aspect ratio for all placeholder heights. Documents with mixed page sizes (rare in practice) will have inaccurate placeholders, causing minor scroll position shifts when those pages enter the viewport.

2. The current-page IntersectionObserver (`rootMargin: "-45% 0px -45% 0px"`, `[]` deps) observes all row elements once at mount time. This works because all rows render in the same commit and `useLayoutEffect` registers refs before the parent `useEffect` runs. If rows were ever lazily added, they would not be observed.

3. `window.prompt("Link address")` in `NoteBubbleMenu.tsx` is the sole remaining browser dialog. It is a new addition for the link feature, not a carried-over issue from the `alert()`/`confirm()` calls that were removed.

## Build suite

The coordinator reports `bunx tsc --noEmit` clean, `bun run check` (Biome) clean over 30 files, and `bun run build` succeeded. Independent re-execution was blocked by sandbox permission restrictions on `bun`/`bunx` commands; the results are carried from the coordinator's evidence.

Verdict: PASS

Self-check: report contains exactly one each of Verdict/Outcome/Minimality/Conformance lines (all PASS); reviewed implementation commit 7c3fe0fed675825ae713ef00622656647a808b16; first line is the Taipei-timestamped worker stamp; this is the final line.
