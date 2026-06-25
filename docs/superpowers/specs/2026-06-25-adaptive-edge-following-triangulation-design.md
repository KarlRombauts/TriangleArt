# Adaptive Edge-Following Triangulation — Design

**Date:** 2026-06-25
**Status:** Approved (pending written-spec review)
**Builds on:** the shipped interactive demo + worker/cutoff enhancements.

## Overview

Replace the current subdivision (always split a right triangle at its
right-angle altitude; subdivide where **mean luminosity × area** is high) with an
**adaptive, edge-following** scheme:

- Split a triangle across its **longest edge**, with a cut (cevian) from the
  opposite vertex to a point on that edge.
- Choose the split point where the **luminosity changes most** — found via a 1-D
  Otsu search (maximize between-class brightness variance) over the triangle's
  samples, constrained so neither child triangle has an angle below ~10°.
- Use that same "best brightness step" as the **stop criterion**: keep splitting
  while a triangle still contains a meaningful edge; stop once it is ~uniform.

The result: triangle edges trace the image's contours, and density follows
**detail** (edges/texture) instead of brightness. Flat regions — bright *or*
dark — stay coarse.

## Goals

- Triangle edges align to image contours; the mesh "reads" as the subject.
- Density driven by local contrast, not luminosity.
- Well-shaped triangles (no slivers) across many generations.
- Keep the existing strengths: worker generation, flicker-free detail filtering,
  PNG/SVG export, the streamed build animation.

## Non-Goals (YAGNI)

- Delaunay / point-cloud "true low-poly" (different architecture; deferred).
- Filled / colour-sampled triangles (still a wireframe line drawing).
- Keeping the old luminosity-based algorithm as a selectable mode (replaced).
- Gradient/Sobel orientation estimation (the Otsu-along-the-fan approximation is
  enough and far cheaper).

## Algorithm

### Per-triangle analysis (`analyzeTriangle`)

Given a triangle and the image:

1. **Identify the longest edge** `E0–E1` and the **opposite vertex** `V`
   (deterministic tie-break by vertex index).
2. **Sample interior pixels** via barycentric coordinates over the triangle,
   using the existing stride cap (dense enough not to skip features). For each
   sample record its luminance `b = (r+g+b)/3` and a **fan coordinate** `u ∈
   [0,1]`: where the ray `V → sample` crosses `E0–E1` (one line–segment
   intersection per sample). Coordinates are clamped to image bounds.
3. **1-D Otsu over `u`.** Bin samples by `u` into `N` bins (e.g. 24), each bin
   accumulating count and brightness sum. Sweep a split index with running
   cumulative sums; for each candidate compute between-class variance
   `score(s) = w₁·w₂·(mean₁ − mean₂)²`. Restrict candidates to the `[s_min,
   s_max]` sub-range where both child triangles keep all angles ≥ `MIN_ANGLE`
   (10°). Pick `s*` maximizing `score`.
4. **Return** `{ score: scoreMax, splitParam: s* }`, or `null` if the triangle is
   too small/degenerate to split (area < `minArea`, or no valid `s` range).

`scoreMax` is the triangle's **edge strength**; `s*` is **where to cut**.

### Subdivision (generator)

- A node subdivides iff it is splittable (`analyzeTriangle` returns non-null) and
  its **edge strength ≥ threshold**.
- **Cut:** split the longest edge at `s*`. New vertex `M = E0 + s*·(E1−E0)`.
  Children: `(V, E0, M)` and `(V, M, E1)`. The shared new edge `V–M` is the
  emitted segment.
- **Cutoff (monotone) for flicker-free filtering:** an emitted segment's cutoff =
  `min(parentCutoff, edgeStrength)`. Capping to the parent guarantees cutoffs are
  non-increasing down the tree, so filtering segments by `cutoff ≥ T` yields a
  consistent nested mesh and remains **exactly equal to a fresh build at T**
  (the property the detail slider depends on). The seed rectangle's border and
  diagonal segments use `cutoff = Infinity` (always shown).
- The seed step is unchanged: the image rectangle splits into two right triangles
  along its diagonal; adaptive splitting takes over from there.
- `maxNodes` safety bound retained.

### Colour decoupling

Edge strength is symmetric in light/dark, so the **colour→polarity coupling is
removed**. Line and background colours become purely cosmetic: changing them is
always a live redraw, never a rebuild. `derivePolarity`/`subdivideOn` are deleted
from the subdivision path (and from the worker `LoadOptions` and webcam frame
options).

## Architecture / Files

```
src/lib/engine/
  geometry.ts      # MODIFY: general-triangle area (cross product); add
                   #   longestEdge(), triangleAngles()/min-angle test,
                   #   raySegmentParam() for the fan coordinate u
  tree.ts          # MODIFY: TreeNode splits its longest edge at a given
                   #   parameter; emits the cevian segment (general triangles)
  analysis.ts      # NEW: analyzeTriangle() — barycentric sampling + fan-u + Otsu.
                   #   Folds in the per-pixel luminance + bounds-clamp from
                   #   brightness.ts; brightness.ts is then deleted.
  generator.ts     # MODIFY: edge-strength criterion, monotone cutoff, longest-
                   #   edge cut; drop subdivideOn
  polarity.ts      # REMOVE
src/lib/worker/
  protocol.ts      # MODIFY: LoadOptions drops subdivideOn
  generator.worker.ts / generatorClient.ts  # MODIFY: same
src/lib/components/
  Canvas.svelte    # MODIFY: remove polarity rebuild; colour change = redraw only
src/lib/constants.ts  # MODIFY: recalibrate DETAIL_MIN/MAX to the edge-strength scale
```

`Segment` stays `{x1,y1,x2,y2,cutoff}`; render/export/UI are otherwise unchanged.

## Detail slider recalibration

The threshold now compares against **edge strength** (a between-class variance in
0..~16000 for 0–255 brightness), not `brightness×area/imageArea`. `DETAIL_MIN`/
`DETAIL_MAX` will be re-tuned empirically during implementation so the slider
spans "very coarse" → "very fine" on representative images. The inverted slider
(right = finer = lower threshold) and the cutoff-filter behaviour are unchanged.

## Performance

Per-node cost rises (barycentric sampling + one intersection per sample + binning
+ Otsu) vs. the old single mean. Mitigations: the stride cap bounds samples per
node; few bins (≈24); Otsu is O(bins). Net build cost may be ~2–3× per node, but
edge-following typically needs **fewer** triangles for equivalent perceived
quality (flat areas stay coarse), and it runs in the worker. Build time will be
measured during verification; if needed, `DETAIL_MIN` (the build floor) is the
lever.

## Testing

- **Geometry:** general-triangle area via cross product matches known values for
  non-right triangles; `longestEdge` picks the longest; min-angle test correct;
  `raySegmentParam` returns the right crossing parameter.
- **Analysis (`analyzeTriangle`):**
  - A triangle straddling a brightness step → `splitParam` lands at the step
    (within a bin) and `score` is high.
  - A uniform triangle → `score ≈ 0` (→ will not subdivide).
  - The chosen split never produces a child angle < `MIN_ANGLE`.
  - Sampling stays within image bounds (no NaN) for edge-touching triangles.
- **Generator:**
  - Edge-strength criterion subdivides edges, leaves flats coarse.
  - Cutoffs are monotone non-increasing parent→child.
  - **Filtering equivalence preserved:** segments with `cutoff ≥ T` equal a fresh
    build at threshold `T`, for several `T`.
  - Termination + `maxNodes` respected.
- **Manual / agent-browser:** edges traced on the sample images; flat regions
  coarse; no slivers; detail slider flicker-free across its range; colour changes
  never trigger a rebuild; webcam still works; PNG/SVG export correct; build time
  acceptable; heap bounded.

## Risks / Notes

- **Monotone cutoff is essential** — without it, the detail slider would show
  floating/orphan segments at intermediate thresholds. Covered by the
  filtering-equivalence test.
- **Slivers** — the `MIN_ANGLE` clamp on the split range is the guard; tested
  directly.
- **Threshold scale change** is a breaking recalibration of the Detail slider;
  re-tune `DETAIL_MIN/MAX` before sign-off.
- **Determinism** — sampling, binning, Otsu, and tie-breaks are all deterministic,
  so builds remain reproducible (required by the cutoff model and tests).
