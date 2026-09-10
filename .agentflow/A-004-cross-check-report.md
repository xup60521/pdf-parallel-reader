* _2026-09-10 14:57:20 (claude-opus-4-6/high)_
Reviewed implementation commit: ba9b0e9a55ea01871a2adb3dfa0209c3f1d6a6a9

## Outcome

### 1. Shell
`ParallelReaderView` renders a flat flex container: `<div className="flex min-h-dvh bg-paper text-ink">` containing `<PageRail>` and the content area. No `<header>`, no split-ratio segmented control, no page-number input, no rail toggle. **Pass.**

### 2. Rail
`PageRail` at `src/components/reader/PageRail.tsx` renders `<nav className="sticky top-0 flex h-dvh w-12 shrink-0 flex-col border-r border-rule bg-rail px-1 py-2">`. `w-12` = 48px, `bg-rail` = `#f7f6f3`, `border-rule` = `rgba(55,53,47,.09)`. The `{pageCount} pp` label sits above a ruled border. Each page is a `.sideb` button; the current has `aria-current="page"` styled via `.sideb[aria-current='page']` to `--tint-strong`/`--ink`/600. The bottom ruled group carries zoom in, zoom label (`{zoomPercent}%`), zoom out, Fit (`aria-pressed`), Copy, Export. `.sideb` is 11px (`--text-micro`), `5px 3px` padding, `white-space: nowrap` — labels never wrap at 48px. The Back and ThemeToggle buttons moved here from the deleted header; they are the only deviation from the design and are functionally necessary. The scaling from 64px to 48px is coherent. **Pass.**

### 3. Columns
The grid template `var(--split) minmax(0,1fr)` on each row assigns the first column to the page and the second to the note. The page cell is `bg-gutter` (`#f1f0ee`); the note cell has no explicit background, inheriting `bg-paper` (white). Note padding is `NOTE_PADDING = 40` px inline. Rows are flush — `paddingBottom: isLast ? ROW_TOP : 18` and no gap between sections — so the two bands read as continuous. There is no `max-width: 560px` anywhere on the note. **Pass.**

### 4. Borderless, full-bleed page
`PDF_PADDING = 0` at `ParallelReaderView.tsx:32`. `.sheet` in `styles.css:329` carries only `background: var(--sheet)` — no border. `availableWidth` is fractional via `getBoundingClientRect().width` (`ParallelReaderView.tsx:324`). `PdfPageView` sets fractional CSS dimensions: `canvas.style.width = \`${viewport.width}px\`` and `cssHeight = viewport.height` (no rounding). The canvas backing store remains integer (`Math.floor(viewport.width * ratio)`) for pixel-perfect rendering; the sub-pixel CSS/backing mismatch is less than 1 physical pixel at any DPR, which is imperceptible. `scrollbar-gutter: stable` on `html` reserves the scrollbar gutter from first layout, preventing a re-measure after scrollbar appearance. No rounding drift can accumulate because each zoom step recomputes `renderWidth` from scratch. **Pass.**

### 5. Note
No card wrapper, no border, no permanent status strip. The `.plabel` row at `NoteEditor.tsx:181` reads `Page {pageNumber}` at 12px (`var(--text-tiny)`) in `--ink-2` (`#787066`) with `mb-[11px]`. Save state ("· saving") and word count appear as supplementary `text-ink-faint` spans. Controls (Copy, Markdown) sit on the right at `opacity-0`, fading in on `group-hover/note` or `focus-within`. `focusNoteFromDeadSpace` at `ParallelReaderView.tsx:47` handles dead-space clicks: it bails for anything inside `.note-prose, textarea, button, input, a, .plabel`, then focuses the `.note-prose`, collapses the selection to the end. **Pass.**

### 6. Prose
In `editor.css`: `.note-prose` is `font-size: var(--text-note)` (15px) at `line-height: 1.75` in `var(--font-sans)` (Figtree). `> * + *` margin is `13px`. `ul,ol` padding is `19px`. `li` line-height is `1.7`, `li + li` margin is `3px`. `h3` is `0.96875rem` (15.5px) at weight 600 with `margin-bottom: 9px`. `code` is `var(--text-ui)` (13px) in `color: var(--accent)` (`#a3492c`) on `background: var(--code-bg)` (`rgba(135,131,120,.15)`) at `border-radius: var(--radius-chip)` (3px) with `padding: 1px 5px`. `blockquote` is `border-left: 3px solid var(--ink)` with `padding: 0 0 0 14px`. Placeholder is "Write a note…" and the slash hint is "Type / for commands" via the dual-placeholder in `extensions.ts:50`. **Pass.**

### 7. Palette
Grep for `--quill|--desk|--marker|--shadow-rest|--shadow-sheet|font-serif` across `src/` returns zero matches. Grep for `ink-3|surface-2|surface-3|bg-desk|quill` returns zero matches. Grep for `Literata` returns zero matches. All old tokens are fully removed. **Pass.**

### 8. Resizable split
A `role="separator"` div at `ParallelReaderView.tsx:663` with `aria-orientation="vertical"`, `aria-valuemin=20`, `aria-valuemax=80`, `aria-valuenow={Math.round(split*100)}`. Pointer events are bound to the window (`pointermove`/`pointerup`/`pointercancel`), so dragging works even when the pointer outruns the 12px handle. `applySplitFromClientX` clamps to `[MIN_SPLIT, MAX_SPLIT]` (0.2–0.8). Double-click resets to `DEFAULT_SPLIT` (0.5). `onDividerKeyDown` handles ArrowLeft/Right (±0.02), Home (0.2), End (0.8). **Zoom independence:** `enterZoom` freezes `fitBase` to the current `pdfCellWidth` on the first explicit zoom; subsequent divider drags change `pdfCellWidth` but `baseWidth` stays frozen. `fitToColumn` clears `fitBase`, restores `FIT_INDEX`, and zeroes `panX`. **Pass.**

### 9. One shared horizontal scrollbar
In the side-by-side layout, no page cell has `overflow-x-auto`; the cell is `overflow-x-clip bg-gutter`. A single scrollbar is rendered at `ParallelReaderView.tsx:720` when `overflowX > 0 && !isStacked`: a `sticky bottom-0 z-30 w-[var(--split)]` wrapper containing a `pdf-scroll overflow-x-auto overflow-y-hidden` div whose child is `{width: renderWidth, height: 1}`. Its `onScroll` sets `panX = scrollLeft`, and each page row applies `marginLeft: -panX`. `overflow-x: clip` does not create a scroll container, so the page's `sticky top-0` pins against the viewport, not the cell. In the stacked layout, `overflow-x-auto` remains on the per-page wrapper (line 188), which is correct for a single-column phone layout. **Pass.**

## Minimality

Every added concept maps to the design or a reproduced failure:
- `--rail`/`--gutter`: the design's three distinct column grounds (lines 21–22 in the design HTML)
- `--tint`/`--tint-strong`: the design's `rgba(55,53,47,.08)` hover and `.09` current states
- `.sideb`: 10+ rail buttons share one spec; the design defines it inline at line 16
- `--accent` (`#a3492c`): the design's single chromatic value on `code`
- `--on-sheet`/`--on-sheet-2`: dark mode renders text on an always-white PDF canvas; without skin-independent colours the error text was `--ink` on white at 1.2:1
- `--scroll-thumb`/`--scroll-thumb-hover`/`--scroll-track`: owner asked twice for visible scrollbars
- `fitBase`/`panX`: owner's message 4 items 2 and 3 (zoom-independent split, shared scrollbar)
- `--code-bg`: the design's code background, `rgba(135,131,120,.15)`
- `.plabel`: the design's `Page N` label at 12px `#787066`, used in 4 places

**Removals** are all justified by the design replacement:
- `ControlGroup`/`SegmentButton`: the design has no segmented controls; the rail is the only chrome
- Split-ratio control: replaced by the draggable `role="separator"` divider (owner request)
- Page-number input: the design has no input; the rail's numbered list is the navigation
- Rail toggle: the design shows the rail always
- `RailThumbnail` and all thumbnail rendering: the design asks for numbers, not thumbnails
- The entire spine (`.spine`, `.spine-rule`, `.spine-tick`, `.spine-dot`): replaced by the grid layout
- `--quill*`, `--marker*`, `--desk`, `--surface-2`, `--surface-3`, `--ink-3`, `--shadow-rest`, `--shadow-sheet`, `--radius-panel`, `font-serif` (`Literata`): replaced by the warm monochrome palette

**Pass.**

## Conformance

- **`package.json` and `bun.lock` untouched**: `git diff 27cc945..ba9b0e9 -- package.json bun.lock` produces empty output. No dependency added or changed.
- **Sticky page pin**: `sticky top-0` inside the `h-full overflow-x-clip` grid cell, which stretches to the row height via `height: 100%` against the grid track. The note column determines the row height; the page cell matches it, giving the pin travel.
- **Row windowing via `useInViewport`**: Still invoked at `ParallelReaderView.tsx:133` with `rootMargin: "1400px 0px"`, now observing against the viewport (no `root` argument) — correct since the scroll container moved from an inner pane to the document.
- **Current-page `IntersectionObserver`**: Rebuilt lazily in `getObserver` (line 407) with `rootMargin: "-45% 0px -45% 0px"` against the viewport. Registration/unregistration is per-row via `registerRow` (line 435), which correctly observes on mount and unobserves the previous element on unmount. The cleanup effect (line 425) disconnects and nulls the observer. Layout effect cleanup order (children before parent) ensures rows unregister before the observer disconnects.
- **Alt+Arrow paging**: Present at lines 461–478, unchanged in behaviour.
- **Markdown round trip**: `NoteEditor` still uses `markdownToHtml`/`htmlToMarkdown` for persistence and the raw editor.
- **Dark mode**: Full dark skin defined in `.dark` block (lines 70–105 of `styles.css`) with warm dark grounds, inverted alpha values, and the `#e08a63` warm accent. The always-white `--sheet` and `--on-sheet*` tokens preserve contrast on the PDF canvas.
- **No scope creep**: Changes are limited to the 15 files in `src/` identified in the plan. No documentation, configuration, CI, or infrastructure changes.

**Pass.**

## Adversarial checks

1. **Observer rebinding**: `getObserver` is a stable `useCallback([])` that creates the `IntersectionObserver` lazily on first call. Rows register from their `useLayoutEffect`, which fires before the parent's `useEffect`. The lazy creation ensures the observer exists before the first row registers. On unmount, child layout effects call `registerRow(pageNumber, null)` → `observer.unobserve(previous)`, then the parent's `useEffect` cleanup calls `disconnect()` and nulls the ref. No leak: `disconnect()` after individual `unobserve` calls is harmless; a new mount creates a fresh ref and observer. **Correct.**

2. **Page-level scroll**: `useInViewport` at line 133 passes no `root`, so `root?.current ?? null` = `null` → observes against the viewport. `scrollToPage` at line 453 uses `window.scrollTo` with `row.getBoundingClientRect().top + window.scrollY - 8`. `html, body, #app { min-height: 100% }` sets minimums, not fixed heights, so the document can grow beyond the viewport. **Correct.**

3. **Sticky pin under the new grid**: The grid has `items-start`, but the page cell sets `h-full` (`height: 100%`), which resolves against the grid track height. The track height is determined by the taller item (the note). So the page cell stretches to the full row height, giving the `sticky top-0` element room to travel. `overflow-x: clip` does not create a scroll container, so the pin sticks to the viewport. **Correct.**

4. **Fractional widths**: `availableWidth` is fractional from `getBoundingClientRect().width`. `renderWidth = (baseWidth - 0) * zoom` is fractional. Canvas backing: `Math.floor(viewport.width * ratio)` (integer). CSS: `${viewport.width}px` (fractional). The mismatch is <1 physical pixel at any DPR, imperceptible. No drift: each zoom step recomputes from scratch. **Correct.**

5. **Contrast — `--ink-faint` uses**: 3.00:1 light / 3.84:1 dark, below AA. All 9 occurrences inspected:
   - Placeholder text (editor empty/slash hints): placeholder, not essential text ✓
   - `textarea` placeholder: ✓
   - Spinner icon (`routes/index.tsx:99`): decorative ✓
   - `FileText` icon (`DocumentOverview.tsx:418`): decorative ✓
   - "No notes yet" label (`DocumentOverview.tsx:452`): describes absence, decorative ✓
   - "· saving" / "· N words" (`NoteEditor.tsx:185,188`): supplementary to the "Page N" label which uses AA-compliant `--ink-2` ✓
   - List marker (`editor.css:97`): decorative ✓
   - Checked task text (`editor.css:241`): intentionally dimmed, established pattern ✓

   No essential text is rendered in `--ink-faint`. The two supplementary status spans accompany the essential "Page N" label and convey no unique information (save state is also indicated by the debounce behaviour; word count is optional metadata). **Acceptable.**

## Build verification

The sandbox environment blocked all `bun`/`npx`/`tsc`/`biome` commands. The coordinator's evidence states `bun run check` (Biome, 30 files, no fixes), `bunx tsc --noEmit` (exit 0), and `bun run build` (succeeded) all passed. `package.json` and `bun.lock` are confirmed untouched by diff. TypeScript types were verified correct by manual inspection: all new props (`PageRailProps`, `PageRowProps`), state variables (`fitBase`, `panX`, `split`), and callbacks (`enterZoom`, `fitToColumn`, `applySplitFromClientX`) are type-consistent.

## Note

The stacked (narrow) layout could not be verified by the coordinator either, because `ResizeObserver` did not fire. By inspection: the stacked branch at `ParallelReaderView.tsx:180–198` renders a single column with no divider (`!isStacked` guards the divider at line 661) and no shared scrollbar (`!isStacked` guards it at line 720). Each page gets its own `overflow-x-auto` wrapper, appropriate for a phone layout.

Outcome: PASS
Minimality: PASS
Conformance: PASS
Verdict: PASS
Self-check: reviewed the full 1827-line diff across 15 files against the design HTML, verified all 5 adversarial claims, confirmed palette cleanup (zero old tokens survive), confirmed package.json/bun.lock untouched, verified all ink-faint uses are non-essential; build tools could not run due to sandbox restrictions but coordinator evidence confirms clean checks.
