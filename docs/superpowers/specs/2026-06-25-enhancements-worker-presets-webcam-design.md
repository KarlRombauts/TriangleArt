# Triangle Demo Enhancements — Design

**Date:** 2026-06-25
**Status:** Approved (pending written-spec review)
**Builds on:** `2026-06-25-interactive-triangle-demo-design.md` (the shipped interactive demo)

## Overview

A second feature pass on the interactive triangle-art demo. Two architectural
upgrades remove existing rough edges and unlock the headline feature, then four
user-facing features ride on top:

1. **Web Worker generation** — move the subdivision off the main thread (fixes
   general UI lag; enables a smooth continuous webcam).
2. **Cutoff-based, flicker-free rendering** — reuse prior calculations when the
   detail slider changes instead of resetting and re-animating from scratch.
3. **Presets** — one-click curated "looks".
4. **More default images** — additional built-in samples.
5. **Before/after slider** — wipe between the original photo and the triangulated result.
6. **Webcam (continuous)** — a live triangulated mirror.

No backend, no new persistent storage. The app stays a static, deployable site.

## Goals

- Detail-slider changes are instant and flicker-free, reusing computed subdivisions.
- The UI stays responsive during heavy generation (work happens in a worker).
- Continuous live webcam triangulation that stays smooth.
- Curated preset looks, more sample images, and an original/result compare slider.

## Non-Goals (YAGNI)

- Shareable links / image hosting / any backend (explicitly deferred).
- Contrast/variance subdivision or true low-poly (Delaunay) — deferred; the
  existing brightness subdivision algorithm is unchanged.
- Filled / color-sampled triangles — deferred.
- `OffscreenCanvas` rendering in the worker (worker returns segments; the main
  thread renders).
- Persisting webcam output server-side; webcam is live-only plus a local export.

## Architecture

### Existing structure (unchanged engine)

The pure-TS engine (`src/lib/engine/`) — `geometry`, `tree`, `brightness`,
`generator`, `polarity` — keeps its current algorithm. It gains a per-segment
**cutoff** value and is consumed from a Web Worker.

### New / changed files

```
src/
  lib/
    engine/
      generator.ts          # MODIFY: tag segments with cutoff; keep dormant nodes so a lower threshold resumes building instead of restarting
      geometry.ts           # MODIFY: Segment gains `cutoff: number`
    worker/
      generator.worker.ts   # NEW: hosts TriangleGenerator, message protocol
      workerClient.ts       # NEW: typed main-thread wrapper around the worker
      protocol.ts           # NEW: shared message types
    render/
      canvasRenderer.ts     # MODIFY: filter segments by threshold cutoff when drawing
    presets.ts              # NEW: curated look presets
    samples/                # ADD: ~3 CC0 images + CREDITS.md
    components/
      Canvas.svelte         # MODIFY: drive worker; cutoff-filter rendering; webcam pipeline
      Controls.svelte       # MODIFY: presets row, webcam start/stop + freeze, compare toggle
      CompareSlider.svelte  # NEW: before/after wipe overlay
    webcam.ts               # NEW: getUserMedia + frame-capture helper
```

### Cutoff model (flicker-free detail changes)

A node subdivides iff `metric >= (imageArea / area) * threshold`, i.e.
`threshold <= metric * area / imageArea`. Define:

```
nodeCutoff = metric * area / imageArea
```

A node subdivides at threshold `T` iff `T <= nodeCutoff`. The dividing segment a
node emits is therefore visible iff `nodeCutoff >= T`. So:

- `Segment` gains `cutoff: number`. The generator tags each emitted segment with
  the producing node's `nodeCutoff`. Border segments use `cutoff = Infinity`
  (always drawn).
- The main thread keeps **all** segments built so far plus `builtThreshold` (the
  finest/lowest threshold computed). Rendering draws segments with
  `cutoff >= currentThreshold`.
- **Raising threshold (coarser):** filter + redraw on the main thread only —
  instant, no worker, no flicker.
- **Lowering below `builtThreshold` (finer than ever built):** ask the worker to
  continue building down to the new threshold; it streams the new segments;
  `builtThreshold` is updated.
- The worker keeps a "dormant" list of nodes it stopped at; lowering the
  threshold re-activates dormant nodes whose `nodeCutoff >= newThreshold` rather
  than restarting. The frontier is never thrown away for a threshold change.

### Worker protocol (`protocol.ts`)

Messages are plain objects; large pixel/segment payloads use transferable
`ArrayBuffer`s.

Main → Worker:
- `{ type: "load"; id: number; image: { buffer: ArrayBuffer; width: number; height: number }; options: { threshold: number; subdivideOn: "bright" | "dark"; maxSamples: number } }`
- `{ type: "setThreshold"; id: number; threshold: number }`
- `{ type: "frame"; id: number; image: { buffer: ArrayBuffer; width: number; height: number }; options: {...} }`

Worker → Main:
- `{ type: "segments"; id: number; buffer: ArrayBuffer; count: number; done: boolean }`
  — a batch of segments encoded as a flat `Float32Array` of `[x1,y1,x2,y2,cutoff]`
  per segment. `done` marks the final batch for that request.

`workerClient.ts` wraps this in a typed API:
`load(image, options, onBatch)`, `setThreshold(t, onBatch)`, `frame(image, options): Promise<segments>`, returning/streaming decoded `Segment[]`. `id` lets the
client ignore stale responses (e.g. a superseded webcam frame).

### Animation with the worker

The worker streams segment batches as it builds; the main thread strokes each
batch as it arrives. This preserves the progressive "watch it build" animation
while the compute is off-thread. For still images the batches arrive over a few
frames; for webcam each frame's segments arrive as one (or few) batches.

## Features

### Presets (`presets.ts`)

```ts
export type Preset = { name: string; threshold: number; lineWidth: number; background: string; line: string };
export const PRESETS: Preset[];   // ~5: Ink, Blueprint, Newsprint, Neon, Heavy
```

A preset row in `Controls.svelte`; clicking assigns the fields into `settings`.
The existing reactive pipeline applies them (threshold → cutoff filter / extend;
colors → redraw or polarity flip). No new mechanism needed.

### More default images

Add ~3 CC0 / public-domain images under `src/lib/samples/`, registered in
`samples/index.ts`, with a `CREDITS.md` recording source + license. Shown as
clickable thumbnails. (Exact images chosen at implementation time from
public-domain sources; bundled locally, not hot-linked.)

### Before/after slider (`CompareSlider.svelte`)

A toggle ("Compare") overlays the **original** image above the triangulated
canvas, revealed by a draggable vertical divider (CSS `clip-path: inset(...)`
driven by handle x). Pointer/touch draggable, keyboard-accessible (arrow keys on
the handle). Applies to the current still image; hidden/disabled during webcam.

### Webcam (continuous)

- Start/Stop button. Start → `navigator.mediaDevices.getUserMedia({ video: true })`,
  stream into a hidden `<video>`.
- A capture loop draws the current video frame to an offscreen 2D canvas, reads
  `ImageData`, and sends it to the worker via `frame(...)`. The next frame is
  captured only after the worker returns the previous one's segments
  (back-pressure → no queue build-up); detail is auto-capped (higher minimum
  threshold) for smoothness.
- Returned segments are drawn each frame (full redraw per frame; cutoff caching
  does not apply since pixels change every frame).
- Canvas sizes to the video resolution (capped, e.g. ≤ 640px on the long edge,
  for performance). "Freeze & export" stops the loop on the current frame so PNG/
  SVG export works as for still images.
- Stopping releases the camera (`stream.getTracks().forEach(t => t.stop())`).
- Compare slider is disabled in webcam mode.

## Re-generation / interaction rules (updated)

| Change | Behavior |
|---|---|
| Detail threshold, coarser (≥ builtThreshold) | Main-thread cutoff filter + redraw — no worker, no flicker |
| Detail threshold, finer (< builtThreshold) | Worker extends; stream + append new segments |
| New image / sample / preset image | Worker `load`; stream build (animated) |
| Color change, same polarity | Live redraw |
| Color change, polarity flip | Worker rebuild (polarity affects which nodes subdivide) |
| Line weight | Live redraw |
| Build speed | Batches drawn per frame on the main thread |
| Preset selected | Apply settings → above rules apply per field |
| Webcam frame | Worker `frame`; draw returned segments |

## Error handling

- **Worker unsupported / fails to start:** fall back to running the generator on
  the main thread (keep current synchronous path behind the same client API).
- **getUserMedia denied / no camera:** show an inline message in the controls;
  leave the current still image untouched.
- **Stale worker responses:** ignored via the monotonic `id` (esp. webcam).
- **Polarity flip / new image mid-build:** a new `load`/`setThreshold` supersedes
  prior requests (id bump); old batches are dropped.

## Testing

- **Engine unit tests (Node):**
  - `nodeCutoff` correctness: a segment's `cutoff` equals `metric * area / imageArea`
    for its producing node; border segments are `Infinity`.
  - Filtering equivalence: the set of segments with `cutoff >= T` matches a fresh
    full build at threshold `T` (for several `T`). This is the core guarantee that
    flicker-free filtering yields the same image as recomputation.
  - Lowering threshold then filtering reproduces a direct build at the lower `T`
    (reuse correctness).
  - Existing generator/geometry/tree/brightness/polarity tests still pass.
- **Protocol encode/decode:** segment ↔ Float32Array round-trip.
- **Manual / agent-browser:**
  - Detail slider: drag rapidly → no flicker, no rebuild flash; image matches.
  - Worker: UI stays responsive during a heavy build (no main-thread jank).
  - Presets apply expected looks.
  - New sample images load and triangulate; thumbnails work.
  - Compare slider wipes correctly between original and result.
  - Webcam: permission prompt, live triangulated mirror, freeze & export, stop
    releases the camera; denial shows a graceful message.
  - PNG + SVG export still correct; heap bounded; no console errors.

## Migration / Risk Notes

- Worker bundling: Vite supports `new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })`. Verify dev + production build both bundle the worker (Context7 for current Vite worker guidance at implementation time).
- The main-thread fallback path doubles the code that drives the generator; keep
  the `workerClient` API identical for both so `Canvas.svelte` is agnostic.
- Webcam performance is the main risk: mitigate with resolution cap, detail
  auto-cap, and frame back-pressure. Measure FPS in verification.
- Cutoff filtering must be provably equivalent to recomputation (covered by the
  filtering-equivalence test) — otherwise the slider would silently show a wrong
  mesh.
