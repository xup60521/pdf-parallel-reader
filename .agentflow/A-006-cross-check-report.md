* _2026-09-11 00:41:08 (claude-opus-4-6/high)_

## Targeted Cross-Check: `e63f548` — add gutter to fitted PDF pages

Reviewed implementation commit: e63f548c12a3b65713c6f23ac3df9bbf69ee4d73

### Ask

> default 100% width should still leave small padding around pdf page

### Diff summary

One file changed (`src/components/reader/ParallelReaderView.tsx`), 5 insertions, 6 deletions. The constant `PDF_PADDING` moves from `0` to `16`; two comment blocks are updated to match.

### Behavior analysis

`PDF_PADDING` is consumed at exactly two sites:

1. **Line 268** — `paddingInline: PDF_PADDING` on the `data-pdf-panel` container in side-by-side layout. With the new value, 16 CSS px of horizontal padding appear on each side of the page column.

2. **Line 409** — `renderWidth = Math.max((baseWidth - PDF_PADDING * 2) * zoom, 160)`. At fit/100% zoom (`fitBase === null`, `zoom === 1`), this yields `pdfCellWidth - 32`. The page therefore fills the column minus the two 16 px gutters exactly: `16 + (pdfCellWidth - 32) + 16 = pdfCellWidth`. No sub-pixel sliver, no overflow.

At explicit zooms (`fitBase` frozen), the page grows from its fitted size but the container still carries `paddingInline: 16`, so the inset persists as a stable edge around the page band — matching the updated comment.

**Stacked mode** (width < 760 px): the stacked template does not apply `paddingInline` on its container, but `renderWidth` still subtracts 32 px, so the page is narrower than the viewport and centred via `justify-center`. The visual result is consistent padding, just achieved by centering rather than explicit inline padding.

**Edge cases:**
- `Math.max(..., 160)` prevents the page from collapsing at very narrow splits.
- `overflowX` calculation at line 412 is unaffected — still triggers the shared horizontal scrollbar correctly when the page exceeds its cell.
- Minimum zoom (0.25) with a 400 px cell: `(400 - 32) * 0.25 = 92`, clamped to 160 — safe.

### Coordinator evidence (accepted)

- `bunx tsc --noEmit` — passed.
- `bun run build` — passed.
- `git diff --check` — passed.
- Biome reports pre-existing line-ending/formatting issues in the file, unrelated to this change.

### Verdicts

Outcome: PASS
The constant change and its two consumption sites produce exactly the asked-for behaviour: a 16 px gutter around the fitted PDF page at 100% width, preserved at explicit zooms.

Minimality: PASS
One value change, two comment updates. No reformatting, no new dependencies, no adjacent cleanup.

Conformance: PASS
The implementation matches the ask ("small padding around pdf page" at default 100% width) with no scope creep.

Verdict: PASS

Self-check: three verdicts issued, one reviewed commit cited, one aggregate verdict issued, all PASS; no content follows this line.
