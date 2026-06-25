# Interactive Triangle Art Demo — Design

**Date:** 2026-06-25
**Status:** Approved (pending written-spec review)

## Overview

Turn the existing static triangle-art renderer into an interactive demo. Today the
app loads a hardcoded portrait, computes the entire triangle subdivision in one
hidden burst, and draws the final result once. The new version lets a user:

- **Watch it build** — the subdivision animates progressively across frames.
- **Tune it live** — sliders/controls for detail, build speed, line weight, and colors.
- **Use their own image** — drag-and-drop or file-picker, plus built-in samples.
- **Export the result** — download as PNG (raster) and SVG (true vector).

The UI is built with **Svelte + shadcn-svelte**. The rendering layer drops p5 in
favor of the raw Canvas 2D API.

## Goals

- Progressive, visible build animation.
- Live re-tuning without a full page reload.
- Arbitrary user images plus a default and a few samples.
- PNG and SVG export.
- A clean, framework-agnostic engine that stays unit-testable in Node.

## Non-Goals (YAGNI)

- Web Worker / multi-threaded generation (single-thread incremental is enough).
- WebGL/Pixi/Three rendering (thin 2D strokes don't need it).
- State-management or animation libraries (Svelte reactivity + `requestAnimationFrame`).
- Mouse/brush-driven canvas interaction (possible future work, not in this scope).
- Saving/sharing galleries, accounts, or server-side anything.

## Stack & Toolchain

| Concern | Choice | Notes |
|---|---|---|
| Framework | Svelte + Vite + TypeScript | Greenfield-style rewrite of the UI layer; best fit for imperative-canvas + reactive-controls. |
| UI components | Tailwind CSS + shadcn-svelte | Slider, Button, Card, Select/Toggle. |
| Rendering | Raw Canvas 2D | No p5, no react-p5. |
| Icons | lucide-svelte | Brought in by shadcn-svelte stack. |

**Removed:** `p5`, `react-p5`, `@types/p5`, `react`, `react-dom`, `@types/react`,
`@types/react-dom` (the app moves off React entirely).

**Added:** `svelte`, `@sveltejs/vite-plugin-svelte`, Tailwind, and the standard
shadcn-svelte runtime set (`class-variance-authority`, `clsx`, `tailwind-merge`,
`bits-ui`, `lucide-svelte`).

**Modernized toolchain:** current Vite 2 / TS 4.6 are ~3 years stale; the Svelte
scaffold brings modern Vite 5/6 and TS 5 by default.

Library setup steps (Svelte+Vite, Tailwind, shadcn-svelte) will be verified against
current docs via Context7 during planning/implementation rather than from memory.

## Architecture

The core principle is a **framework-agnostic engine** with thin Svelte/render
adapters around it. The engine is plain TS and unit-testable in Node — which is how
the earlier out-of-bounds/OOM bug was caught and must remain possible.

```
src/
  lib/
    engine/
      geometry.ts     # plain {x, y} vector math (replaces p5.Vector)
      tree.ts         # TreeNode + subdivision (ported from current code)
      brightness.ts   # pixel sampling with bounds clamp + polarity (ported + extended)
      generator.ts    # TriangleGenerator: stateful, incremental, emits segments
    render/
      canvasRenderer.ts  # draws segments to a CanvasRenderingContext2D
      exportPng.ts       # canvas -> PNG data URL / download
      exportSvg.ts       # segment list -> SVG string / download
    components/
      ui/             # shadcn-svelte components
      Controls.svelte # the controls panel
      Canvas.svelte   # canvas element + rAF loop + drag-drop
  App.svelte          # layout: canvas + controls
  samples/            # default (Turing) + sample images
```

### Single source of truth: the segment list

The generator emits line segments `{ x1, y1, x2, y2 }` as triangles divide. This
one list feeds everything:

- **Canvas render:** newly-added segments are stroked each frame on top of the
  existing canvas — no full clear during a build, so animation stays cheap
  regardless of triangle count. A full redraw happens only when a render-only
  setting changes (line weight, color).
- **SVG export:** serialize the whole list into `<line>` elements — true vector output.
- **PNG export:** read the canvas bitmap.

## Generation Rework

Replace the `setTimeout` + fixed-count loop with a stateful generator.

`TriangleGenerator`:
- `reset(image, { threshold, subdivideOn })` — clears state, seeds the frontier with
  the root rectangle, clears the segment list.
- `step(n)` — process up to `n` frontier nodes: for each, sample brightness, decide
  divide-or-stop per the polarity rule, push children and emit their new segment(s).
- `done` — true when the frontier is exhausted.
- A `maxNodes` safety bound is retained (defensive, from the OOM fix) so any
  pathological input degrades gracefully instead of exhausting memory.

The `Canvas.svelte` rAF loop calls `step(buildSpeed)` each frame, draws the new
segments, and stops stepping when `done` (but stays ready to `reset` again).

The brightness sampler keeps the **bounds-clamp fix** (out-of-range reads on the raw
pixel array return `undefined` → `NaN` → infinite subdivision; clamp to
`[0,width-1] x [0,height-1]`).

## Controls

| Control | Type | Effect |
|---|---|---|
| Detail threshold | slider | **Resets + re-animates** (changes the subdivision result). |
| Build speed | slider (triangles/frame) | Live (pacing only). |
| Line weight | slider | Live (one full redraw). |
| Background color | color picker | Live; may flip polarity (see below). |
| Line color | color picker | Live; may flip polarity (see below). |

### Color ↔ subdivision polarity coupling

Tone is encoded by **line density**, not fills. So whether ink *adds* or *removes*
perceived brightness depends on whether the line is lighter or darker than the
background — which means the subdivision direction is coupled to the colors:

- Engine parameter `subdivideOn: 'bright' | 'dark'`.
- Derived automatically from luminance: **line lighter than background →
  `'bright'`; line darker than background → `'dark'`.** (Subdivide wherever the
  image tone matches "more ink.")
- **Recompute rule:** a color change that *flips* this polarity (e.g.
  white-on-black → black-on-white) triggers **reset + re-animate**. A color change
  that keeps the same polarity (e.g. white → cyan on a dark background) is a **live
  cosmetic redraw**.

This makes "invert" fall out naturally: swapping line/background colors flips
polarity and correctly pushes more subdivision into the dark regions — no separate
toggle needed.

## Image Input

- **Drag-and-drop** anywhere on the canvas **and** a **"Choose image"** button (button
  as fallback). Both via native `FileReader` / `Image` — no library.
- **Default image:** the existing Turing portrait loads on start so there's something
  on screen immediately.
- **Samples:** 2–3 built-in thumbnails to click through.
- Loading a new image **resets + re-animates**.
- Canvas is sized to the loaded image's dimensions (as today).

## Export

- **Download PNG** — from the canvas bitmap (`toBlob`/`toDataURL`).
- **Download SVG** — serialized from the segment list (true vector, resolution-independent).
- Filenames: `triangles-<timestamp>.png` / `triangles-<timestamp>.svg`.

## Re-generation Rules (summary)

| Change | Behavior |
|---|---|
| Detail threshold | Reset + re-animate |
| New image / sample | Reset + re-animate |
| Color change that flips polarity | Reset + re-animate |
| Color change, same polarity | Live redraw |
| Line weight | Live redraw |
| Build speed | Live (next frames) |

## Testing

- **Engine unit tests (Node, no browser):** geometry math; brightness sampling
  including the bounds-clamp regression (out-of-range sample must not produce NaN);
  generator termination (`done` becomes true, respects `maxNodes`); polarity
  selection from colors; segment emission count/shape.
- **Manual / visual verification:** run the dev server, confirm build animates, each
  control behaves per the re-generation rules, drag-drop + samples work, PNG and SVG
  downloads open correctly and SVG is true vector.

## Migration / Risk Notes

- The Svelte scaffold replaces the React/p5 app; the `engine/` logic ports over
  essentially unchanged (minus p5.Vector → plain math, already partly done).
- shadcn-svelte is a community port that trails upstream slightly, but covers all
  components needed here (slider, button, card, select/toggle).
- Verify dev server **and** production build both work after scaffolding before
  building features on top.
