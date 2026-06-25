# Triangle Demo Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move generation into a Web Worker, make detail-slider changes flicker-free by tagging segments with a threshold cutoff, and add presets, more sample images, a before/after compare slider, and a continuous live webcam mode.

**Architecture:** Each segment carries the threshold `cutoff` at which its node subdivides. The worker builds once to the finest threshold (the slider floor) and streams segments; the main thread keeps all segments and renders only those with `cutoff ≥ currentThreshold`, so coarser/finer changes are pure main-thread filters — no recompute, no flicker. A typed worker client wraps the protocol and falls back to main-thread generation when workers are unavailable.

**Tech Stack:** Svelte 5 + Vite + TypeScript, Tailwind v4 + shadcn-svelte, raw Canvas 2D, Web Worker, Vitest.

## Global Constraints

- No backend, no network image hosting. App stays a static deployable site.
- Engine under `src/lib/engine/` stays pure TS (no DOM), runnable in Node (Vitest) and in a worker.
- Detail slider range is fixed: `DETAIL_MIN = 0.002`, `DETAIL_MAX = 0.05`. The worker builds to `DETAIL_MIN` (finest); the slider filters within `[DETAIL_MIN, DETAIL_MAX]`.
- `nodeCutoff = metric * area / imageArea`; a node subdivides at threshold `T` iff `area ≥ minArea && nodeCutoff ≥ T`. Border segments carry `cutoff = Infinity`.
- Filtering segments by `cutoff ≥ T` MUST equal a fresh build at threshold `T` (proven by test).
- Generator keeps `maxNodes` safety bound (default `1_000_000`) and `minArea` (default `1`).
- Algorithm itself (brightness subdivision) is unchanged. No contrast/low-poly/filled triangles.
- Sample images bundled locally (CC0 / free license) with `src/lib/samples/CREDITS.md`.
- Commit after every task.

---

## File Structure

```
src/lib/
  constants.ts              # NEW: DETAIL_MIN/MAX, build + webcam tuning constants
  engine/
    geometry.ts             # MODIFY: Segment gains `cutoff: number`
    tree.ts                 # MODIFY: emitted segments include cutoff (Infinity placeholder; generator overrides divide segments)
    generator.ts            # MODIFY: cutoff model, minArea, build-to-floor
  render/
    canvasRenderer.ts       # MODIFY: drawSegments/redrawAll filter by minCutoff
  worker/
    protocol.ts             # NEW: message types + segment encode/decode
    generator.worker.ts     # NEW: hosts TriangleGenerator, streams batches
    generatorClient.ts      # NEW: typed client + main-thread fallback
  presets.ts                # NEW: curated looks
  webcam.ts                 # NEW: getUserMedia + frame capture
  samples/                  # ADD: 3 CC0 images + CREDITS.md
  components/
    Canvas.svelte           # MODIFY: client-driven, cutoff filtering, webcam pipeline, compare
    Controls.svelte         # MODIFY: presets, webcam controls, compare toggle
    CompareSlider.svelte    # NEW: before/after wipe overlay
```

---

## Task 1: Segment cutoff + generator cutoff model

**Files:**
- Modify: `src/lib/engine/geometry.ts`
- Modify: `src/lib/engine/tree.ts`
- Modify: `src/lib/engine/generator.ts`
- Create: `src/lib/constants.ts`
- Modify: `src/lib/engine/generator.test.ts` (add cutoff tests)

**Interfaces:**
- Consumes: existing engine.
- Produces:
  - `Segment = { x1: number; y1: number; x2: number; y2: number; cutoff: number }`
  - `GeneratorOptions = { threshold: number; subdivideOn: "bright" | "dark"; maxSamples?: number; maxNodes?: number; minArea?: number }`
  - `TriangleGenerator.reset(img, opts)` builds to `opts.threshold` as the floor; `step(n)` returns newly emitted `Segment[]` (each tagged with its node's cutoff; borders `Infinity`).
  - `constants.ts`: `export const DETAIL_MIN = 0.002; export const DETAIL_MAX = 0.05;`

- [ ] **Step 1: Add cutoff tests to generator.test.ts**

```ts
test("segments carry cutoff; borders are Infinity", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.002, subdivideOn: "bright" });
  // first 4 segments are the border
  expect(g.segments.slice(0, 4).every((s) => s.cutoff === Infinity)).toBe(true);
  while (!g.done) g.step(500);
  expect(g.segments.every((s) => Number.isFinite(s.cutoff) || s.cutoff === Infinity)).toBe(true);
});

test("filtering by cutoff equals a fresh build at that threshold", () => {
  const img = gradient(80, 80);
  const floor = 0.002;
  const built = new TriangleGenerator();
  built.reset(img, { threshold: floor, subdivideOn: "bright" });
  while (!built.done) built.step(1000);

  for (const T of [0.005, 0.01, 0.02, 0.04]) {
    const filtered = built.segments.filter((s) => s.cutoff >= T).length;
    const fresh = new TriangleGenerator();
    fresh.reset(img, { threshold: T, subdivideOn: "bright" });
    while (!fresh.done) fresh.step(1000);
    expect(filtered).toBe(fresh.segments.length);
  }
});
```

- [ ] **Step 2: Run, expect fail** — `npx vitest run generator` → FAIL (cutoff undefined / mismatch).

- [ ] **Step 3: Add cutoff to Segment** in `geometry.ts`:

```ts
export type Segment = { x1: number; y1: number; x2: number; y2: number; cutoff: number };
```

- [ ] **Step 4: Set cutoff in tree.ts segments**

In `divideRectangle`, `divideTriangle`, and `rectangleBorderSegments`, add `cutoff: Infinity` to each emitted segment object. (The generator overrides the divide-segment cutoff; borders stay `Infinity`.) Example for the rectangle diagonal:

```ts
const seg: Segment = { x1: p[0].x, y1: p[0].y, x2: p[2].x, y2: p[2].y, cutoff: Infinity };
```
Apply the same `cutoff: Infinity` addition to the triangle bisector segment and to each segment built in `rectangleBorderSegments`.

- [ ] **Step 5: Rewrite generator step() with the cutoff model**

Replace the body of `step` and add `minArea` to options in `reset`:

```ts
reset(img: ImageLike, opts: GeneratorOptions): void {
  this.img = img;
  this.opts = { maxSamples: 10, maxNodes: 1_000_000, minArea: 1, ...opts };
  this.imageArea = img.width * img.height;
  const root = createImageRectangle(img.width, img.height);
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
    if (node.area < this.opts.minArea) continue;

    const brightness = getAverageBrightnessInTriangle(this.img, node.points, this.opts.maxSamples);
    const metric = this.opts.subdivideOn === "bright" ? brightness : 255 - brightness;
    const cutoff = (metric * node.area) / this.imageArea;
    if (cutoff < this.opts.threshold) continue;

    const { children, segments } = node.divide();
    for (const s of segments) {
      s.cutoff = cutoff;
      this.segments.push(s);
      emitted.push(s);
    }
    this.frontier.push(...children);
    this.nodeCount += children.length;
  }
  if (this.head >= this.frontier.length) this.done = true;
  return emitted;
}
```

Also update the `GeneratorOptions` type and the `opts` field type to include `minArea?: number`.

- [ ] **Step 6: Create constants.ts**

```ts
export const DETAIL_MIN = 0.002;
export const DETAIL_MAX = 0.05;

// Build pacing (segments drawn per animation frame on the main thread).
export const BUILD_BATCH = 1200;

// Webcam tuning.
export const WEBCAM_MAX_EDGE = 480; // cap long edge for performance
export const WEBCAM_THRESHOLD = 0.02; // coarser detail for smooth live frames
export const WEBCAM_MAX_SAMPLES = 6;
```

- [ ] **Step 7: Run, expect pass** — `npx vitest run` → all pass (existing + new).
- [ ] **Step 8: Commit** — `git add -A && git commit -m "Add segment cutoff model for flicker-free detail changes"`

---

## Task 2: Renderer filters by cutoff

**Files:**
- Modify: `src/lib/render/canvasRenderer.ts`

**Interfaces:**
- Produces:
  - `drawSegments(ctx, segments, style, minCutoff?: number)` — strokes only segments with `cutoff >= minCutoff` (default `-Infinity`).
  - `redrawAll(ctx, segments, style, minCutoff?: number)` — clear + filtered draw.

- [ ] **Step 1: Update canvasRenderer.ts**

```ts
export function drawSegments(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  style: RenderStyle,
  minCutoff = -Infinity,
): void {
  ctx.strokeStyle = style.line;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const s of segments) {
    if (s.cutoff < minCutoff) continue;
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();
}

export function redrawAll(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  style: RenderStyle,
  minCutoff = -Infinity,
): void {
  clearCanvas(ctx, style);
  drawSegments(ctx, segments, style, minCutoff);
}
```

- [ ] **Step 2: Typecheck** — `npm run check` → 0 errors.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "Filter rendered segments by cutoff threshold"`

---

## Task 3: Worker protocol, worker, and client (with fallback)

**Files:**
- Create: `src/lib/worker/protocol.ts`
- Create: `src/lib/worker/generator.worker.ts`
- Create: `src/lib/worker/generatorClient.ts`
- Create: `src/lib/worker/protocol.test.ts`

**Interfaces:**
- Consumes: `TriangleGenerator`, `GeneratorOptions`, `Segment`, `ImageLike`.
- Produces:
  - `encodeSegments(segments: Segment[]): Float32Array` and `decodeSegments(arr: Float32Array): Segment[]` (5 floats per segment: `x1,y1,x2,y2,cutoff`).
  - `type LoadOptions = { subdivideOn: "bright" | "dark"; threshold: number; maxSamples?: number }`
  - `class GeneratorClient { load(image: ImageLike, opts: LoadOptions, onBatch: (segs: Segment[], done: boolean) => void): void; frame(image: ImageLike, opts: LoadOptions): Promise<Segment[]>; dispose(): void }`
  - The client bumps a monotonic `id` per request and ignores responses with stale ids.

- [ ] **Step 1: Write protocol encode/decode test**

```ts
import { test, expect } from "vitest";
import { encodeSegments, decodeSegments } from "./protocol";

test("segments round-trip through Float32Array", () => {
  const segs = [
    { x1: 1, y1: 2, x2: 3, y2: 4, cutoff: 0.5 },
    { x1: 5, y1: 6, x2: 7, y2: 8, cutoff: Infinity },
  ];
  const back = decodeSegments(encodeSegments(segs));
  expect(back.length).toBe(2);
  expect(back[0]).toEqual(segs[0]);
  expect(back[1].cutoff).toBe(Infinity);
});
```

- [ ] **Step 2: Run, expect fail** — `npx vitest run protocol` → FAIL.

- [ ] **Step 3: Implement protocol.ts**

```ts
import type { Segment } from "../engine/geometry";
import type { SubdivideOn } from "../engine/generator";

export type LoadOptions = { subdivideOn: SubdivideOn; threshold: number; maxSamples?: number };

export type WorkerRequest =
  | { type: "load"; id: number; width: number; height: number; buffer: ArrayBuffer; opts: LoadOptions; batch: number }
  | { type: "frame"; id: number; width: number; height: number; buffer: ArrayBuffer; opts: LoadOptions };

export type WorkerResponse = { type: "segments"; id: number; buffer: ArrayBuffer; done: boolean };

export function encodeSegments(segments: Segment[]): Float32Array {
  const arr = new Float32Array(segments.length * 5);
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const o = i * 5;
    arr[o] = s.x1; arr[o + 1] = s.y1; arr[o + 2] = s.x2; arr[o + 3] = s.y2; arr[o + 4] = s.cutoff;
  }
  return arr;
}

export function decodeSegments(arr: Float32Array): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < arr.length; i += 5) {
    out.push({ x1: arr[i], y1: arr[i + 1], x2: arr[i + 2], y2: arr[i + 3], cutoff: arr[i + 4] });
  }
  return out;
}
```
(`Float32Array` preserves `Infinity`, verified by the test.)

- [ ] **Step 4: Implement generator.worker.ts**

```ts
import { TriangleGenerator } from "../engine/generator";
import { encodeSegments, type WorkerRequest, type WorkerResponse } from "./protocol";

const gen = new TriangleGenerator();

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  const img = { data: new Uint8ClampedArray(msg.buffer), width: msg.width, height: msg.height };
  gen.reset(img, { ...msg.opts, maxSamples: msg.opts.maxSamples ?? 10 });

  if (msg.type === "frame") {
    while (!gen.done) gen.step(5000);
    const enc = encodeSegments(gen.segments);
    post({ type: "segments", id: msg.id, buffer: enc.buffer, done: true }, enc.buffer);
    return;
  }

  // load: stream batches so the main thread can animate the build
  const pump = () => {
    const fresh = gen.step(msg.batch);
    const enc = encodeSegments(fresh);
    post({ type: "segments", id: msg.id, buffer: enc.buffer, done: gen.done }, enc.buffer);
    if (!gen.done) setTimeout(pump, 0);
  };
  pump();
};

function post(res: WorkerResponse, transfer: ArrayBuffer) {
  (self as unknown as Worker).postMessage(res, [transfer]);
}
```

- [ ] **Step 5: Implement generatorClient.ts (with main-thread fallback)**

```ts
import type { ImageLike } from "../engine/brightness";
import type { Segment } from "../engine/geometry";
import { TriangleGenerator } from "../engine/generator";
import { encodeSegments, decodeSegments, type LoadOptions, type WorkerRequest, type WorkerResponse } from "./protocol";

type BatchCb = (segs: Segment[], done: boolean) => void;

export class GeneratorClient {
  private worker: Worker | null = null;
  private id = 0;
  private loadCbs = new Map<number, BatchCb>();
  private frameResolvers = new Map<number, (s: Segment[]) => void>();
  private fallback: TriangleGenerator | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    try {
      this.worker = new Worker(new URL("./generator.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data);
      this.worker.onerror = () => { this.worker = null; }; // fall back on runtime error
    } catch {
      this.worker = null;
    }
  }

  private onMessage(res: WorkerResponse) {
    const segs = decodeSegments(new Float32Array(res.buffer));
    const frameResolve = this.frameResolvers.get(res.id);
    if (frameResolve) { this.frameResolvers.delete(res.id); frameResolve(segs); return; }
    const cb = this.loadCbs.get(res.id);
    if (!cb) return; // stale
    cb(segs, res.done);
    if (res.done) this.loadCbs.delete(res.id);
  }

  load(image: ImageLike, opts: LoadOptions, onBatch: BatchCb): void {
    const id = ++this.id;
    this.loadCbs.clear(); // supersede prior loads
    this.cancelFallback();
    if (this.worker) {
      this.loadCbs.set(id, onBatch);
      const buf = toBuffer(image);
      const req: WorkerRequest = { type: "load", id, width: image.width, height: image.height, buffer: buf, opts, batch: 1200 };
      this.worker.postMessage(req, [buf]);
    } else {
      this.runFallback(image, opts, onBatch);
    }
  }

  frame(image: ImageLike, opts: LoadOptions): Promise<Segment[]> {
    const id = ++this.id;
    if (this.worker) {
      const buf = toBuffer(image);
      return new Promise((resolve) => {
        this.frameResolvers.set(id, resolve);
        const req: WorkerRequest = { type: "frame", id, width: image.width, height: image.height, buffer: buf, opts };
        this.worker!.postMessage(req, [buf]);
      });
    }
    const g = new TriangleGenerator();
    g.reset(image, { ...opts, maxSamples: opts.maxSamples ?? 10 });
    while (!g.done) g.step(5000);
    return Promise.resolve(g.segments.map((s) => ({ ...s })));
  }

  private runFallback(image: ImageLike, opts: LoadOptions, onBatch: BatchCb) {
    const g = new TriangleGenerator();
    g.reset(image, { ...opts, maxSamples: opts.maxSamples ?? 10 });
    this.fallback = g;
    onBatch(g.segments.slice(), false); // border
    const pump = () => {
      const fresh = g.step(1200);
      onBatch(fresh, g.done);
      if (!g.done) this.fallbackTimer = setTimeout(pump, 0);
    };
    this.fallbackTimer = setTimeout(pump, 0);
  }

  private cancelFallback() {
    if (this.fallbackTimer) { clearTimeout(this.fallbackTimer); this.fallbackTimer = null; }
    this.fallback = null;
  }

  dispose() {
    this.cancelFallback();
    this.worker?.terminate();
    this.worker = null;
  }
}

function toBuffer(image: ImageLike): ArrayBuffer {
  // Copy into a fresh transferable ArrayBuffer (source may be a view we keep).
  const src = image.data instanceof Uint8ClampedArray ? image.data : new Uint8ClampedArray(image.data);
  return src.slice().buffer;
}
```

Note: in the worker `load` path, the first `step` call after `reset` returns only newly-emitted (non-border) segments, so the border (set in `reset`) must also reach the client. Fix by having the worker send the border first:

```ts
// in worker, before pump() for the "load" branch:
const border = encodeSegments(gen.segments); // the 4 border segments from reset
post({ type: "segments", id: msg.id, buffer: border.buffer, done: false }, border.buffer);
```

- [ ] **Step 6: Run protocol test + typecheck** — `npx vitest run protocol` PASS; `npm run check` → 0 errors.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "Add worker protocol, worker, and client with main-thread fallback"`

---

## Task 4: Rewire Canvas.svelte to the worker client + cutoff filtering

**Files:**
- Modify: `src/lib/components/Canvas.svelte`

**Interfaces:**
- Consumes: `GeneratorClient`, `redrawAll`/`drawSegments`, `derivePolarity`, `settings`, `DEFAULT_SAMPLE`, `DETAIL_MIN`, `loadImageFromSrc/File`.
- Produces (component exports, superset of `CanvasApi`): `getCanvas`, `getSegments` (filtered by current threshold), `getSize`, `loadSrc`, `loadFile`, plus webcam controls added in Task 8 (`startWebcam`, `stopWebcam`, `freezeWebcam`, `isWebcam`) and `getOriginalSrc` for compare.

- [ ] **Step 1: Replace generation wiring in Canvas.svelte**

Key changes (full component rewrite of the script section):
- Hold `let allSegments: Segment[] = []` and `let originalSrc = $state<string>("")`.
- Replace `TriangleGenerator gen` with `const client = new GeneratorClient()`.
- `loadSrc/loadFile` → set canvas size, set `originalSrc`, then `client.load(image, { subdivideOn, threshold: DETAIL_MIN, maxSamples: 10 }, onBatch)`.
- `onBatch(segs, done)`: append to `allSegments`; `drawSegments(ctx, segs, style(), settings.threshold)` (filtered); no rAF generator stepping needed (worker streams).
- Remove the rAF `loop()` (the worker drives streaming). Keep a `redraw()` helper: `redrawAll(ctx, allSegments, style(), settings.threshold)`.
- Effect:
  - threshold change → `redraw()` (filter only; NO reload).
  - polarity flip OR new-image (handled by load) → `client.load(...)` resetting `allSegments = [...border]` via onBatch.
  - lineWidth / same-polarity color → `redraw()`.
- `getSegments()` returns `allSegments.filter((s) => s.cutoff >= settings.threshold)`.
- `onMount`: `loadSrc(DEFAULT_SAMPLE.src)`; cleanup `client.dispose()`.

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { GeneratorClient } from "$lib/worker/generatorClient";
  import { redrawAll, drawSegments, type RenderStyle } from "$lib/render/canvasRenderer";
  import { loadImageFromSrc, loadImageFromFile } from "$lib/image/loadImage";
  import { derivePolarity } from "$lib/engine/polarity";
  import { settings } from "$lib/state.svelte";
  import { DEFAULT_SAMPLE } from "$lib/samples";
  import { DETAIL_MIN } from "$lib/constants";
  import type { ImageLike } from "$lib/engine/brightness";
  import type { Segment } from "$lib/engine/geometry";

  let canvasEl = $state<HTMLCanvasElement>();
  let dragging = $state(false);
  let ctx: CanvasRenderingContext2D | null = null;
  const client = new GeneratorClient();
  let current: ImageLike | null = null;
  let allSegments: Segment[] = [];
  let originalSrc = $state("");

  const style = (): RenderStyle => ({ background: settings.background, line: settings.line, lineWidth: settings.lineWidth });

  export function getCanvas() { return canvasEl!; }
  export function getSegments(): Segment[] { return allSegments.filter((s) => s.cutoff >= settings.threshold); }
  export function getSize() { return { width: current?.width ?? 0, height: current?.height ?? 0 }; }
  export function getOriginalSrc() { return originalSrc; }

  function redraw() {
    if (ctx && current) redrawAll(ctx, allSegments, style(), settings.threshold);
  }

  function build() {
    if (!ctx || !current) return;
    allSegments = [];
    if (ctx) { ctx.fillStyle = settings.background; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
    client.load(current, { subdivideOn: derivePolarity(settings.line, settings.background), threshold: DETAIL_MIN, maxSamples: 10 }, (segs) => {
      allSegments.push(...segs);
      if (ctx) drawSegments(ctx, segs, style(), settings.threshold);
    });
  }

  export async function loadSrc(src: string) {
    const { image, width, height } = await loadImageFromSrc(src);
    originalSrc = src;
    applyImage(image, width, height);
  }
  export async function loadFile(file: File) {
    const { image, width, height } = await loadImageFromFile(file);
    originalSrc = URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: file.type }));
    applyImage(image, width, height);
  }
  function applyImage(image: ImageLike, width: number, height: number) {
    current = image;
    if (canvasEl) { canvasEl.width = width; canvasEl.height = height; }
    build();
  }

  onMount(() => {
    ctx = canvasEl!.getContext("2d");
    void loadSrc(DEFAULT_SAMPLE.src);
    return () => client.dispose();
  });

  // Reactive rules.
  let lastThreshold = settings.threshold;
  let lastPolarity = derivePolarity(settings.line, settings.background);
  let lastLineWidth = settings.lineWidth;
  let lastBackground = settings.background;
  let lastLine = settings.line;
  $effect(() => {
    const t = settings.threshold;
    const polarity = derivePolarity(settings.line, settings.background);
    const lw = settings.lineWidth, bg = settings.background, ln = settings.line;
    if (!ctx || !current) return;
    if (polarity !== lastPolarity) {
      lastPolarity = polarity; lastThreshold = t; lastLineWidth = lw; lastBackground = bg; lastLine = ln;
      build(); // polarity flip changes which nodes subdivide -> rebuild
    } else if (t !== lastThreshold) {
      lastThreshold = t; redraw(); // pure filter, no recompute, no flicker
    } else if (lw !== lastLineWidth || bg !== lastBackground || ln !== lastLine) {
      lastLineWidth = lw; lastBackground = bg; lastLine = ln; redraw();
    }
  });

  function onDrop(e: DragEvent) {
    e.preventDefault(); dragging = false;
    const f = e.dataTransfer?.files?.[0]; if (f) void loadFile(f);
  }
</script>

<div
  class="relative inline-block leading-none rounded-lg ring-1 ring-border"
  class:ring-2={dragging} class:ring-primary={dragging}
  role="img" aria-label="Triangle art canvas — drop an image to load it"
  ondragover={(e) => { e.preventDefault(); dragging = true; }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <canvas bind:this={canvasEl} class="max-w-full h-auto rounded-lg block"></canvas>
  {#if dragging}
    <div class="absolute inset-0 grid place-items-center bg-background/70 text-sm font-medium rounded-lg pointer-events-none">Drop image to triangulate</div>
  {/if}
</div>
```

- [ ] **Step 2: Update slider bounds** — in `Controls.svelte`, change the Detail slider `min`/`max` to import `DETAIL_MIN`/`DETAIL_MAX` (done fully in Task 5; for now ensure default `settings.threshold` (0.01) is within range).

- [ ] **Step 3: Typecheck** — `npm run check` → 0 errors.

- [ ] **Step 4: Verify in browser** — `npx vite --port 5199 &`, open with agent-browser, confirm: build animates; dragging Detail slider re-filters with NO flash/rebuild; UI responsive. Screenshot.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Drive Canvas via worker client with flicker-free cutoff filtering"`

---

## Task 5: Presets

**Files:**
- Create: `src/lib/presets.ts`
- Modify: `src/lib/components/Controls.svelte`

**Interfaces:**
- Produces: `type Preset = { name: string; threshold: number; lineWidth: number; background: string; line: string }` and `export const PRESETS: Preset[]`.

- [ ] **Step 1: Create presets.ts**

```ts
export type Preset = { name: string; threshold: number; lineWidth: number; background: string; line: string };

export const PRESETS: Preset[] = [
  { name: "Ink", threshold: 0.008, lineWidth: 1.0, background: "#000000", line: "#ffffff" },
  { name: "Blueprint", threshold: 0.01, lineWidth: 1.25, background: "#0b3d91", line: "#cfe3ff" },
  { name: "Newsprint", threshold: 0.012, lineWidth: 1.0, background: "#f5f5f0", line: "#111111" },
  { name: "Neon", threshold: 0.006, lineWidth: 1.5, background: "#0a0a0f", line: "#39ff14" },
  { name: "Heavy", threshold: 0.02, lineWidth: 3.0, background: "#101014", line: "#ffd447" },
];
```

- [ ] **Step 2: Add a presets row + DETAIL_MIN/MAX bounds in Controls.svelte**

Import `PRESETS` and `DETAIL_MIN, DETAIL_MAX`. Update the Detail slider to `min={DETAIL_MIN} max={DETAIL_MAX}`. Add above the Image section:

```svelte
<div class="space-y-2">
  <Label>Presets</Label>
  <div class="flex flex-wrap gap-2">
    {#each PRESETS as p (p.name)}
      <Button variant="outline" size="sm" onclick={() => {
        settings.threshold = p.threshold;
        settings.lineWidth = p.lineWidth;
        settings.background = p.background;
        settings.line = p.line;
      }}>{p.name}</Button>
    {/each}
  </div>
</div>
```

- [ ] **Step 3: Typecheck + browser** — `npm run check` → 0 errors; verify clicking presets applies the look.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Add preset looks"`

---

## Task 6: More default images

**Files:**
- Add: `src/lib/samples/sample3.jpg`, `sample4.jpg`, `sample5.jpg` (CC0)
- Create: `src/lib/samples/CREDITS.md`
- Modify: `src/lib/samples/index.ts`

- [ ] **Step 1: Fetch 3 free-license images** (Lorem Picsum → Unsplash license, no attribution required; record source anyway):

```bash
cd "src/lib/samples"
curl -L -o sample3.jpg "https://picsum.photos/id/64/900/900"   # portrait
curl -L -o sample4.jpg "https://picsum.photos/id/177/900/600"  # landscape
curl -L -o sample5.jpg "https://picsum.photos/id/1062/900/600" # high-contrast scene
cd -
```
If a download fails (offline), retry with different ids or reduce to whatever succeeds; never bundle a zero-byte file (verify with `ls -la`).

- [ ] **Step 2: Create CREDITS.md**

```md
# Sample image credits

- turing.png — Alan Turing, public domain.
- sample2.jpg — bundled with the original project.
- sample3.jpg, sample4.jpg, sample5.jpg — Lorem Picsum (https://picsum.photos), Unsplash License (free to use, no attribution required).
```

- [ ] **Step 3: Register in samples/index.ts**

```ts
import { TuringImage } from "./turing";
import sample2Url from "./sample2.jpg?url";
import sample3Url from "./sample3.jpg?url";
import sample4Url from "./sample4.jpg?url";
import sample5Url from "./sample5.jpg?url";

export type Sample = { name: string; src: string };
export const DEFAULT_SAMPLE: Sample = { name: "Turing", src: TuringImage };
export const SAMPLES: Sample[] = [
  DEFAULT_SAMPLE,
  { name: "Photo", src: sample2Url },
  { name: "Portrait", src: sample3Url },
  { name: "Landscape", src: sample4Url },
  { name: "Scene", src: sample5Url },
];
```

- [ ] **Step 4: Build + browser** — `npm run build`; verify each sample loads and triangulates.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add more sample images with credits"`

---

## Task 7: Before/after compare slider

**Files:**
- Create: `src/lib/components/CompareSlider.svelte`
- Modify: `src/lib/components/Canvas.svelte` (render the overlay), `src/lib/state.svelte.ts` (compare toggle) or local state.

**Interfaces:**
- `CompareSlider.svelte` props: `{ src: string; active: boolean }` — overlays `src` (original image) clipped from the left up to a draggable divider, positioned absolutely over the canvas.

- [ ] **Step 1: Create CompareSlider.svelte**

```svelte
<script lang="ts">
  let { src, active }: { src: string; active: boolean } = $props();
  let pos = $state(50); // percent
  let wrap = $state<HTMLDivElement>();
  let drag = false;

  function move(clientX: number) {
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    pos = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
  }
  function onPointerDown(e: PointerEvent) { drag = true; (e.target as Element).setPointerCapture(e.pointerId); move(e.clientX); }
  function onPointerMove(e: PointerEvent) { if (drag) move(e.clientX); }
  function onPointerUp() { drag = false; }
</script>

{#if active}
  <div bind:this={wrap} class="absolute inset-0 overflow-hidden rounded-lg select-none"
       onpointermove={onPointerMove} onpointerup={onPointerUp}>
    <img {src} alt="original" class="absolute inset-0 w-full h-full object-cover"
         style={`clip-path: inset(0 ${100 - pos}% 0 0)`} draggable="false" />
    <div class="absolute inset-y-0 w-0.5 bg-primary cursor-ew-resize" style={`left:${pos}%`}>
      <button class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-6 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center cursor-ew-resize"
              aria-label="Drag to compare" onpointerdown={onPointerDown}
              onkeydown={(e) => { if (e.key === 'ArrowLeft') pos = Math.max(0, pos - 2); if (e.key === 'ArrowRight') pos = Math.min(100, pos + 2); }}>⇆</button>
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Wire into Canvas.svelte**

Add a `compare` prop or local state and render `<CompareSlider src={originalSrc} active={compare && !isWebcam} />` inside the canvas wrapper (the wrapper is already `relative`). Add `export let`/prop `compare` driven from Controls (via a bound boolean in `state.svelte.ts`):

In `state.svelte.ts` add `compare: false` to settings. In Canvas, import settings and pass `active={settings.compare}`.

- [ ] **Step 3: Add a Compare toggle in Controls.svelte**

```svelte
<label class="flex items-center gap-2 text-sm">
  <input type="checkbox" bind:checked={settings.compare} /> Compare original
</label>
```

- [ ] **Step 4: Typecheck + browser** — verify the wipe reveals the original vs triangulated and the handle drags.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add before/after compare slider"`

---

## Task 8: Continuous webcam mode

**Files:**
- Create: `src/lib/webcam.ts`
- Modify: `src/lib/components/Canvas.svelte`, `src/lib/components/Controls.svelte`

**Interfaces:**
- `webcam.ts`:
  - `startCamera(): Promise<MediaStream>` — `getUserMedia({ video: { facingMode: "user" } })`.
  - `captureFrame(video: HTMLVideoElement, maxEdge: number): { image: ImageLike; width: number; height: number }` — draws the video to an offscreen canvas (scaled so the long edge ≤ maxEdge) and returns ImageData.
- Canvas exports: `startWebcam()`, `stopWebcam()`, `freezeWebcam()`, and `isWebcam` (reactive).

- [ ] **Step 1: Create webcam.ts**

```ts
import type { ImageLike } from "./engine/brightness";

export async function startCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
}

const scratch = typeof document !== "undefined" ? document.createElement("canvas") : null;

export function captureFrame(video: HTMLVideoElement, maxEdge: number): { image: ImageLike; width: number; height: number } | null {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh || !scratch) return null;
  const scale = Math.min(1, maxEdge / Math.max(vw, vh));
  const w = Math.round(vw * scale), h = Math.round(vh * scale);
  scratch.width = w; scratch.height = h;
  const ctx = scratch.getContext("2d")!;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return { image: { data: data.data, width: w, height: h }, width: w, height: h };
}
```

- [ ] **Step 2: Add webcam pipeline to Canvas.svelte**

Add state + methods:

```ts
import { startCamera, captureFrame } from "$lib/webcam";
import { drawSegments } from "$lib/render/canvasRenderer";
import { WEBCAM_MAX_EDGE, WEBCAM_THRESHOLD, WEBCAM_MAX_SAMPLES } from "$lib/constants";
import { derivePolarity } from "$lib/engine/polarity";

let isWebcam = $state(false);
let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let webcamRunning = false;

export function getIsWebcam() { return isWebcam; }

export async function startWebcam() {
  try { stream = await startCamera(); } catch { webcamError = "Camera access denied."; return; }
  video = document.createElement("video");
  video.srcObject = stream; video.muted = true; await video.play();
  isWebcam = true; webcamRunning = true;
  pumpWebcam();
}

async function pumpWebcam() {
  if (!webcamRunning || !video || !ctx || !canvasEl) return;
  const cap = captureFrame(video, WEBCAM_MAX_EDGE);
  if (cap) {
    if (canvasEl.width !== cap.width) { canvasEl.width = cap.width; canvasEl.height = cap.height; }
    current = cap.image;
    const segs = await client.frame(cap.image, {
      subdivideOn: derivePolarity(settings.line, settings.background),
      threshold: WEBCAM_THRESHOLD, maxSamples: WEBCAM_MAX_SAMPLES,
    });
    if (webcamRunning) {
      allSegments = segs;
      redrawAll(ctx, segs, style(), -Infinity);
    }
  }
  if (webcamRunning) requestAnimationFrame(pumpWebcam);
}

export function freezeWebcam() {
  webcamRunning = false; // keep last frame + allSegments for export
  stopStream();
}
export function stopWebcam() {
  webcamRunning = false; isWebcam = false; stopStream();
  void loadSrc(DEFAULT_SAMPLE.src);
}
function stopStream() {
  stream?.getTracks().forEach((t) => t.stop()); stream = null; video = null;
}
```

Add `let webcamError = $state("")` and surface it. On unmount also `stopStream()`.

- [ ] **Step 3: Add webcam controls to Controls.svelte**

Extend `CanvasApi` (in `canvasApi.ts`) with `startWebcam: () => void; stopWebcam: () => void; freezeWebcam: () => void; getIsWebcam: () => boolean`. Add buttons:

```svelte
<div class="flex flex-wrap gap-2">
  {#if !canvasApi.getIsWebcam()}
    <Button variant="outline" size="sm" onclick={() => canvasApi.startWebcam()}>Start webcam</Button>
  {:else}
    <Button variant="outline" size="sm" onclick={() => canvasApi.freezeWebcam()}>Freeze</Button>
    <Button variant="destructive" size="sm" onclick={() => canvasApi.stopWebcam()}>Stop</Button>
  {/if}
</div>
```

(Note: `getIsWebcam()` is a function call in markup; Svelte 5 re-runs it reactively because `isWebcam` is `$state`. If reactivity doesn't update, expose `isWebcam` via a `$derived` getter prop instead.)

- [ ] **Step 4: Typecheck + browser** — `npm run check`; verify (agent-browser may not grant camera, so at minimum confirm no errors and graceful handling; test the denial path message).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add continuous webcam mode"`

---

## Task 9: Integration verification

**Files:** none.

- [ ] **Step 1: Full test suite** — `npm test` → all pass.
- [ ] **Step 2: Build** — `npm run build` → succeeds (worker bundles).
- [ ] **Step 3: agent-browser drive**
  - Detail slider drags: flicker-free, image matches a fresh build.
  - Heavy build keeps UI responsive (worker).
  - Presets apply.
  - All sample thumbnails load + triangulate.
  - Compare slider wipes original vs result.
  - Webcam: start (or graceful denial), live mirror, freeze & export, stop releases camera.
  - PNG + SVG export correct and respect current detail (only visible segments); heap bounded; no console errors.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Verify enhancements integration"`

---

## Self-Review

**Spec coverage:**
- Worker generation → Tasks 3, 4 (+ fallback). ✓
- Cutoff-based flicker-free rendering → Tasks 1, 2, 4; equivalence test in Task 1. ✓
- Presets → Task 5. ✓
- More default images → Task 6. ✓
- Before/after slider → Task 7. ✓
- Continuous webcam → Task 8. ✓
- Out-of-scope items (sharing, contrast, low-poly, filled) → not present. ✓
- Error handling (worker fallback, camera denial, stale ids) → Tasks 3, 8. ✓

**Placeholder scan:** No TBD/TODO; all code steps include code. Image choice in Task 6 is a concrete `curl` with named fallback behavior, not a placeholder.

**Type consistency:** `Segment` (with `cutoff`) defined Task 1, used in 2/3/4/7. `LoadOptions`, `encodeSegments`/`decodeSegments`, `GeneratorClient.load/frame/dispose` defined Task 3, used Task 4/8. `Preset` Task 5. `CanvasApi` extended in Task 8 to match Canvas exports (`getIsWebcam`, `startWebcam`, `stopWebcam`, `freezeWebcam`, `getOriginalSrc`). `DETAIL_MIN/MAX`, `WEBCAM_*`, `BUILD_BATCH` defined Task 1 constants, used 4/5/8. Webcam `redrawAll(..., -Infinity)` draws all frame segments (frame already built at WEBCAM_THRESHOLD).

**Note on `settings.compare`:** added to `state.svelte.ts` in Task 7; ensure the `Settings` type there gains `compare: boolean`.
