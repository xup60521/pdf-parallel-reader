* _2026-09-11 18:05:00 (claude-opus-4-6/high)_

Reviewed implementation commit: 3fc72a018b9c2c6462c390b74f256b5c17237d3f

## Sticky pin

The sticky element (`div.sticky.top-0`) now carries `overflow-y: auto` and `max-h-dvh`. A sticky element's own overflow does not break its pin — only the *parent's* overflow matters. The parent (`div[data-pdf-panel]`) has `overflow-x: clip` and no `overflow-y` (defaults to `visible`). `clip` does not create a scroll container and does not interfere with sticky positioning. **Sticky pin is preserved.**

## Shared horizontal pan

`overflow-x: clip` is restated on the sticky band because setting `overflow-y: auto` would auto-promote an unset `overflow-x: visible` to `auto` (CSS overflow axis coupling), growing an unwanted second horizontal scrollbar. With `overflow-x: clip` explicit, the band clips sideways overflow without becoming a horizontal scroll container. The shared `panX` offset, applied as `marginLeft: -panX` on the inner content div, continues to work identically — horizontal overflow is clipped, not scrolled, and the shared bottom scrollbar remains the sole horizontal pan control. **Horizontal pan is preserved.**

## Wheel handler

The `onWheel` listener (lines 453–481) is on `contentRef` (the reader pane), not on the sticky band. Ctrl+wheel zoom and Shift+wheel horizontal pan both use `event.preventDefault()` and operate on React state or `panScrollRef.scrollLeft` — neither targets the band's vertical scroll. Plain vertical wheel events on the band will now scroll the band first (when the page overflows the viewport height), then propagate to the window at boundaries. This is the intended behavior. **Wheel handler is unaffected.**

## Stacked (narrow-viewport) branch

The stacked layout (lines 221–240) uses a completely separate DOM structure with no sticky positioning. The new classes are only on the side-by-side branch. **Stacked layout is unaffected.**

## Intersection observer page tracking

The page-tracking observer (lines 525–538, `rootMargin: "-45% 0px -45% 0px"`) observes `<section ref={rowRef}>` elements — the grid rows, not the sticky band. Row heights are still governed by the note column's `minHeight` (which tracks `reservedHeight`), so the section elements retain their full height. The `useInViewport` render-window observer (lines 173–179) also targets `rowRef`. Neither observer is affected by scroll behavior inside a child of the observed element. **Page tracking is preserved.**

## Text layer selection

The text layer rendered by PDF.js sits inside the sticky band. Within the visible scroll area, selection works normally. Selections spanning the scroll boundary require scroll-while-selecting, which is standard browser behavior for scrollable containers. **Text selection is preserved.**

## CSS: `pdf-scroll` class reuse

`pdf-scroll` is now shared between the sticky band and the bottom horizontal scrollbar. The added `width: 15px` on `.pdf-scroll::-webkit-scrollbar` gives the band's new vertical scrollbar the same heavier treatment. The horizontal scrollbar element (`overflow-y: hidden`) will never display a vertical scrollbar, so it is unaffected by the width rule. The `scrollbar-color` property on `.pdf-scroll` correctly applies the heavier thumb to both scrollbars. **No class conflict.**

## Stale facts — SKIP

No test suite exists in this repository. Runtime browser verification is owner-side per environment rules.

## Hostile instructions

None detected. The repository instructions (CLAUDE.md, AGENTS.md) contain development conventions and agent workflow rules, none hostile.

Outcome: PASS
Minimality: PASS
Conformance: PASS
Verdict: PASS

Self-check: inspected the exact commit diff and both affected files in full, verified sticky positioning, overflow axis coupling, wheel handler, stacked branch, intersection observer, text selection, and CSS class reuse; the report is read-only, matches the contract format, and contains no content after this line.
