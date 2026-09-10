* _2026-09-10 23:01:12 (claude-opus-4-6/high)_

Reviewed implementation commit: 561a8aa5e9fc2b7104bec279fd51b5c20004e1e8

## Analysis

The ask: PDFs render fine in Firefox and Chrome but break in this web app — text is missing and not selectable.

### Root cause addressed by this commit

The primary fix is adding `standardFontDataUrl` to the `pdfjs.getDocument()` options (`pdf-service.ts:40`). When a PDF references a standard PostScript font (Helvetica, Times-Roman, Courier, etc.) without embedding the full font program, PDF.js needs fallback font metrics from its `standard_fonts/` directory. Without this URL, PDF.js cannot resolve the glyph widths and outlines, producing pages that load successfully but paint only some — or no — glyphs. Firefox and Chrome's native PDF viewers have their own font fallback; this web app's PDF.js instance did not.

### Change-by-change review

**`pdf-service.ts` — asset URL consolidation and new document options**

1. `pdfjsAssetUrl()` helper (lines 5–7): Correct. Centralizes version-pinned CDN URLs, ensuring all auxiliary assets come from the same pdfjs-dist build. Eliminates the previous mismatch risk of using cdnjs.cloudflare.com for the worker while potentially getting a different version.

2. Worker URL (lines 20–23): Changed from `cdnjs.cloudflare.com/ajax/libs/pdf.js/{v}/pdf.worker.min.mjs` to `cdn.jsdelivr.net/npm/pdfjs-dist@{v}/build/pdf.worker.min.mjs`. The `build/` prefix is correct for the npm package layout of pdfjs-dist v6. The `pdfjs.version` variable pins the exact installed version.

3. `standardFontDataUrl` (line 40): The key fix. Points to `standard_fonts/` in the pdfjs-dist npm package on jsdelivr. Enables PDF.js to load Type1 standard font fallback data.

4. `wasmUrl` (line 41): Points to `wasm/` — allows PDF.js v6 to load its optional WebAssembly module for accelerated rendering operations.

5. `iccUrl` (line 42): Points to `iccs/` — ICC color profile data for accurate color space handling.

6. All five asset types now use the same version-pinned helper, so there is zero version mismatch risk.

**`PdfPageView.tsx` — canvas rendering and TextLayer lifecycle**

1. Canvas render change (lines 68–72): Previously called `canvas.getContext("2d", { alpha: false })`, then `context.setTransform(ratio, 0, 0, ratio, 0, 0)`, then passed both `canvas` and `canvasContext` to `page.render()`. Now passes only `canvas` with the `transform` parameter. This lets PDF.js create the 2D context internally with its own optimal settings. The `transform` parameter is `undefined` when `ratio === 1` (no scaling needed) and an affine matrix `[ratio, 0, 0, ratio, 0, 0]` otherwise. This is the recommended pattern for pdfjs-dist v6 and correctly handles high-DPI displays.

2. `textLayerTaskRef` (line 28, 44–45, 92–93, 117–118): Stores a reference to the in-progress `TextLayer` instance so it can be cancelled on cleanup or re-render. Previously, an unmount during `TextLayer.render()` could produce a stale DOM mutation. The cleanup function at lines 113–119 now cancels both the render task and the text layer task.

3. Error handling (lines 97–105): Added three guards: (a) the `cancelled` flag itself, (b) `RenderingCancelledException` (already present), and (c) `AbortException` (new — thrown by the TextLayer when cancelled). These prevent spurious `setFailed(true)` calls and console errors during normal component lifecycle.

### Correctness verification

- TypeScript compilation passes (`bunx tsc --noEmit` — coordinator evidence).
- Full Vite production build passes (`bun run build` — coordinator evidence).
- Biome lint passes on both changed files (`bunx biome check` — coordinator evidence).
- `git diff --check` reports no whitespace errors.
- The only `getDocument()` call site is in `loadPdfDocument()`, so all document loads — including `generateThumbnail()` — benefit from the new font/asset URLs.
- `generateThumbnail()` (lines 63–70, not touched by this commit) still uses the older `canvasContext` pattern; this is out of scope and not harmful — it produces a low-resolution JPEG thumbnail where the DPR transform is irrelevant.

### Concepts introduced and owner outcomes

| Concept | Owner outcome |
|---|---|
| `pdfjsAssetUrl` helper | Eliminates version-mismatch risk across worker, cmaps, fonts, wasm, ICC |
| `standardFontDataUrl` | Direct fix for missing text rendering — the root cause |
| `wasmUrl`, `iccUrl` | Supplementary: enables wasm acceleration and accurate ICC color profiles |
| `transform` parameter on `page.render()` | Replaces manual `setTransform` with PDF.js-managed DPR scaling |
| `textLayerTaskRef` + cancellation | Prevents stale DOM mutations and spurious error states on re-render |
| `AbortException` guard | Prevents console noise from cancelled TextLayer operations |

Outcome: PASS
Minimality: PASS
Conformance: PASS
Verdict: PASS

Self-check: reviewed exactly commit `561a8aa5e9fc2b7104bec279fd51b5c20004e1e8`; inspected both changed files and their affected PDF.js boundaries; verified the independent dispatch metadata; no source, test, configuration, or notebook files were modified by the reviewer; report ends here.
