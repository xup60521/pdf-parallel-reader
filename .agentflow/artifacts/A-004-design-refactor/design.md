# A-004 — Refactor the UI to the `PDF Notes v3` design

## Original Ask

A-003:

> godev
> you should refactor the UI following this design
> https://claude.ai/design/p/018d4342-8ec0-454e-8a6e-03efb6472349?file=PDF+Notes+v3.dc.html&via=share

A-004:

> login success. it should work now

A-003 was blocked because the design could not be read. The owner then authorized the design
tool, so A-004 executes the A-003 request against the now-readable file.

## The design source

`DesignSync get_file` returned `PDF Notes v3.dc.html` from project
`018d4342-8ec0-454e-8a6e-03efb6472349`. It is stored verbatim beside this record. The project
carries the "Organic" design system, but the design file overrides almost all of it inline; the
only inherited token is `--font-body: "Figtree", system-ui, sans-serif`.

## What the design actually specifies

Read off the exact bytes, not inferred.

**Shell.** `display:grid; grid-template-columns: 64px minmax(0,1fr) minmax(0,1fr)`. Three columns:
a 64px rail, the page column, the note column. There is **no top header bar**. Every control lives
in the rail.

**Rail** (`grid-row: 1 / span 3`, `position:sticky; top:0; height:100vh`, `padding:10px 8px`).
Background `#f7f6f3`, right border `1px solid rgba(55,53,47,.09)`.

| Slot | Content |
|---|---|
| Top | `24 pp` — 11px, `#9b948a`, centred, bottom rule, 8px below it |
| Middle | one `.sideb` button per page, `gap:1px`, current page `background:rgba(55,53,47,.09); color:#37352f; font-weight:600`, `aria-current="page"` |
| Spacer | `flex:1` |
| Bottom | top rule, then zoom in `＋`, the zoom label (11px `#787066`), zoom out `−`, then `Fit` and `Export` each with `margin-top:6px` |

`.sideb`: 12px `--font-body`, `#787066`, no border, `border-radius:6px`, `padding:5px 6px`,
`width:100%`; `:hover` `background:rgba(55,53,47,.08); color:#37352f`;
`:focus-visible` `outline:2px solid #37352f; outline-offset:1px`.

**Page column.** Background `#f1f0ee`. Padding `36px 36px 18px` on the first row, `0 36px 18px` in
the middle, `0 36px 36px` on the last — so the band is continuous and rows are 18px apart.
`.pdfpage` is `background:#fff`, `border:1px solid rgba(55,53,47,.12)`, `border-radius:2px`, **no
shadow**.

**Note column.** Background is the body white. Padding `36px 40px 18px` / `0 40px 18px` /
`0 40px 36px`. Inner wrapper `max-width:560px`. **No card, no border, no panel.** Each note opens
with `.plabel` — `Page N`, 12px `#787066`, `margin-bottom:11px`.

**Note prose.** `p` 15px/1.75 `#37352f`, `margin-bottom:13px`. `ul` `padding-left:19px`,
`margin-bottom:13px`; `li` 15px/1.7, `margin-bottom:3px`. `h4` `--font-body` 600 15.5px,
`margin-bottom:9px`. `code` `ui-monospace,Menlo,monospace` 13px, `background:rgba(135,131,120,.15)`,
`color:#a3492c`, `border-radius:3px`, `padding:1px 5px`. Quote: `border-left:3px solid #37352f;
padding-left:14px`. Empty note: `Write a note…` in `#9b948a`. Slash affordance: a 1.5×16px `#37352f`
caret bar, 9px gap, `Type / for commands` in `#9b948a` at 13px.

**Palette.** Warm neutral grey, monochrome. Text `#37352f`, muted `#787066`, faint `#9b948a`,
rail `#f7f6f3`, gutter `#f1f0ee`, paper `#fff`, rules `rgba(55,53,47,.09)` and `.12`, hover
`rgba(55,53,47,.08)`, active `rgba(55,53,47,.09)`. The single chromatic value in the whole file is
`#a3492c`, on inline code.

## What the current build does instead

| # | Where | Gap against the design |
|---|---|---|
| 1 | `src/styles.css` | A blue-violet accent (`--quill #4238b8`), an ochre marker, and a cool grey desk (`#e8e8ef`). The design is warm monochrome with one terracotta. |
| 2 | `src/styles.css` | Three shadow levels; every sheet and button is lifted. The design uses no shadow at all. |
| 3 | `src/styles.css` | Radii 3/6/8/12px and `Instrument Sans` + `Literata` + `JetBrains Mono` webfonts. The design is 2/3/6px on Figtree with system mono. |
| 4 | `ParallelReaderView.tsx` | A 52px top header carrying back, title, page input, zoom, split ratio, rail toggle, theme, copy, export. The design has no header; the rail carries everything. |
| 5 | `PageRail.tsx` | A 100px thumbnail rail that renders a canvas per page. The design's rail is 64px of plain numbers. |
| 6 | `ParallelReaderView.tsx` | The PDF/note split is user-adjustable (60/50/40). The design fixes `1fr 1fr`. |
| 7 | `ParallelReaderView.tsx` | Rows are flex with a 36px ruled "spine" between the columns and a 32px row gap on a single flat background. The design has no spine; the two columns are distinguished by their own background bands, flush vertically. |
| 8 | `NoteEditor.tsx` | The note is a bordered rounded panel with a permanent bottom status strip. The design has neither. |
| 9 | `editor.css` | Note prose is Literata serif at 0.9375rem/1.7 with sans headings at 1.3125/1.0625/0.9375rem. The design is Figtree 15px/1.75 with a single 15.5px/600 heading weight. |

## Design decisions

**Follow the design exactly** on: the three-column grid and its widths, the rail's structure and
every control in it, the column backgrounds and paddings, the 560px note measure, the `.plabel`,
the palette, radii, the absence of shadows, the focus ring, and the note type scale.

**Converge, do not discard** on behavior the design cannot express, per the standing A-003 default
("keep what already works and rebuild the visual layer"):

| Kept | Why the design does not contradict it |
|---|---|
| Sticky page pin | The mock is static; a note longer than its page still needs the page to hold. |
| Row windowing | Invisible; a 500-page document cannot mount 500 editors. |
| Markdown round-trip, slash menu, bubble menu | Unchanged behavior, re-skinned. |
| Dark mode | The mock is light-only, so dark is derived: the same roles on a warm dark ground, every text tier held at AA. |
| A note indicator in the rail | The mock shows no annotated page, so it specifies nothing. A 3px `--accent` dot on the number is the smallest honest extension. |

**Controls the design has no slot for.** The rail is 64px and the mock's bottom group is the
pattern for "everything else", so:

- Back to library and the theme toggle join the **top** of the rail, above `N pp`, as icon `.sideb`s.
- `Copy` joins the bottom group beside `Export`.
- The **split-ratio control is removed** — the design fixes an even split.
- The **page-number input is removed** — the rail's number list is the design's answer to "go to page".
- The **rail toggle is removed** — a 64px permanent rail costs less than the control that hides it.
- **Rename** survives as the document title, set once at the top of the note column in the
  `.plabel` idiom (12px, muted, click to edit). It is the one piece of chrome the design omits that
  cannot live in 64px, and dropping rename would delete a working feature rather than restyle it.

## Necessary added concepts

| Concept | Owner outcome it serves | Smaller alternative rejected |
|---|---|---|
| `--rail`, `--gutter` tokens | The design's two distinct column grounds (`#f7f6f3`, `#f1f0ee`) are different roles from `--surface`. | Reusing `--surface-2`/`--surface-3` — they already mean "inset control" elsewhere, so the rail and a button would move together under any later change. |
| `--tint` / `--tint-strong` | `.sideb` hover and current-page fill are alpha over the ground, not opaque greys, so they work on both column backgrounds. | Opaque hex hovers — they break the moment a `.sideb` sits on the gutter rather than the rail. |
| `.sideb` class in `styles.css` | Nine rail buttons share one exact spec from the design; a class keeps them identical. | Nine Tailwind utility strings — the design's spec would be restated nine times. |
| `--accent` `#a3492c` | Inline code is the design's only chromatic element; links and the note-present dot need a colour that is not text-black. | Keeping `--quill` — the design has no blue-violet anywhere. |

## Rejected larger alternatives

- **Rebuild the reader from the design's flat grid** (one grid, two cells per page, `display:contents`
  wrappers). Rejected: `display:contents` breaks `getBoundingClientRect`, so it would destroy the
  current-page observer and the row registry that windowing depends on. A per-page `<section>` that
  is itself a two-column grid produces the identical geometry because the rows are flush.
- **Delete `PageRail.tsx` and inline the rail.** Rejected: the file is still exactly "the page
  rail"; only its content changes.
- **Keep the header and add the rail.** Rejected: the design's whole point is that the rail replaces
  the header.

## Normal journey

1. Open the library, click "Try the sample paper".
2. The reader opens with no header: a 64px rail on the left, the page band, the note column.
3. Scroll — the rail's current number tracks the page, and the page pins while a long note scrolls.
4. Click a number in the rail — the reader scrolls to that page.
5. `＋` / `−` change zoom, the label follows, `Fit` returns to 100%.
6. Type in a note; it saves; the `.plabel` row shows the state on hover.
7. `Export` downloads the markdown, `Copy` puts it on the clipboard.
8. Toggle dark mode from the rail; every tier stays legible.

## Suite

`bun run check`, `bunx tsc --noEmit`, `bun run build`, plus a live browser journey against the
sample document.
