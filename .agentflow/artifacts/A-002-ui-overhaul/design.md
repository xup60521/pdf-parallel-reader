# A-002 — UI overhaul: layout, theme, and markdown editor

## Original Ask

> The UI is TERRIBLE. Use your best effort to fix it, both the layout and the theme. You shall use
> frontend-design skill to ensure quality.
> Plus, Go check out `D:\code\side_project\contextboard\packages\editor` to have a general idea of
> what markdown editor should you build.
> Go freely in this round. continue until you think all you can do are done.

## Subject, audience, job

**Subject.** A reading desk. Someone has a paper, a textbook, or a spec open, and they are writing
notes about *this specific page* while they read it.

**Audience.** Researchers, graduate students, and engineers reading dense PDFs — people who already
have a note-taking habit and are choosing this over a notebook next to a laptop.

**Primary job.** Keep the page and the note about that page physically adjacent and scroll-locked,
so no attention is spent re-finding your place.

Every design decision below is judged against that job.

## Reproduced defects

Each of these was confirmed by exact file inspection, not inferred.

| # | Where | Defect |
|---|---|---|
| 1 | `src/styles.css` | Two token systems coexist: a hand-authored `--sea-ink`/`--lagoon` palette and the shadcn `oklch` set. `@layer base { body { background-color: var(--background) } }` wins over the authored gradient, so the intended theme never renders at all. |
| 2 | all components | Components hardcode `stone-*`/`emerald-*` and reference neither token system. Three visual languages collide on one screen, and no token change can fix the components. |
| 3 | `PdfPageView.tsx` | The page frame is sized from `viewport.width` at the raw zoom scale. There is no fit-to-width: at scale 1 an A4 page is 595px inside an ~820px column (under-fills), and past ~scale 1.4 it exceeds the column and breaks the row horizontally. |
| 4 | `ParallelReaderView.tsx` | Sticky offsets are hand-tuned constants (`top-0`, `top-[49px]`, `top-20`) measured against content-derived header heights. Any font or padding change desynchronises them. |
| 5 | `ParallelReaderView.tsx` | The "Jump to" navigator mounts one 24px button per page inside a 260px scroller. Unusable past ~15 pages, and a 400-page book mounts 400 buttons. |
| 6 | `ParallelReaderView.tsx` | Every page mounts a `PdfPageView` **and** a full TipTap instance up front. A 200-page PDF means 200 ProseMirror editors. |
| 7 | `MarkdownNoteEditor.tsx` | `onHeightChange` is declared, wired to a `ResizeObserver`, and never passed by the parent. Dead code paying an observer cost. |
| 8 | `EditorBubbleToolbar.tsx` | Positioned by `coordsAtPos` plus fixed `-120`/`-42` pixel offsets, with no flip or shift. It clips at container edges and mispositions on any selection near a boundary. |
| 9 | `styles.css` + app | `.dark` tokens are fully defined and nothing ever sets the class. Dark mode is unreachable. |
| 10 | `MarkdownNoteEditor.tsx` | Nine always-visible toolbar buttons **per page row**. At 20 pages that is 180 buttons of chrome competing with the content. |
| 11 | `MarkdownNoteEditor.tsx` | Every keystroke runs `getHTML()` → Turndown → markdown, then `setState`. |
| 12 | `DocumentOverview.tsx` | `alert()` / `confirm()` for validation and destructive delete. |

## Design plan

### Concept: ink, paper, desk

The identity comes from the annotation act itself — fountain-pen ink on warm paper, laid on a cool
desk. Not from a generic productivity palette.

**Boldness is spent in exactly one place: the spine.** A narrow ruled column running between the
PDF and the note, carrying the page number as a sticky tick mark and an ochre dot when that page
has a note. It is the visual expression of the product's whole premise — this note belongs to that
page — and it *encodes information* rather than decorating. Everything else stays quiet.

### Color

Named base palette (light):

| Token | Hex | Role |
|---|---|---|
| `--desk` | `#E8E8EF` | app background, cool grey with a lavender cast |
| `--surface` | `#FFFFFF` | raised panels: note card, header, page frame |
| `--surface-2` | `#F4F4F8` | recessed: inputs, code, inactive chips |
| `--ink` | `#191B22` | primary text — 17.4:1 on surface |
| `--ink-2` | `#565B6E` | secondary text — 7.0:1 on surface |
| `--ink-3` | `#61667A` | tertiary: page numbers, metadata — 5.7:1 on surface, 4.7:1 on desk |
| `--rule` | `#DCDCE4` | hairlines |
| `--quill` | `#4238B8` | accent: fountain-pen ink violet — 8.4:1 on surface, and white on it is 8.4:1 |
| `--marker` | `#B0821A` | highlighter ochre, fills and icons only (3.5:1) |
| `--marker-ink` | `#8A6410` | ochre at text contrast — 5.4:1 |
| `--danger` | `#B3261E` | destructive — 6.4:1 |

Dark is a genuine re-mix, not an inversion: `--desk #101117`, `--surface #191B23`,
`--surface-2 #21232D`, `--ink #E9E9F0`, `--ink-3 #7F8499`, `--quill #9A90FF` (6.4:1 on surface), `--marker #E0B84A`.
The PDF page keeps its rendered white — a PDF is a PDF — but gains a warm hairline so it does not
glare against the dark desk.

*Checked against the generic-default list:* not cream + serif + terracotta, not near-black + acid
green, not broadsheet hairlines, not a uniform SaaS-card kit. The accent is violet-leaning ink
rather than the default azure, the paper is warm rather than pure white, and ochre appears only
where a note exists.

### Type

Two families, clearly distinct, with a real reason for the split: **chrome versus prose.**

- **Instrument Sans** — all app chrome, controls, labels, page numbers. Slightly narrow, engineered,
  reads cleanly at 11–13px. Not the Inter default.
- **Literata** — note body and note headings. Google's typeface designed specifically for long-form
  screen *reading*. Using the reading face for the reading app's prose is the most subject-grounded
  choice available, and it separates "the note you are writing" from "the app around it" without a
  single border.
- **JetBrains Mono** — code blocks and the raw-markdown view only.

Scale, minor third from a 13px UI base: 11 / 12 / 13 / 15 / 17 / 21 / 27 px. Note body is 15px
Literata at 1.7 line-height (serif gets the extra leading).

**Measure.** The note column can be 950px wide on a large screen. Prose is capped at `68ch`
(~615px at 15px Literata) and left-aligned against the spine, so line length stays inside the
80-character limit no matter the split ratio. The current build lets notes run the full column.

### Layout

Single full-height flex column with **one** scroll region. This structurally removes the entire
class of hand-tuned sticky-offset bugs (defect 4).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Library │ Attention Is All You Need   15 pages   ⊟ 100% ⊞  ☾  Export  │ 56px chrome
├───────┬──────────────────────────────┬──┬────────────────────────────────┤
│ ▤ 1 ● │   ┌──────────────────────┐   │ 1│ Introduction                   │
│ ▤ 2   │   │                      │   │  │                                │
│ ▤ 3 ● │   │   PDF page — always  │   │  │ The dominant sequence…         │
│ ▤ 4   │   │   fitted to column   │   │  │                                │
│ ▤ 5   │   └──────────────────────┘   │  │ • self-attention               │
│  ⋮    │                              │  │                                │
│       │   ┌──────────────────────┐   │ 2│                                │
│ 96px  │   │   PDF page 2         │   │  │ Write, or press / for blocks   │
│ rail  │   └──────────────────────┘   │  │                                │
└───────┴──────────────────────────────┴──┴────────────────────────────────┘
   nav          page rail             spine        note rail
                                    (the one bold element)
```

Alignment: chrome is left-aligned with a right-aligned control cluster. The PDF is centred in its
column (a page is a physical object, it wants to be centred). Note prose is left-aligned and
flush to the spine, ragged right — justified text with no hyphenation engine produces rivers.

Four structural changes:

1. **Thumbnail rail** replaces the page-button strip. Real rendered thumbnails, virtualized, with a
   note dot. Scales to 500 pages and is how a reader actually navigates.
2. **Fit-to-width PDF.** `renderScale = (columnWidth / naturalPageWidth) × zoom`, so zoom 100% means
   "fills the column" and the page can never overflow its row.
3. **Windowed rendering.** One `IntersectionObserver` per row with a generous `rootMargin`; rows
   outside the window render an aspect-correct placeholder so scroll height never jumps. Bounds live
   TipTap instances to the handful on screen.
4. **Chrome-less notes.** No per-page toolbar. A slash menu and a selection bubble menu, following
   the reference editor. The note header reduces to a save indicator and word count.

### Editor, informed by the reference package

Adopted from `@contextboard/editor`:

- `@tiptap/suggestion` + `@floating-ui/dom` slash menu with keyboard navigation, `flip`, and
  `shift` — replacing the wall of toolbar buttons.
- TipTap's own `BubbleMenu` from `@tiptap/react/menus` — replacing the hand-rolled positioner
  (defect 8).
- The `looksLikeMarkdown` paste heuristic, extended with table detection.
- One shared extension factory so the editable surface and any static preview cannot drift.

Added for this product specifically: **highlight** (the marker metaphor, and the natural gesture
when reading), **task lists** (reading generates todos), **tables** and **KaTeX math** (papers have
both), and **links**.

Markdown round-trip gains Turndown rules for task lists, highlight, tables, and math, so the added
nodes survive export. Serialization moves off the keystroke path onto the debounced save (defect 11).

### Principles

1. The page and its note are one object; the spine says so.
2. Chrome recedes while reading and appears on intent.
3. Nothing on screen that is not either the document, the note, or a control you are about to use.
4. Motion only answers an action — rail collapse, menu open, save confirm. No scroll-triggered
   entrances.

## Plan review against the brief

Three parts of the first pass read as defaults and were revised:

- **Accent** started as a teal/emerald carried over from the existing code. Revised to fountain-pen
  violet: the existing teal came from a *different* product (contextboard) and encoded nothing about
  reading. Ink is the subject's own material.
- **Navigation** started as an improved horizontal page-chip strip — a smaller version of the same
  mistake. Revised to a vertical thumbnail rail, because a reader recognises pages by their shape,
  not their number.
- **The hero** started as a header with the document title and stats, the default treatment.
  Revised: this app has no hero moment, it has a *working surface*, so the boldness went into the
  spine, which is on screen the entire time you use the product.

One accessory removed: the four-layer radial-gradient body background plus the two decorative
`body::before` / `body::after` overlay grids. A reading surface should be calm, and they were pure
decoration fighting the content.

## Smallest design

The Ask is "fix the layout and the theme" plus "build a markdown editor like this reference". That
cannot be satisfied by token edits alone, because defect 2 means no component reads the tokens. The
minimum that satisfies it is: one token layer, every component moved onto it, the four structural
layout changes, and the editor rebuild.

### Necessary added concepts

| Concept | Observable need |
|---|---|
| `ThemeToggle` + `theme.ts` | Defect 9 — dark tokens exist and are unreachable. |
| Thumbnail rail | Defect 5 — the current navigator is unusable past ~15 pages. |
| Fit-to-width scale | Defect 3 — the page overflows its row past zoom ~1.4. |
| Row windowing | Defect 6 — 200 pages currently means 200 TipTap instances. |
| Slash menu | Defect 10 — 9 buttons × N pages of chrome; the reference's answer. |
| Extension factory | Prevents the editable and static surfaces from drifting. |

### Rejected smaller alternatives

- **Retint the existing components in place.** Rejected: it fixes defect 1 but none of 3–8, and the
  owner named the layout first.
- **Keep the hand-rolled bubble toolbar and only clamp its offsets.** Rejected: clamping does not
  give flip or shift, so it still mispositions near container edges; TipTap ships the correct
  component.
- **Paginate the reader (one page at a time) instead of windowing.** Rejected: it would destroy the
  continuous parallel scroll, which is the product.
- **`content-visibility: auto` instead of an IntersectionObserver window.** Rejected: it skips
  *paint*, not React mount, so 200 TipTap instances would still be constructed.

## Verification

Every text tier clears WCAG AA (4.5:1) against the surface it sits on, in both
skins; the ratios are checked from the hex values rather than eyeballed.

- `bun run check` (Biome) over the full source.
- `bunx tsc --noEmit` for type safety across the rebuilt components.
- `bun run build` to prove the production bundle compiles.
- A real browser journey against `bun run dev`: load the demo document, confirm fit-to-width at
  several zoom levels and split ratios, exercise the slash menu and bubble menu, toggle dark mode,
  and confirm the note round-trips to markdown on export.
