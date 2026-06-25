# Adaptive Edge-Following Triangulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the right-angle / luminosity×area subdivision with adaptive triangulation that splits a triangle's longest edge at the point of strongest brightness change (1-D Otsu), stopping where triangles become uniform — so triangle edges follow image contours and density follows detail.

**Architecture:** New `analyzeTriangle` samples a triangle (barycentric), maps each sample to a fan coordinate `u` along the longest edge, and runs 1-D Otsu to get the best split point and an edge-strength score. The generator subdivides while edge strength ≥ threshold, cutting at the Otsu point; segment cutoffs are capped to the parent's so the flicker-free detail filter still equals a fresh rebuild. Triangles become general (no right-angle assumption), so geometry/area/sampling are generalized. Colour→polarity coupling is removed (contrast is symmetric).

**Tech Stack:** Svelte 5 + Vite + TypeScript, Web Worker, Vitest.

## Global Constraints

- Engine stays pure TS (no DOM); runs under Vitest (Node) and in the worker.
- Subdivision criterion is **pure edge strength** (Otsu between-class variance); **no area term** (per decision — revisit later if hard edges look too busy).
- Cut = cevian from the vertex opposite the longest edge to a point on it; produces exactly two triangles sharing one new segment.
- Split point chosen by **max between-class brightness variance** (objective A), constrained so neither child has an interior angle below `MIN_ANGLE_DEG = 10`.
- Segment cutoff = `min(parentCutoff, edgeStrength)` (monotone, non-increasing down the tree). Border/diagonal seed segments = `Infinity`.
- Filtering segments by `cutoff ≥ T` MUST equal a fresh build at threshold `T` (tested).
- Sampling clamps to image bounds (no NaN); deterministic throughout.
- `maxNodes` safety bound retained (default `1_000_000`); `minArea` default `1`.
- Remove `subdivideOn`/polarity from the subdivision path, worker protocol, Canvas, and webcam options. Colours become cosmetic (a colour change is a redraw, never a rebuild).
- Commit after every task.

---

## File Structure

```
src/lib/engine/
  geometry.ts    # MODIFY: + cross, triangleArea, longestEdge, triangleMinAngleDeg, raySegmentParam
  analysis.ts    # NEW: ImageLike (moved here), analyzeTriangle() + Otsu + sampling
  brightness.ts  # DELETED in Task 6 (role replaced by analysis.ts)
  tree.ts        # MODIFY: general-triangle area; inheritedCutoff field; splitTriangle(s)
  generator.ts   # MODIFY: edge-strength criterion, monotone cutoff, longest-edge cut; drop subdivideOn
  polarity.ts    # DELETED in Task 6
src/lib/worker/
  protocol.ts            # MODIFY: LoadOptions = { threshold }
  generator.worker.ts    # MODIFY: pass through new opts
  generatorClient.ts     # MODIFY: import ImageLike from analysis; new opts
src/lib/
  constants.ts   # MODIFY: recalibrate DETAIL_MIN/MAX + WEBCAM_THRESHOLD; drop WEBCAM_MAX_SAMPLES
  components/Canvas.svelte  # MODIFY: drop polarity; colour change = redraw; new opts
  webcam.ts      # MODIFY: import ImageLike from analysis
  image/loadImage.ts  # MODIFY: import ImageLike from analysis
```

---

## Task 1: Geometry helpers for general triangles

**Files:**
- Modify: `src/lib/engine/geometry.ts`
- Modify: `src/lib/engine/geometry.test.ts`

**Interfaces:**
- Produces:
  - `cross(a: Point, b: Point): number`
  - `triangleArea(a: Point, b: Point, c: Point): number`
  - `longestEdge(a: Point, b: Point, c: Point): { v: Point; e0: Point; e1: Point }` — `v` is the vertex opposite the longest edge; `e0,e1` are that edge's endpoints (deterministic tie-break: first longest in order AB, BC, CA).
  - `triangleMinAngleDeg(a: Point, b: Point, c: Point): number` — smallest interior angle in degrees.
  - `raySegmentParam(v: Point, x: Point, e0: Point, e1: Point): number` — parameter `u∈[0,1]` (clamped) where ray `v→x` crosses segment `e0→e1`.

- [ ] **Step 1: Write failing tests** (append to `geometry.test.ts`)

```ts
import { cross, triangleArea, longestEdge, triangleMinAngleDeg, raySegmentParam } from "./geometry";

test("triangleArea via cross product (non-right triangle)", () => {
  // triangle (0,0),(4,0),(1,3) -> area = |4*3|/2 = 6
  expect(triangleArea({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 3 })).toBeCloseTo(6);
});
test("cross product sign", () => {
  expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
});
test("longestEdge returns opposite vertex + edge", () => {
  // right triangle legs 3,4 hypotenuse 5 between B(3,0) and C(0,4); opposite vertex A(0,0)
  const r = longestEdge({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 });
  expect(r.v).toEqual({ x: 0, y: 0 });
  const ends = [r.e0, r.e1];
  expect(ends).toContainEqual({ x: 3, y: 0 });
  expect(ends).toContainEqual({ x: 0, y: 4 });
});
test("triangleMinAngleDeg of a 3-4-5 right triangle is ~36.87", () => {
  expect(triangleMinAngleDeg({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 })).toBeCloseTo(36.87, 1);
});
test("raySegmentParam finds the crossing point", () => {
  // V at (0,0), X toward the midpoint of edge (2,2)-(2,-2) -> crosses at u=0.5
  const u = raySegmentParam({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 2 }, { x: 2, y: -2 });
  expect(u).toBeCloseTo(0.5, 5);
});
```

- [ ] **Step 2: Run, expect fail** — `npx vitest run geometry` → FAIL.

- [ ] **Step 3: Implement** (append to `geometry.ts`)

```ts
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;

export function triangleArea(a: Point, b: Point, c: Point): number {
  return Math.abs(cross(sub(b, a), sub(c, a))) / 2;
}

export function longestEdge(a: Point, b: Point, c: Point): { v: Point; e0: Point; e1: Point } {
  const ab = mag(sub(b, a));
  const bc = mag(sub(c, b));
  const ca = mag(sub(a, c));
  if (ab >= bc && ab >= ca) return { v: c, e0: a, e1: b };
  if (bc >= ab && bc >= ca) return { v: a, e0: b, e1: c };
  return { v: b, e0: c, e1: a };
}

export function triangleMinAngleDeg(a: Point, b: Point, c: Point): number {
  const angle = (p: Point, q: Point, r: Point): number => {
    const u = sub(q, p);
    const v = sub(p, r); // angle at p between edges p->q and p->r uses (q-p) and (r-p)
    const m = mag(sub(q, p)) * mag(sub(r, p));
    if (m === 0) return 0;
    const cosA = dot(sub(q, p), sub(r, p)) / m;
    return (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
    void u; void v;
  };
  return Math.min(angle(a, b, c), angle(b, a, c), angle(c, a, b));
}

export function raySegmentParam(v: Point, x: Point, e0: Point, e1: Point): number {
  // Solve v + t*(x-v) = e0 + u*(e1-e0) for u.
  const d = sub(x, v);
  const e = sub(e1, e0);
  const denom = cross(d, e);
  if (denom === 0) return 0.5; // parallel: fall back to midpoint
  const u = cross(sub(e0, v), d) / -denom; // derived from the 2x2 solve
  return u < 0 ? 0 : u > 1 ? 1 : u;
}
```
(Note: the `angle` helper computes the interior angle at the first argument. The `void u; void v;` lines are dead — remove them; they are shown only to flag not to leave unused locals. Final code: compute `cosA` directly as above without `u`/`v`.)

Clean `triangleMinAngleDeg` (final form, no dead locals):
```ts
export function triangleMinAngleDeg(a: Point, b: Point, c: Point): number {
  const angleAt = (p: Point, q: Point, r: Point): number => {
    const m = mag(sub(q, p)) * mag(sub(r, p));
    if (m === 0) return 0;
    const cosA = dot(sub(q, p), sub(r, p)) / m;
    return (Math.acos(Math.max(-1, Math.min(1, cosA))) * 180) / Math.PI;
  };
  return Math.min(angleAt(a, b, c), angleAt(b, a, c), angleAt(c, a, b));
}
```

- [ ] **Step 4: Verify `raySegmentParam` sign with the test** — `npx vitest run geometry`. If the crossing test fails by sign, the correct solve is `u = cross(sub(v, e0), d) / cross(e, d)`; adjust to whichever makes the `u=0.5` test pass, then re-run. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add general-triangle geometry helpers"`

---

## Task 2: General-triangle area + longest-edge split on TreeNode

**Files:**
- Modify: `src/lib/engine/tree.ts`
- Modify: `src/lib/engine/tree.test.ts`

**Interfaces:**
- Consumes: `triangleArea`, `longestEdge`, `add`, `scale`, `sub` from `./geometry`.
- Produces:
  - `TreeNode.area` works for any triangle (cross product) and the seed rectangle.
  - `TreeNode.inheritedCutoff: number` (default `Infinity`).
  - `TreeNode.splitTriangle(s: number): { children: TreeNode[]; segments: Segment[] }` — splits the longest edge at parameter `s`; children are `(v,e0,m)` and `(v,m,e1)` with `m = e0 + s·(e1−e0)`; emits the cevian `v→m` (placeholder `cutoff: Infinity`, set by the generator).
  - `divideRectangle()`, `createImageRectangle`, `rectangleBorderSegments` unchanged.

- [ ] **Step 1: Write failing tests** (append to `tree.test.ts`)

```ts
import { triangleArea } from "./geometry";

test("triangle area is correct for a non-right child", () => {
  // build a general triangle node and compare to triangleArea
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const split = tri.splitTriangle(0.5);
  const child = split.children[0];
  const [a, b, c] = child.points;
  expect(child.area).toBeCloseTo(triangleArea(a, b, c));
});
test("splitTriangle emits one cevian and two children", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const { children, segments } = tri.splitTriangle(0.5);
  expect(children.length).toBe(2);
  expect(segments.length).toBe(1);
});
test("split point sits on the longest edge at s", () => {
  // longest edge midpoint at s=0.5 is shared by both children (the new vertex m)
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const { children } = tri.splitTriangle(0.5);
  // m is points[2] of child0 and points[1] of child1 by construction
  expect(children[0].points[2]).toEqual(children[1].points[1]);
});
test("inheritedCutoff defaults to Infinity", () => {
  const r = createImageRectangle(100, 80);
  expect(r.inheritedCutoff).toBe(Infinity);
});
```

- [ ] **Step 2: Run, expect fail** — `npx vitest run tree` → FAIL.

- [ ] **Step 3: Implement** — update `tree.ts`:

Replace the imports line and the `area` getter, remove `divideTriangle`/`divide`, add `inheritedCutoff` + `splitTriangle`:

```ts
import { add, mag, scale, sub, triangleArea, longestEdge, type Point, type Segment } from "./geometry";

export class TreeNode {
  parent: TreeNode | null;
  points: Point[];
  children: TreeNode[] = [];
  depth: number;
  inheritedCutoff = Infinity;

  constructor(parent: TreeNode | null, points: Point[]) {
    this.parent = parent;
    this.points = points;
    this.depth = 1 + (parent?.depth ?? 0);
  }

  get area(): number {
    const p = this.points;
    if (p.length === 3) return triangleArea(p[0], p[1], p[2]);
    return mag(sub(p[1], p[0])) * mag(sub(p[3], p[0])); // rectangle
  }

  divideRectangle(): { children: TreeNode[]; segments: Segment[] } {
    const p = this.points;
    this.children = [
      new TreeNode(this, [p[1], p[2], p[0]]),
      new TreeNode(this, [p[3], p[0], p[2]]),
    ];
    const seg: Segment = { x1: p[0].x, y1: p[0].y, x2: p[2].x, y2: p[2].y, cutoff: Infinity };
    return { children: this.children, segments: [seg] };
  }

  splitTriangle(s: number): { children: TreeNode[]; segments: Segment[] } {
    const p = this.points;
    const { v, e0, e1 } = longestEdge(p[0], p[1], p[2]);
    const m = add(e0, scale(sub(e1, e0), s));
    this.children = [new TreeNode(this, [v, e0, m]), new TreeNode(this, [v, m, e1])];
    const seg: Segment = { x1: v.x, y1: v.y, x2: m.x, y2: m.y, cutoff: Infinity };
    return { children: this.children, segments: [seg] };
  }
}
```
Keep `createRectangle`, `createImageRectangle`, `rectangleBorderSegments` as they are. Remove the now-unused `dot`, `normalize` imports if no longer referenced.

- [ ] **Step 4: Run, expect pass** — `npx vitest run tree` → PASS. (Generator still imports the old API; it's updated in Task 4. If `npm run check` fails on generator here, that's expected and fixed in Task 4 — only run the `tree`/`geometry` vitest now.)

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Generalize TreeNode area + longest-edge split"`

---

## Task 3: analyzeTriangle (sampling + fan-u + Otsu)

**Files:**
- Create: `src/lib/engine/analysis.ts`
- Create: `src/lib/engine/analysis.test.ts`
- Modify: `src/lib/engine/brightness.ts` (re-export `ImageLike` from analysis to keep current importers compiling until Task 6)

**Interfaces:**
- Consumes: `Point`, `triangleArea`, `longestEdge`, `triangleMinAngleDeg`, `raySegmentParam`, `add`, `scale`, `sub` from `./geometry`.
- Produces:
  - `type ImageLike = { data: Uint8ClampedArray | number[]; width: number; height: number }`
  - `type TriangleAnalysis = { score: number; splitParam: number }`
  - `analyzeTriangle(img: ImageLike, points: Point[], minArea?: number): TriangleAnalysis | null` — returns the best split (max between-class brightness variance along the longest-edge fan, respecting `MIN_ANGLE_DEG`) and its `score` (edge strength), or `null` if too small/degenerate or no valid split exists.

- [ ] **Step 1: Write failing tests** (`analysis.test.ts`)

```ts
import { test, expect } from "vitest";
import { analyzeTriangle, type ImageLike } from "./analysis";

function halfSplit(w: number, h: number, edgeX: number): ImageLike {
  // left of edgeX is black, right is white -> a vertical edge
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = x >= edgeX ? 255 : 0;
      const i = (y * w + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

test("uniform triangle has ~zero edge strength", () => {
  const w = 200, h = 200;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const a = analyzeTriangle({ data, width: w, height: h }, [
    { x: 0, y: 0 }, { x: 199, y: 0 }, { x: 0, y: 199 },
  ]);
  expect(a).not.toBeNull();
  expect(a!.score).toBeLessThan(1);
});

test("triangle over a vertical edge yields high score and a split near the edge", () => {
  const w = 200, h = 200;
  const img = halfSplit(w, h, 100);
  // triangle spanning the edge; longest edge is the bottom (0,0)-(199,0)
  const a = analyzeTriangle(img, [{ x: 100, y: 180 }, { x: 0, y: 0 }, { x: 199, y: 0 }]);
  expect(a).not.toBeNull();
  expect(a!.score).toBeGreaterThan(1000);
  // split param along the bottom edge should be near x=100 -> u ~ 0.5
  expect(a!.splitParam).toBeGreaterThan(0.35);
  expect(a!.splitParam).toBeLessThan(0.65);
});

test("returns null for a sub-minArea triangle", () => {
  const img = halfSplit(50, 50, 25);
  const a = analyzeTriangle(img, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 100);
  expect(a).toBeNull();
});
```

- [ ] **Step 2: Run, expect fail** — `npx vitest run analysis` → FAIL.

- [ ] **Step 3: Implement `analysis.ts`**

```ts
import {
  add, scale, sub, triangleArea, longestEdge, triangleMinAngleDeg, raySegmentParam,
  type Point,
} from "./geometry";

export type ImageLike = { data: Uint8ClampedArray | number[]; width: number; height: number };
export type TriangleAnalysis = { score: number; splitParam: number };

const BINS = 24;
const MAX_STRIDE = 3;
const MIN_ANGLE_DEG = 10;

function sign(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}

export function analyzeTriangle(
  img: ImageLike,
  points: Point[],
  minArea = 1,
): TriangleAnalysis | null {
  const [A, B, C] = points;
  const area = triangleArea(A, B, C);
  if (area < minArea) return null;

  const { v, e0, e1 } = longestEdge(A, B, C);
  const { data, width, height } = img;
  const maxX = width - 1, maxY = height - 1;

  // Bounding box of the triangle.
  const minBx = Math.max(0, Math.floor(Math.min(A.x, B.x, C.x)));
  const maxBx = Math.min(maxX, Math.ceil(Math.max(A.x, B.x, C.x)));
  const minBy = Math.max(0, Math.floor(Math.min(A.y, B.y, C.y)));
  const maxBy = Math.min(maxY, Math.ceil(Math.max(A.y, B.y, C.y)));

  let stride = Math.round(Math.sqrt(area / 64));
  if (stride > MAX_STRIDE) stride = MAX_STRIDE;
  if (stride < 1) stride = 1;

  const binCount = new Float64Array(BINS);
  const binSum = new Float64Array(BINS);
  let total = 0;
  let totalSum = 0;

  for (let y = minBy; y <= maxBy; y += stride) {
    for (let x = minBx; x <= maxBx; x += stride) {
      // point-in-triangle (allow boundary)
      const d1 = sign(x, y, A.x, A.y, B.x, B.y);
      const d2 = sign(x, y, B.x, B.y, C.x, C.y);
      const d3 = sign(x, y, C.x, C.y, A.x, A.y);
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
      if (hasNeg && hasPos) continue; // outside

      const idx = (y * width + x) * 4;
      const b = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      let u = raySegmentParam(v, { x, y }, e0, e1);
      let k = Math.floor(u * BINS);
      if (k >= BINS) k = BINS - 1;
      if (k < 0) k = 0;
      binCount[k]++;
      binSum[k] += b;
      total++;
      totalSum += b;
    }
  }
  if (total < 2) return null;

  // 1-D Otsu over bins, restricted to splits whose child triangles keep angles >= MIN_ANGLE_DEG.
  let leftCount = 0, leftSum = 0;
  let bestScore = -1, bestS = 0.5;
  for (let k = 0; k < BINS - 1; k++) {
    leftCount += binCount[k];
    leftSum += binSum[k];
    const rightCount = total - leftCount;
    if (leftCount === 0 || rightCount === 0) continue;
    const s = (k + 1) / BINS;
    const m = add(e0, scale(sub(e1, e0), s));
    if (
      triangleMinAngleDeg(v, e0, m) < MIN_ANGLE_DEG ||
      triangleMinAngleDeg(v, m, e1) < MIN_ANGLE_DEG
    )
      continue;
    const m1 = leftSum / leftCount;
    const m2 = (totalSum - leftSum) / rightCount;
    const w1 = leftCount / total, w2 = rightCount / total;
    const score = w1 * w2 * (m1 - m2) * (m1 - m2);
    if (score > bestScore) {
      bestScore = score;
      bestS = s;
    }
  }
  if (bestScore < 0) return null; // no valid split (too thin)
  return { score: bestScore, splitParam: bestS };
}
```

- [ ] **Step 4: Run, expect pass** — `npx vitest run analysis` → PASS. (If `splitParam` is off, confirm `raySegmentParam` orientation from Task 1.)

- [ ] **Step 5: Keep current importers compiling** — edit `brightness.ts`: at the top replace its `ImageLike` definition with a re-export so existing imports keep working until Task 6:

```ts
export type { ImageLike } from "./analysis";
```
Leave the rest of `brightness.ts` (the `getAverageBrightnessInTriangle` function) intact for now; the generator still uses it until Task 4. (Remove the old local `ImageLike` declaration.)

- [ ] **Step 6: Typecheck + commit** — `npm run check` → 0 errors; `git add -A && git commit -m "Add analyzeTriangle: Otsu split + edge-strength score"`

---

## Task 4: Generator — edge-strength criterion + monotone cutoff

**Files:**
- Modify: `src/lib/engine/generator.ts`
- Modify: `src/lib/engine/generator.test.ts`

**Interfaces:**
- Consumes: `analyzeTriangle`, `ImageLike` from `./analysis`; `TreeNode`, `createImageRectangle`, `rectangleBorderSegments` from `./tree`; `Segment` from `./geometry`.
- Produces:
  - `type GeneratorOptions = { threshold: number; maxNodes?: number; minArea?: number }` (no `subdivideOn`, no `maxSamples`; remove `SubdivideOn` export).
  - `TriangleGenerator.reset(img, opts)` / `step(n)` / `segments` / `done` unchanged in shape; new internal logic.

- [ ] **Step 1: Update tests** in `generator.test.ts` — replace `subdivideOn` usage and the polarity test. Use an image with a real edge so subdivision happens:

```ts
import { test, expect } from "vitest";
import { TriangleGenerator } from "./generator";
import type { ImageLike } from "./analysis";

function edgeImage(w: number, h: number): ImageLike {
  // left third black, rest white -> one strong vertical edge
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = x < w / 3 ? 0 : 255;
      const i = (y * w + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

test("starts with 4 border segments after reset", () => {
  const g = new TriangleGenerator();
  g.reset(edgeImage(128, 128), { threshold: 50 });
  expect(g.segments.length).toBe(4);
  expect(g.done).toBe(false);
});

test("terminates and is deterministic", () => {
  const run = () => {
    const g = new TriangleGenerator();
    g.reset(edgeImage(128, 128), { threshold: 50 });
    let guard = 0;
    while (!g.done && guard++ < 1_000_000) g.step(2000);
    expect(g.done).toBe(true);
    return g.segments.length;
  };
  expect(run()).toBe(run());
});

test("cutoffs are monotone non-increasing parent->child (filter == rebuild)", () => {
  const img = edgeImage(128, 128);
  const floor = 20;
  const built = new TriangleGenerator();
  built.reset(img, { threshold: floor });
  while (!built.done) built.step(4000);
  for (const T of [50, 120, 300, 800]) {
    const filtered = built.segments.filter((s) => s.cutoff >= T).length;
    const fresh = new TriangleGenerator();
    fresh.reset(img, { threshold: T });
    while (!fresh.done) fresh.step(4000);
    expect(filtered).toBe(fresh.segments.length);
  }
});

test("respects maxNodes safety bound", () => {
  const g = new TriangleGenerator();
  g.reset(edgeImage(128, 128), { threshold: 0.0001, maxNodes: 50 });
  let guard = 0;
  while (!g.done && guard++ < 1_000_000) g.step(1000);
  expect(g.done).toBe(true);
});
```

- [ ] **Step 2: Run, expect fail** — `npx vitest run generator` → FAIL (old API / subdivideOn).

- [ ] **Step 3: Rewrite `generator.ts`**

```ts
import type { Segment } from "./geometry";
import { createImageRectangle, rectangleBorderSegments, TreeNode } from "./tree";
import { analyzeTriangle, type ImageLike } from "./analysis";

export type GeneratorOptions = { threshold: number; maxNodes?: number; minArea?: number };

export class TriangleGenerator {
  segments: Segment[] = [];
  done = true;

  private img!: ImageLike;
  private opts!: Required<GeneratorOptions>;
  private frontier: TreeNode[] = [];
  private head = 0;
  private nodeCount = 0;

  reset(img: ImageLike, opts: GeneratorOptions): void {
    this.img = img;
    this.opts = { maxNodes: 1_000_000, minArea: 1, ...opts };
    const root = createImageRectangle(img.width, img.height);
    root.inheritedCutoff = Infinity;
    this.frontier = [root];
    this.head = 0;
    this.nodeCount = 1;
    this.segments = rectangleBorderSegments(root); // cutoff Infinity
    this.done = false;
  }

  step(n: number): Segment[] {
    const emitted: Segment[] = [];
    let processed = 0;
    while (processed < n && this.head < this.frontier.length) {
      if (this.nodeCount >= this.opts.maxNodes) { this.done = true; break; }
      const node = this.frontier[this.head++];
      processed++;

      if (node.points.length === 4) {
        // seed rectangle -> two triangles along the diagonal (always)
        const { children, segments } = node.divideRectangle();
        for (const c of children) c.inheritedCutoff = Infinity;
        for (const s of segments) { this.segments.push(s); emitted.push(s); }
        this.frontier.push(...children);
        this.nodeCount += children.length;
        continue;
      }

      const analysis = analyzeTriangle(this.img, node.points, this.opts.minArea);
      if (!analysis) continue; // too small / no valid split
      const effective = Math.min(node.inheritedCutoff, analysis.score);
      if (effective < this.opts.threshold) continue; // edge too weak at this detail

      const { children, segments } = node.splitTriangle(analysis.splitParam);
      for (const c of children) c.inheritedCutoff = effective;
      for (const s of segments) { s.cutoff = effective; this.segments.push(s); emitted.push(s); }
      this.frontier.push(...children);
      this.nodeCount += children.length;
    }
    if (this.head >= this.frontier.length) this.done = true;
    return emitted;
  }
}
```

- [ ] **Step 4: Run, expect pass** — `npx vitest run generator` → PASS (all incl. monotone/filter-equivalence).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Edge-strength subdivision with monotone cutoff + longest-edge cut"`

---

## Task 5: Recalibrate detail thresholds (constants)

**Files:**
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: `DETAIL_MIN`, `DETAIL_MAX`, `WEBCAM_THRESHOLD` on the **edge-strength** scale (between-class variance, ~0..16256). Remove `WEBCAM_MAX_SAMPLES`.

- [ ] **Step 1: Set initial values** (tuned visually in Task 8)

```ts
export const DETAIL_MIN = 8; // finest (lowest edge-strength still subdivides)
export const DETAIL_MAX = 1200; // coarsest

// Cap the long edge of any loaded still image ...
export const IMAGE_MAX_EDGE = 1600;

export const BUILD_BATCH = 1200;

export const WEBCAM_MAX_EDGE = 800;
export const WEBCAM_THRESHOLD = 400; // coarser detail for smooth live frames
```
(Remove the `WEBCAM_MAX_SAMPLES` line.)

- [ ] **Step 2: Typecheck** — `npm run check` will still error on `WEBCAM_MAX_SAMPLES`/`subdivideOn` references until Task 6; that's expected. Just confirm the file parses (`npx tsc --noEmit src/lib/constants.ts` is not meaningful in isolation — skip, proceed).
- [ ] **Step 3: Commit** — `git add -A && git commit -m "Recalibrate detail thresholds to edge-strength scale"`

---

## Task 6: Remove polarity + rewire worker/Canvas/webcam; delete brightness.ts

**Files:**
- Delete: `src/lib/engine/polarity.ts`, `src/lib/engine/polarity.test.ts`, `src/lib/engine/brightness.ts`, `src/lib/engine/brightness.test.ts`
- Modify: `src/lib/worker/protocol.ts`, `src/lib/worker/generator.worker.ts`, `src/lib/worker/generatorClient.ts`
- Modify: `src/lib/components/Canvas.svelte`
- Modify: `src/lib/webcam.ts`, `src/lib/image/loadImage.ts`

**Interfaces:**
- `LoadOptions = { threshold: number }` (drop `subdivideOn`, `maxSamples`).
- All `ImageLike` imports now come from `$lib/engine/analysis`.

- [ ] **Step 1: protocol.ts** — replace `LoadOptions`:

```ts
import type { Segment } from "../engine/geometry";

export type LoadOptions = { threshold: number };
```
(Remove the `SubdivideOn` import.) `WorkerRequest`/`WorkerResponse` and encode/decode unchanged.

- [ ] **Step 2: generator.worker.ts** — `gen.reset(img, { ...msg.opts })` (opts is now just `{ threshold }`). Remove the `maxSamples` spread.

- [ ] **Step 3: generatorClient.ts** — change `import type { ImageLike } from "../engine/brightness"` → `from "../engine/analysis"`. In `frame()` fallback and `load()` fallback, `g.reset(image, { ...opts })` (drop `maxSamples`).

- [ ] **Step 4: loadImage.ts + webcam.ts** — change `import type { ImageLike } from "../engine/brightness"` (loadImage) and `from "./engine/brightness"` (webcam) → `analysis`.

- [ ] **Step 5: Canvas.svelte** — remove polarity:
  - Delete `import { derivePolarity } from "$lib/engine/polarity"`.
  - Change `import type { ImageLike } from "$lib/engine/brightness"` → `"$lib/engine/analysis"`.
  - `build()` load opts: `client.load(current, { threshold: DETAIL_MIN }, (segs) => {...})`.
  - Webcam `client.frame(cap.image, { threshold: WEBCAM_THRESHOLD })`.
  - Remove `WEBCAM_MAX_SAMPLES` from the constants import.
  - Replace the reactive `$effect` (which had polarity/rebuild branches) with redraw-only, since colours are now cosmetic and threshold just filters:

```svelte
  $effect(() => {
    // Re-run whenever any display setting changes.
    void settings.threshold; void settings.lineWidth; void settings.background; void settings.line;
    if (!ctx || !current || isWebcam) return;
    redraw();
  });
```
  Remove the now-unused `last*` tracking variables.

- [ ] **Step 6: Delete files** — `git rm src/lib/engine/polarity.ts src/lib/engine/polarity.test.ts src/lib/engine/brightness.ts src/lib/engine/brightness.test.ts`

- [ ] **Step 7: Typecheck + tests** — `npm run check` → 0 errors; `npx vitest run` → all pass.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "Remove polarity/brightness; colours cosmetic; new worker opts"`

---

## Task 7: Build + worker bundle sanity

- [ ] **Step 1: Build** — `npm run build` → succeeds, worker chunk emitted.
- [ ] **Step 2: Commit (if any lockfile/asset churn)** — otherwise skip.

---

## Task 8: Integration verification + visual threshold tuning

**Files:** `src/lib/constants.ts` (tuning only).

- [ ] **Step 1: Full suite** — `npm test` → all pass.
- [ ] **Step 2: Run dev + drive with agent-browser** on the Swan / Turing / Building:
  - Confirm triangle edges follow contours; flat regions (bright AND dark) stay coarse; no slivers.
  - Detail slider: flicker-free across range; right = finer.
  - Colour change: redraws, never rebuilds (no animation restart).
  - Webcam still triangulates; freeze→still works; export PNG/SVG correct.
  - Heap bounded; build time acceptable; no console errors.
- [ ] **Step 3: Tune `DETAIL_MIN`/`DETAIL_MAX`/`WEBCAM_THRESHOLD`** by observing the slider extremes on the sample images: `DETAIL_MAX` should give a recognizable-but-coarse mesh; `DETAIL_MIN` a richly detailed one without a runaway node count. Adjust constants, re-verify, and note final values.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Tune detail thresholds; verify adaptive triangulation"`

---

## Self-Review

**Spec coverage:**
- Longest-edge cevian split → Task 2 (`splitTriangle`). ✓
- Otsu split point + edge-strength score → Task 3 (`analyzeTriangle`). ✓
- ≥10° sliver guard → Task 3 (min-angle filter on candidate splits). ✓
- Contrast-based stop (no area term) → Task 4 (criterion `effective >= threshold`). ✓
- Monotone cutoff + filtering equivalence → Task 4 (+ test). ✓
- General-triangle area/sampling → Tasks 1–3. ✓
- Colour decoupling / remove polarity → Tasks 4 (drop subdivideOn) + 6. ✓
- Threshold recalibration → Tasks 5 + 8. ✓
- Worker/render/UI continuity → Task 6; Segment shape unchanged. ✓

**Placeholder scan:** No TBD/TODO. Threshold values are concrete initial numbers with an explicit tuning task (8). The Task-1 note flags removing the dead `void` locals and gives the clean final `triangleMinAngleDeg`.

**Type consistency:** `ImageLike` defined in `analysis.ts` (Task 3), re-exported from `brightness.ts` until Task 6, then importers repointed. `TriangleAnalysis {score,splitParam}` (Task 3) consumed in Task 4. `GeneratorOptions {threshold,maxNodes?,minArea?}` (Task 4) matches worker `LoadOptions {threshold}` (Task 6, which only sets threshold). `TreeNode.inheritedCutoff` + `splitTriangle` (Task 2) used in Task 4. `longestEdge`/`raySegmentParam`/`triangleMinAngleDeg`/`triangleArea` (Task 1) used in Tasks 2–3. `Segment {…,cutoff}` unchanged.
