# Tracker

## Identity

- **Work key:** A-004-design-refactor.

- **Active Ask:** A-004.

- **Goal:** Rebuild the reader UI to match `PDF Notes v3.dc.html` — the 64px control rail, the two column bands, the chrome-free note, and the warm monochrome token layer — while keeping the proven reader behavior.

- **Last update:** 2026-09-10 15:10:00 Asia/Taipei.

- **Evidence commit:** ba9b0e9a55ea01871a2adb3dfa0209c3f1d6a6a9.

## Overall state

- **State:** complete.

- **Reason:** Every accepted task is checked with its proof recorded.

- **Total:** 7.

- **Completed:** 7.

- **Remaining:** 0.

## Accepted task checklist

- [x] **T-1:** Replace the token layer in `src/styles.css` with the design's warm monochrome palette, radii, and type. Outcome: `--ink #37352f`, `--ink-2 #787066`, `--ink-3 #9b948a`, `--rail #f7f6f3`, `--gutter #f1f0ee`, `--paper/--surface #fff`, `--rule rgba(55,53,47,.09)`, `--rule-strong rgba(55,53,47,.12)`, `--tint rgba(55,53,47,.08)`, `--tint-strong rgba(55,53,47,.09)`, `--accent #a3492c`; radii 2/3/6px; Figtree as the only webfont; no `--shadow-rest`/`--shadow-sheet`; focus ring `2px solid var(--ink)` at `offset 1px`; a derived dark skin holding every text tier at AA. Scope: this file plus the `.sideb`/`.plabel` classes the design specifies; no component logic. Proof: the file defines every listed token exactly once, `bun run check` and `bunx tsc --noEmit` clean, and measured contrast for `--ink`, `--ink-2`, `--ink-3` on `--paper`, `--rail`, and `--gutter` in both skins is ≥ 4.5:1. Source: A-004.

- [x] **T-2:** Rewrite `src/components/reader/PageRail.tsx` as the design's 64px rail. Outcome: sticky full-height rail with `N pp` over a ruled header, a scrolling `.sideb` number list with the current page filled and `aria-current="page"`, a `flex:1` spacer, and a ruled bottom group of zoom in / zoom label / zoom out / Fit / Copy / Export, plus back-to-library and the theme toggle above the count. Scope: this file and its props; the thumbnail canvas rendering is removed. Proof: a live browser journey shows the rail at 64px, the current number tracking the scroll, a number click scrolling the reader, and every bottom control firing its handler. Source: A-004.

- [x] **T-3:** Rebuild `ParallelReaderView.tsx` to the three-column shell. Outcome: the header bar, split-ratio control, page-number input, and rail toggle are gone; the page column is a continuous `--gutter` band with 36px side padding and 18px between rows; the note column is `--paper` with 40px side padding and a 560px measure; rows stay flush so the bands are continuous; the sticky page pin, row windowing, current-page observer, and Alt+Arrow paging still work. Scope: this file only. Proof: `bunx tsc --noEmit` clean and a live journey confirming pin, windowing, and paging against the sample document. Source: A-004.

- [x] **T-4:** Strip the note chrome in `NoteEditor.tsx`. Outcome: no panel border, no rounded card, no permanent status strip; the `.plabel` row carries `Page N` on the left and the save state, word count, copy, and markdown toggle on the right, revealed on hover or focus. Scope: this file. Proof: a live journey showing a note saving, the state appearing on hover, and raw-markdown mode round-tripping. Source: A-004.

- [x] **T-5:** Retune `editor.css` and `pdf-page.css` to the design's prose spec. Outcome: note prose at Figtree 15px/1.75, `13px` bottom margins, `19px` list indent, one 15.5px/600 heading tier, `#a3492c` inline code on `rgba(135,131,120,.15)` at radius 3px, a `3px solid var(--ink)` quote rule, `Write a note…` placeholder, and the `Type / for commands` caret affordance. Scope: the two stylesheets. Proof: the rendered demo note matches the design's measurements in the live DOM. Source: A-004.

- [x] **T-6:** Carry the token change through `Button.tsx`, `ThemeToggle.tsx`, `PdfPageView.tsx`, `DocumentOverview.tsx`, `routes/index.tsx`, `__root.tsx`, and the editor menus. Outcome: no reference to a removed token (`--quill*`, `--desk`, `--marker*`, `--shadow-rest`, `--shadow-sheet`, `font-serif`) survives anywhere in `src/`, and the library screen reads as the same product as the reader. Scope: re-skinning only; no behavior change. Proof: `grep` over `src/` returns no removed-token reference, and `bun run check` plus `bunx tsc --noEmit` are clean. Source: A-004.

- [x] **T-7:** Verify and close. Outcome: `bun run check`, `bunx tsc --noEmit`, and `bun run build` all pass; a real browser journey covers the eight steps in the design record's "Normal journey"; the targeted cross-check returns PASS on Outcome, Minimality, and Conformance for the exact implementation commit. Scope: verification and records only. Proof: command output, journey observations, and the review report path recorded in the notebook. Source: A-004.

## Accepted scope changes

- The page is borderless and fills its column edge to edge, overriding the design's 1px border and 36px side padding. Source: A-004. Effect: `.sheet` carries no border and `PDF_PADDING` is 0; the sheet rect equals the page-cell rect at x=48, w=810.

- The note loses the design's `max-width:560px` and fills its column. Source: A-004. Effect: `.note-prose` spans the cell minus its 40px padding at every split tested, and the note track is `minmax(0,1fr)` so it can still shrink.

- The rail is 48px rather than the design's 64px, with 11px labels and `5px 3px` padding. Source: A-004. Effect: the rail rect measures 48px and no `.sideb` has `scrollWidth > clientWidth`.

- The panels are resizable through a `role="separator"` divider, and an explicit zoom freezes the column width it is measured against. Source: A-004. Effect: the sheet held 1316px while the cell moved 567 → 1215, and `Fit` restored tracking at 1215 == 1215.

- One horizontal scrollbar for the whole page column, stuck to the foot of the window, replaces the per-page scroller; a shadcn ScrollArea was rejected because the design's scroll is the document itself. Source: A-004. Effect: the bar spans 810px at x=48 with its bottom flush to the window, and `scrollLeft = 300` moved all three pages by exactly 300px.

- Two defects found while satisfying the above were repaired: the note track became `minmax(0,1fr)` and `html` gained `scrollbar-gutter: stable`. Source: A-004. Effect: document horizontal overflow is 0 at every split and zoom tested, and sheet width equals cell width on a cold load.

## Current recovery

- **Current item:** none — T-1 through T-7 are complete.

- **Last proven result:** full external cross-check PASS on Outcome, Minimality and Conformance for `ba9b0e9`, with `bun run check`, `bunx tsc --noEmit` and `bun run build` all clean.

- **Active blocker or running process:** None.

- **Next safe action:** None.

- **Expected changed files:** `src/styles.css`, `src/components/reader/PageRail.tsx`, `src/components/reader/ParallelReaderView.tsx`, `src/components/editor/NoteEditor.tsx`, `src/components/editor/editor.css`, `src/components/editor/NoteBubbleMenu.tsx`, `src/components/editor/slash/SlashCommandList.tsx`, `src/components/pdf/PdfPageView.tsx`, `src/components/pdf/pdf-page.css`, `src/components/ui/Button.tsx`, `src/components/ui/ThemeToggle.tsx`, `src/components/overview/DocumentOverview.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx`, `.agentflow/artifacts/A-004-design-refactor/*`, `.agentflow/devlog.md`.

## Completion proof

- **All accepted tasks checked:** yes.

- **Blocking accepted decision:** none.

- **Operation running:** no.

- **Next action remaining:** none.

- **Evidence status:** complete.

- **Judgment:** complete.

## Update meaning

- Saving this tracker is a recovery checkpoint, not a stop signal.

- Work continues with the next unfinished item unless an independent stop condition applies.
