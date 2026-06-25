# Interactive Triangle Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static p5 triangle-art renderer into an interactive Svelte demo that animates the build, exposes live controls, accepts user images, and exports PNG + SVG.

**Architecture:** A framework-agnostic TypeScript engine (geometry → tree → brightness → incremental generator emitting line segments) sits under thin Canvas-2D render/export adapters and a Svelte + shadcn-svelte UI. The segment list is the single source of truth shared by canvas rendering and SVG export. p5/React are removed entirely.

**Tech Stack:** Svelte + Vite + TypeScript, Tailwind CSS + shadcn-svelte, raw Canvas 2D, Vitest for engine unit tests.

## Global Constraints

- No p5, no react-p5, no React. Remove `p5`, `react-p5`, `@types/p5`, `react`, `react-dom`, `@types/react`, `@types/react-dom`.
- Engine code under `src/lib/engine/` must be pure TS with **no DOM/browser dependency** so it runs under Vitest in the Node environment.
- Pixel sampling MUST clamp coordinates to `[0, width-1] x [0, height-1]` (out-of-range reads on a raw pixel array return `undefined` → `NaN` → infinite subdivision; this is the previously-fixed OOM bug).
- Generator MUST keep a `maxNodes` safety bound (default `1_000_000`).
- Subdivision direction is coupled to colors: `subdivideOn: 'bright' | 'dark'`, derived as line-lighter-than-background → `'bright'`, else `'dark'`.
- Re-generation rules: threshold change, new image, or polarity flip → reset + re-animate; line weight + same-polarity color change → live redraw; build speed → applies to subsequent frames.
- Commit after every task.

---

## File Structure

```
src/
  lib/
    engine/
      geometry.ts          # Point type + vector math
      tree.ts              # TreeNode + subdivision, returns segments
      brightness.ts        # ImageLike sampling, clamp + polarity metric
      generator.ts         # TriangleGenerator: reset/step/done, segment list
      geometry.test.ts
      tree.test.ts
      brightness.test.ts
      generator.test.ts
    render/
      canvasRenderer.ts    # draw segments to a 2D context (incremental + full)
      exportPng.ts         # canvas -> PNG download
      exportSvg.ts         # segments -> SVG string + download
      exportSvg.test.ts
    image/
      loadImage.ts         # File/URL -> ImageLike (offscreen canvas getImageData)
    samples/
      index.ts             # default (Turing) + sample image sources
      turing.ts            # ported base64 (moved from src/Images/Turing.ts)
    components/
      ui/                  # shadcn-svelte generated components
      Canvas.svelte        # canvas element, rAF loop, drag-drop
      Controls.svelte      # sliders, color pickers, sample + export buttons
    state.svelte.ts        # shared reactive settings store (runes)
  App.svelte               # layout
  main.ts                  # mount
  app.css                  # tailwind entry
```

---

## Task 1: Scaffold Svelte + Vite + TS, Vitest, Tailwind, shadcn-svelte

**Files:**
- Replace: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src/main.ts`, `src/App.svelte`, `src/app.css`, `svelte.config.js`, `.gitignore`, `vitest.config.ts`
- Delete: `src/App.tsx`, `src/main.tsx`, `src/Images/`, `src/Helpers/`, `src/vite-env.d.ts`, `src/index.css`, `src/logo.svg`
- Keep (move later): the Turing base64 from `src/Images/Turing.ts`

**Interfaces:**
- Produces: a running Svelte app, `npm run dev`, `npm run build`, and `npm test` (Vitest) all working; path alias `$lib` → `src/lib`.

- [ ] **Step 1: Preserve the Turing image asset**

Copy the exported base64 string from `src/Images/Turing.ts` into a new `src/lib/samples/turing.ts`:
```ts
// src/lib/samples/turing.ts
export const TuringImage = "data:image/...";  // verbatim base64 from old src/Images/Turing.ts
```

- [ ] **Step 2: Add .gitignore (node_modules is currently tracked)**

```
node_modules/
dist/
.DS_Store
```
Then untrack node_modules: `git rm -r --cached node_modules >/dev/null 2>&1 || true`

- [ ] **Step 3: Write new package.json**

```json
{
  "name": "triangle-art",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "svelte-check --tsconfig ./tsconfig.json && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@tsconfig/svelte": "^5.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "tslib": "^2.7.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Install and verify base toolchain**

Run: `npm install`
Then create minimal `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.svelte`:

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: { $lib: resolve("./src/lib") } },
});
```

`svelte.config.js`:
```js
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
export default { preprocess: vitePreprocess() };
```

`tsconfig.json`:
```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ESNext",
    "moduleResolution": "bundler",
    "module": "ESNext",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "paths": { "$lib": ["./src/lib"], "$lib/*": ["./src/lib/*"] },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Triangle Art</title></head>
  <body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>
</html>
```

`src/main.ts`:
```ts
import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
export default mount(App, { target: document.getElementById("app")! });
```

`src/App.svelte`:
```svelte
<main><h1>Triangle Art</h1></main>
```

- [ ] **Step 5: Add Tailwind + shadcn-svelte**

Per Context7 (`/huntabyte/shadcn-svelte`): install Tailwind, create `src/app.css` with Tailwind directives, then run `npx shadcn-svelte@latest init` choosing base color "slate", CSS file `src/app.css`, aliases `$lib`, `$lib/components`, `$lib/utils`, `$lib/components/ui`. Confirm `components.json`, `src/lib/utils.ts` (`cn`), and Tailwind config are created. (Use Vite installation guide; verify exact steps via Context7 at execution time.)

- [ ] **Step 6: Add a smoke test**

`src/lib/engine/smoke.test.ts`:
```ts
import { test, expect } from "vitest";
test("vitest runs", () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 7: Verify dev, build, test**

Run: `npm run build` — Expected: succeeds.
Run: `npm test` — Expected: smoke test passes.
Run dev server briefly to confirm the page loads (background + curl/agent-browser), then delete `src/lib/engine/smoke.test.ts`.

- [ ] **Step 8: Commit**
```bash
git add -A
git commit -m "Scaffold Svelte + Vite + Tailwind + shadcn-svelte, remove p5/React"
```

---

## Task 2: Geometry helpers

**Files:**
- Create: `src/lib/engine/geometry.ts`, `src/lib/engine/geometry.test.ts`

**Interfaces:**
- Produces:
  - `type Point = { x: number; y: number }`
  - `type Segment = { x1: number; y1: number; x2: number; y2: number }`
  - `sub(a: Point, b: Point): Point`
  - `mag(v: Point): number`
  - `dot(a: Point, b: Point): number`
  - `add(a: Point, b: Point): Point`
  - `scale(v: Point, s: number): Point`
  - `normalize(v: Point): Point` (returns `{0,0}` for zero-length, matching p5)

- [ ] **Step 1: Write failing tests**
```ts
import { test, expect } from "vitest";
import { sub, mag, dot, add, scale, normalize } from "./geometry";

test("sub subtracts components", () => {
  expect(sub({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
});
test("mag is euclidean length", () => {
  expect(mag({ x: 3, y: 4 })).toBe(5);
});
test("dot product", () => {
  expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
});
test("add and scale", () => {
  expect(add({ x: 1, y: 1 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
  expect(scale({ x: 2, y: 3 }, 2)).toEqual({ x: 4, y: 6 });
});
test("normalize unit length", () => {
  const n = normalize({ x: 3, y: 4 });
  expect(mag(n)).toBeCloseTo(1);
});
test("normalize zero vector stays zero (no NaN)", () => {
  expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
});
```

- [ ] **Step 2: Run, expect fail** — `npm test -- geometry` → FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
export type Point = { x: number; y: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (v: Point, s: number): Point => ({ x: v.x * s, y: v.y * s });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const mag = (v: Point): number => Math.sqrt(v.x * v.x + v.y * v.y);
export const normalize = (v: Point): Point => {
  const m = mag(v);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};
```

- [ ] **Step 4: Run, expect pass** — `npm test -- geometry` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add geometry helpers"`

---

## Task 3: TreeNode + subdivision

**Files:**
- Create: `src/lib/engine/tree.ts`, `src/lib/engine/tree.test.ts`

**Interfaces:**
- Consumes: `Point`, `Segment`, `sub`, `add`, `scale`, `dot`, `mag`, `normalize` from `./geometry`.
- Produces:
  - `class TreeNode { parent: TreeNode | null; points: Point[]; children: TreeNode[]; depth: number; get area(): number; divide(): { children: TreeNode[]; segments: Segment[] }; }`
  - `createRectangle(center: Point, width: number, height: number): TreeNode`
  - `createImageRectangle(width: number, height: number): TreeNode`
  - Rectangle division emits the **diagonal** segment `(p0,p2)`. Triangle division emits the **bisector** segment `(bisectorPoint, p0)`. Each division emits exactly one segment.

- [ ] **Step 1: Write failing tests**
```ts
import { test, expect } from "vitest";
import { TreeNode, createImageRectangle } from "./tree";
import { mag, sub } from "./geometry";

test("rectangle has 4 points and area w*h", () => {
  const r = createImageRectangle(100, 80);
  expect(r.points.length).toBe(4);
  expect(r.area).toBeCloseTo(100 * 80);
});
test("rectangle divides into two triangles and emits one diagonal segment", () => {
  const r = createImageRectangle(100, 80);
  const { children, segments } = r.divide();
  expect(children.length).toBe(2);
  expect(children.every((c) => c.points.length === 3)).toBe(true);
  expect(segments.length).toBe(1);
});
test("triangle divides into two and emits one bisector segment", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divide().children[0];
  const { children, segments } = tri.divide();
  expect(children.length).toBe(2);
  expect(segments.length).toBe(1);
});
test("child area is smaller than parent (subdivision converges)", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divide().children[0];
  const kids = tri.divide().children;
  expect(kids[0].area).toBeLessThan(tri.area);
  expect(kids[1].area).toBeLessThan(tri.area);
});
test("depth increments", () => {
  const r = createImageRectangle(100, 80);
  expect(r.depth).toBe(1);
  expect(r.divide().children[0].depth).toBe(2);
});
```

- [ ] **Step 2: Run, expect fail** — `npm test -- tree` → FAIL.

- [ ] **Step 3: Implement**
```ts
import { add, dot, mag, normalize, scale, sub, type Point, type Segment } from "./geometry";

export class TreeNode {
  parent: TreeNode | null;
  points: Point[];
  children: TreeNode[] = [];
  depth: number;

  constructor(parent: TreeNode | null, points: Point[]) {
    this.parent = parent;
    this.points = points;
    this.depth = 1 + (parent?.depth ?? 0);
  }

  get area(): number {
    const p = this.points;
    const a = mag(sub(p[1], p[0])) * mag(sub(p[2], p[0]));
    return p.length === 3 ? a / 2 : a;
  }

  divide(): { children: TreeNode[]; segments: Segment[] } {
    if (this.points.length === 4) return this.divideRectangle();
    if (this.points.length === 3) return this.divideTriangle();
    throw new Error("Cannot divide polygon with more than 4 sides");
  }

  private divideRectangle() {
    const p = this.points;
    this.children = [
      new TreeNode(this, [p[1], p[2], p[0]]),
      new TreeNode(this, [p[3], p[0], p[2]]),
    ];
    const seg: Segment = { x1: p[0].x, y1: p[0].y, x2: p[2].x, y2: p[2].y };
    return { children: this.children, segments: [seg] };
  }

  private divideTriangle() {
    const p = this.points;
    const hyp = sub(p[2], p[1]);
    const side = sub(p[0], p[1]);
    const bisector = add(scale(normalize(hyp), dot(normalize(hyp), side)), p[1]);
    this.children = [
      new TreeNode(this, [bisector, p[0], p[1]]),
      new TreeNode(this, [bisector, p[0], p[2]]),
    ];
    const seg: Segment = { x1: bisector.x, y1: bisector.y, x2: p[0].x, y2: p[0].y };
    return { children: this.children, segments: [seg] };
  }
}

export function createRectangle(center: Point, width: number, height: number): TreeNode {
  const hw = width / 2, hh = height / 2;
  return new TreeNode(null, [
    { x: center.x - hw, y: center.y - hh },
    { x: center.x - hw, y: center.y + hh },
    { x: center.x + hw, y: center.y + hh },
    { x: center.x + hw, y: center.y - hh },
  ]);
}

export function createImageRectangle(width: number, height: number): TreeNode {
  return createRectangle({ x: width / 2, y: height / 2 }, width, height);
}

export function rectangleBorderSegments(node: TreeNode): Segment[] {
  const p = node.points;
  return p.map((pt, i) => {
    const n = p[(i + 1) % p.length];
    return { x1: pt.x, y1: pt.y, x2: n.x, y2: n.y };
  });
}
```
(Note: `normalize(hyp)` is called twice; that's fine and matches the original p5 `setMag(normalize().dot(...))` semantics. Also export `rectangleBorderSegments` for the generator's initial border.)

- [ ] **Step 4: Run, expect pass** — `npm test -- tree` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add TreeNode subdivision with segment emission"`

---

## Task 4: Brightness sampling (clamp + polarity)

**Files:**
- Create: `src/lib/engine/brightness.ts`, `src/lib/engine/brightness.test.ts`

**Interfaces:**
- Consumes: `Point`, `sub`, `mag` from `./geometry`.
- Produces:
  - `type ImageLike = { data: Uint8ClampedArray | number[]; width: number; height: number }`
  - `getAverageBrightnessInTriangle(img: ImageLike, corners: Point[], maxSample?: number): number` — returns mean of (r+g+b)/3 over sampled pixels, **clamped to bounds**, range 0–255.

- [ ] **Step 1: Write failing tests**
```ts
import { test, expect } from "vitest";
import { getAverageBrightnessInTriangle, type ImageLike } from "./brightness";

function solid(w: number, h: number, v: number): ImageLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i*4]=v; data[i*4+1]=v; data[i*4+2]=v; data[i*4+3]=255; }
  return { data, width: w, height: h };
}

test("solid gray returns that brightness", () => {
  const img = solid(50, 50, 128);
  const b = getAverageBrightnessInTriangle(img, [{x:0,y:0},{x:49,y:0},{x:0,y:49}], 10);
  expect(b).toBeCloseTo(128, 0);
});
test("edge-touching triangle does not produce NaN (bounds clamp)", () => {
  const img = solid(40, 40, 128);
  // corners on the far edges -> samples round to x==40 / y==40 without clamp
  const b = getAverageBrightnessInTriangle(img, [{x:0,y:40},{x:40,y:40},{x:0,y:0}], 10);
  expect(Number.isNaN(b)).toBe(false);
  expect(b).toBeCloseTo(128, 0);
});
```

- [ ] **Step 2: Run, expect fail** — `npm test -- brightness` → FAIL.

- [ ] **Step 3: Implement** (port with clamp; plain math)
```ts
import { mag, sub, type Point } from "./geometry";

export type ImageLike = { data: Uint8ClampedArray | number[]; width: number; height: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function getAverageBrightnessInTriangle(img: ImageLike, corners: Point[], maxSample = 1000): number {
  const p = corners;
  const base = sub(p[1], p[0]);
  const height = sub(p[2], p[0]);
  const baseMag = mag(base);
  const heightMag = mag(height);
  const totalPixels = Math.abs((baseMag * heightMag) / 2);
  const stepSize = Math.round(Math.sqrt(totalPixels / Math.min(totalPixels, maxSample)));
  const { data, width } = img;
  const maxX = width - 1, maxY = img.height - 1;
  let sum = 0, total = 0;
  for (let i = 0; i < baseMag; i += stepSize) {
    const bc = i / baseMag;
    const verticalPixels = lerp(heightMag, 1, bc);
    for (let j = 0; j < verticalPixels; j += stepSize) {
      const hc = j / heightMag;
      let x = Math.round(p[0].x + height.x * hc + base.x * bc);
      let y = Math.round(p[0].y + height.y * hc + base.y * bc);
      if (x < 0) x = 0; else if (x > maxX) x = maxX;
      if (y < 0) y = 0; else if (y > maxY) y = maxY;
      const idx = (y * width + x) * 4;
      sum += data[idx] + data[idx + 1] + data[idx + 2];
      total++;
    }
  }
  return sum / (total * 3);
}
```

- [ ] **Step 4: Run, expect pass** — `npm test -- brightness` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add brightness sampling with bounds clamp"`

---

## Task 5: TriangleGenerator (incremental, polarity, segments)

**Files:**
- Create: `src/lib/engine/generator.ts`, `src/lib/engine/generator.test.ts`

**Interfaces:**
- Consumes: `TreeNode`, `createImageRectangle`, `rectangleBorderSegments` from `./tree`; `getAverageBrightnessInTriangle`, `ImageLike` from `./brightness`; `Segment` from `./geometry`.
- Produces:
  - `type SubdivideOn = "bright" | "dark"`
  - `type GeneratorOptions = { threshold: number; subdivideOn: SubdivideOn; maxSamples?: number; maxNodes?: number }`
  - `class TriangleGenerator { segments: Segment[]; done: boolean; reset(img: ImageLike, opts: GeneratorOptions): void; step(n: number): Segment[]; }`
  - `step(n)` returns only the segments newly emitted in that call (also appended to `this.segments`). `done` becomes true once the frontier is exhausted or `maxNodes` reached.

- [ ] **Step 1: Write failing tests**
```ts
import { test, expect } from "vitest";
import { TriangleGenerator } from "./generator";
import type { ImageLike } from "./brightness";

function gradient(w: number, h: number): ImageLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = Math.round((x / w) * 255), i = (y * w + x) * 4;
    data[i]=v; data[i+1]=v; data[i+2]=v; data[i+3]=255;
  }
  return { data, width: w, height: h };
}

test("starts with 4 border segments after reset", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.01, subdivideOn: "bright" });
  expect(g.segments.length).toBe(4);
  expect(g.done).toBe(false);
});
test("terminates and is deterministic", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.05, subdivideOn: "bright" });
  let guard = 0;
  while (!g.done && guard++ < 100000) g.step(500);
  expect(g.done).toBe(true);
  const count = g.segments.length;

  const g2 = new TriangleGenerator();
  g2.reset(gradient(64, 64), { threshold: 0.05, subdivideOn: "bright" });
  while (!g2.done) g2.step(500);
  expect(g2.segments.length).toBe(count);
});
test("step returns only newly emitted segments", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.05, subdivideOn: "bright" });
  const before = g.segments.length;
  const emitted = g.step(10);
  expect(g.segments.length).toBe(before + emitted.length);
});
test("polarity changes the resulting mesh", () => {
  const mk = (s: "bright" | "dark") => {
    const g = new TriangleGenerator();
    g.reset(gradient(64, 64), { threshold: 0.05, subdivideOn: s });
    while (!g.done) g.step(500);
    return g.segments.length;
  };
  expect(mk("bright")).not.toBe(mk("dark"));
});
test("respects maxNodes safety bound", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.0001, subdivideOn: "bright", maxNodes: 50 });
  while (!g.done) g.step(1000);
  expect(g.done).toBe(true);
});
```

- [ ] **Step 2: Run, expect fail** — `npm test -- generator` → FAIL.

- [ ] **Step 3: Implement**
```ts
import type { Segment } from "./geometry";
import { createImageRectangle, rectangleBorderSegments, TreeNode } from "./tree";
import { getAverageBrightnessInTriangle, type ImageLike } from "./brightness";

export type SubdivideOn = "bright" | "dark";
export type GeneratorOptions = {
  threshold: number;
  subdivideOn: SubdivideOn;
  maxSamples?: number;
  maxNodes?: number;
};

export class TriangleGenerator {
  segments: Segment[] = [];
  done = true;
  private img!: ImageLike;
  private opts!: Required<GeneratorOptions>;
  private frontier: TreeNode[] = [];
  private head = 0;
  private imageArea = 0;
  private nodeCount = 0;

  reset(img: ImageLike, opts: GeneratorOptions): void {
    this.img = img;
    this.opts = { maxSamples: 10, maxNodes: 1_000_000, ...opts };
    this.imageArea = img.width * img.height;
    const root = createImageRectangle(img.width, img.height);
    this.frontier = [root];
    this.head = 0;
    this.nodeCount = 1;
    this.segments = rectangleBorderSegments(root);
    this.done = false;
  }

  step(n: number): Segment[] {
    const emitted: Segment[] = [];
    let processed = 0;
    while (processed < n && this.head < this.frontier.length) {
      if (this.nodeCount >= this.opts.maxNodes) { this.done = true; break; }
      const node = this.frontier[this.head++];
      processed++;
      const metricRaw = getAverageBrightnessInTriangle(this.img, node.points, this.opts.maxSamples);
      const metric = this.opts.subdivideOn === "bright" ? metricRaw : 255 - metricRaw;
      if (metric < (this.imageArea / node.area) * this.opts.threshold) continue;
      const { children, segments } = node.divide();
      this.frontier.push(...children);
      this.nodeCount += children.length;
      for (const s of segments) { this.segments.push(s); emitted.push(s); }
    }
    if (this.head >= this.frontier.length) this.done = true;
    return emitted;
  }
}
```

- [ ] **Step 4: Run, expect pass** — `npm test -- generator` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add incremental TriangleGenerator with polarity"`

---

## Task 6: Canvas renderer

**Files:**
- Create: `src/lib/render/canvasRenderer.ts`

**Interfaces:**
- Consumes: `Segment` from `../engine/geometry`.
- Produces:
  - `type RenderStyle = { background: string; line: string; lineWidth: number }`
  - `clearCanvas(ctx, style): void` — fills the whole canvas with `style.background`.
  - `drawSegments(ctx, segments, style): void` — strokes the given segments (used incrementally for newly-emitted segments; sets stroke/lineWidth from style, does NOT clear).
  - `redrawAll(ctx, segments, style): void` — clear + drawSegments (used on full redraw / style change).

- [ ] **Step 1: Implement** (no unit test — DOM canvas; verified in integration)
```ts
import type { Segment } from "../engine/geometry";
export type RenderStyle = { background: string; line: string; lineWidth: number };

export function clearCanvas(ctx: CanvasRenderingContext2D, style: RenderStyle): void {
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
export function drawSegments(ctx: CanvasRenderingContext2D, segments: Segment[], style: RenderStyle): void {
  ctx.strokeStyle = style.line;
  ctx.lineWidth = style.lineWidth;
  ctx.beginPath();
  for (const s of segments) { ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); }
  ctx.stroke();
}
export function redrawAll(ctx: CanvasRenderingContext2D, segments: Segment[], style: RenderStyle): void {
  clearCanvas(ctx, style);
  drawSegments(ctx, segments, style);
}
```

- [ ] **Step 2: Typecheck** — Run: `npx svelte-check` (or `npx tsc --noEmit`) — Expected: no errors in this file.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "Add canvas renderer"`

---

## Task 7: Exports (SVG + PNG)

**Files:**
- Create: `src/lib/render/exportSvg.ts`, `src/lib/render/exportSvg.test.ts`, `src/lib/render/exportPng.ts`

**Interfaces:**
- Consumes: `Segment` from `../engine/geometry`; `RenderStyle` from `./canvasRenderer`.
- Produces:
  - `segmentsToSvg(segments: Segment[], width: number, height: number, style: RenderStyle): string`
  - `downloadSvg(svg: string, filename: string): void`
  - `downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void`

- [ ] **Step 1: Write failing SVG test**
```ts
import { test, expect } from "vitest";
import { segmentsToSvg } from "./exportSvg";

test("produces valid svg with a line per segment and background rect", () => {
  const svg = segmentsToSvg(
    [{ x1: 0, y1: 0, x2: 10, y2: 10 }],
    100, 80,
    { background: "#000000", line: "#ffffff", lineWidth: 1.5 }
  );
  expect(svg).toContain('width="100"');
  expect(svg).toContain('height="80"');
  expect(svg).toContain('<rect');
  expect(svg).toContain('fill="#000000"');
  expect(svg).toContain('<line x1="0" y1="0" x2="10" y2="10"');
  expect(svg).toContain('stroke="#ffffff"');
  expect((svg.match(/<line/g) || []).length).toBe(1);
});
```

- [ ] **Step 2: Run, expect fail** — `npm test -- exportSvg` → FAIL.

- [ ] **Step 3: Implement exportSvg.ts**
```ts
import type { Segment } from "../engine/geometry";
import type { RenderStyle } from "./canvasRenderer";

export function segmentsToSvg(segments: Segment[], width: number, height: number, style: RenderStyle): string {
  const lines = segments
    .map((s) => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" />`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${style.background}" />` +
    `<g stroke="${style.line}" stroke-width="${style.lineWidth}" stroke-linecap="round">${lines}</g>` +
    `</svg>`;
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  triggerDownload(URL.createObjectURL(blob), filename);
}
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Implement exportPng.ts**
```ts
export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
```

- [ ] **Step 5: Run, expect pass** — `npm test -- exportSvg` → PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add SVG + PNG export"`

---

## Task 8: Image loading

**Files:**
- Create: `src/lib/image/loadImage.ts`, `src/lib/samples/index.ts`
- Move: Turing base64 already at `src/lib/samples/turing.ts` (from Task 1)

**Interfaces:**
- Consumes: `ImageLike` from `../engine/brightness`.
- Produces:
  - `loadImageFromSrc(src: string): Promise<{ image: ImageLike; width: number; height: number }>` — draws an `Image` to an offscreen canvas and returns its `getImageData`.
  - `loadImageFromFile(file: File): Promise<{ image: ImageLike; width: number; height: number }>`
  - `SAMPLES: { name: string; src: string }[]` and `DEFAULT_SAMPLE: { name: string; src: string }` (Turing) in `samples/index.ts`.

- [ ] **Step 1: Implement loadImage.ts** (browser-only; verified in integration)
```ts
import type { ImageLike } from "../engine/brightness";

function imageToData(img: HTMLImageElement): { image: ImageLike; width: number; height: number } {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  return { image: { data: data.data, width: c.width, height: c.height }, width: c.width, height: c.height };
}
export function loadImageFromSrc(src: string) {
  return new Promise<{ image: ImageLike; width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(imageToData(img));
    img.onerror = reject;
    img.src = src;
  });
}
export function loadImageFromFile(file: File) {
  return new Promise<{ image: ImageLike; width: number; height: number }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => loadImageFromSrc(reader.result as string).then(resolve, reject);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Implement samples/index.ts**
```ts
import { TuringImage } from "./turing";
export const DEFAULT_SAMPLE = { name: "Turing", src: TuringImage };
export const SAMPLES = [DEFAULT_SAMPLE];
// Additional bundled samples may be added here (import asset URLs via Vite `?url`).
```
(If `src/test.jpg` is retained, move to `src/lib/samples/` and add `import sample2 from "./sample2.jpg?url"` to SAMPLES.)

- [ ] **Step 3: Typecheck** — `npx svelte-check` — Expected: no errors.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Add image loading + samples"`

---

## Task 9: Shared state + polarity derivation

**Files:**
- Create: `src/lib/state.svelte.ts`
- Create: `src/lib/engine/polarity.ts`, `src/lib/engine/polarity.test.ts`

**Interfaces:**
- Produces:
  - `relativeLuminance(hex: string): number` (0–255) and `derivePolarity(line: string, background: string): "bright" | "dark"` in `polarity.ts`.
  - `settings` reactive object (Svelte 5 runes via `$state`) in `state.svelte.ts`: `{ threshold, buildSpeed, lineWidth, background, line }`.

- [ ] **Step 1: Write failing polarity tests**
```ts
import { test, expect } from "vitest";
import { derivePolarity } from "./polarity";

test("white line on black bg subdivides bright", () => {
  expect(derivePolarity("#ffffff", "#000000")).toBe("bright");
});
test("black line on white bg subdivides dark", () => {
  expect(derivePolarity("#000000", "#ffffff")).toBe("dark");
});
```

- [ ] **Step 2: Run, expect fail** — `npm test -- polarity` → FAIL.

- [ ] **Step 3: Implement polarity.ts**
```ts
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function derivePolarity(line: string, background: string): "bright" | "dark" {
  return relativeLuminance(line) >= relativeLuminance(background) ? "bright" : "dark";
}
```

- [ ] **Step 4: Implement state.svelte.ts**
```ts
export const settings = $state({
  threshold: 0.01,
  buildSpeed: 800,
  lineWidth: 1.5,
  background: "#000000",
  line: "#ffffff",
});
```

- [ ] **Step 5: Run, expect pass** — `npm test -- polarity` → PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add polarity derivation + settings state"`

---

## Task 10: Canvas.svelte (rAF loop, drag-drop, re-gen wiring)

**Files:**
- Create: `src/lib/components/Canvas.svelte`

**Interfaces:**
- Consumes: `TriangleGenerator` (engine), `redrawAll`/`drawSegments`/`RenderStyle` (render), `loadImageFromSrc`/`loadImageFromFile` (image), `derivePolarity` (polarity), `settings` (state), `DEFAULT_SAMPLE` (samples).
- Produces: a `<canvas>` bound to size of the current image; exposes (via `export`) `regenerate()`, `loadFile(file)`, `loadSrc(src)`, and a `getCanvas()` for export. Re-runs the generator when threshold/image/polarity change; live redraw when line weight or same-polarity color changes.

- [ ] **Step 1: Implement Canvas.svelte**
```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { TriangleGenerator } from "$lib/engine/generator";
  import { redrawAll, drawSegments, type RenderStyle } from "$lib/render/canvasRenderer";
  import { loadImageFromSrc, loadImageFromFile } from "$lib/image/loadImage";
  import { derivePolarity } from "$lib/engine/polarity";
  import { settings } from "$lib/state.svelte";
  import { DEFAULT_SAMPLE } from "$lib/samples";
  import type { ImageLike } from "$lib/engine/brightness";

  let canvas = $state<HTMLCanvasElement>();
  let ctx: CanvasRenderingContext2D | null = null;
  let gen = new TriangleGenerator();
  let current: ImageLike | null = null;
  let raf = 0;
  let polarity = $derived(derivePolarity(settings.line, settings.background));

  const style = (): RenderStyle => ({ background: settings.background, line: settings.line, lineWidth: settings.lineWidth });

  export function getCanvas() { return canvas!; }
  export function getSegments() { return gen.segments; }
  export function getSize() { return { width: current?.width ?? 0, height: current?.height ?? 0 }; }

  function loop() {
    if (!ctx) return;
    if (!gen.done) { const fresh = gen.step(settings.buildSpeed); drawSegments(ctx, fresh, style()); }
    raf = requestAnimationFrame(loop);
  }

  export function regenerate() {
    if (!ctx || !current || !canvas) return;
    gen.reset(current, { threshold: settings.threshold, subdivideOn: polarity });
    redrawAll(ctx, gen.segments, style()); // border segments
  }

  export async function loadSrc(src: string) {
    const { image, width, height } = await loadImageFromSrc(src);
    current = image; if (canvas) { canvas.width = width; canvas.height = height; } regenerate();
  }
  export async function loadFile(file: File) {
    const { image, width, height } = await loadImageFromFile(file);
    current = image; if (canvas) { canvas.width = width; canvas.height = height; } regenerate();
  }

  onMount(() => {
    ctx = canvas!.getContext("2d");
    loadSrc(DEFAULT_SAMPLE.src);
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  // Re-gen on threshold or polarity change.
  let lastThreshold = settings.threshold;
  let lastPolarity = polarity;
  $effect(() => {
    if (settings.threshold !== lastThreshold || polarity !== lastPolarity) {
      lastThreshold = settings.threshold; lastPolarity = polarity; regenerate();
    }
  });
  // Live redraw on line weight or same-polarity color change.
  $effect(() => {
    void settings.lineWidth; void settings.line; void settings.background;
    if (ctx && current) redrawAll(ctx, gen.segments, style());
  });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0]; if (f) loadFile(f);
  }
</script>

<div class="canvas-wrap" ondragover={(e) => e.preventDefault()} ondrop={onDrop}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .canvas-wrap { display: inline-block; line-height: 0; }
  canvas { max-width: 100%; height: auto; border-radius: 0.5rem; }
</style>
```
(Note: the two `$effect`s must not fight — the redraw effect runs on every settings change including threshold; that's fine because `regenerate()` also redraws. Verify no flicker in integration; if needed, gate the live-redraw effect to skip when a regen just happened.)

- [ ] **Step 2: Typecheck** — `npx svelte-check` — Expected: no errors.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "Add Canvas component with rAF loop and drag-drop"`

---

## Task 11: Controls.svelte + App.svelte layout + exports wiring

**Files:**
- Create: `src/lib/components/Controls.svelte`
- Modify: `src/App.svelte`
- Add shadcn-svelte components: `npx shadcn-svelte@latest add slider button card label`

**Interfaces:**
- Consumes: `settings` (state); the `Canvas` component instance (for export + sample/file loading); `segmentsToSvg`/`downloadSvg` and `downloadCanvasPng` (render); `SAMPLES` (samples).
- Produces: full UI — sliders bound to `settings`, color inputs, sample buttons, file picker, and PNG/SVG export buttons.

- [ ] **Step 1: Implement Controls.svelte** (props: a reference to canvas API)
```svelte
<script lang="ts">
  import { settings } from "$lib/state.svelte";
  import { SAMPLES } from "$lib/samples";
  import { segmentsToSvg, downloadSvg } from "$lib/render/exportSvg";
  import { downloadCanvasPng } from "$lib/render/exportPng";
  import { Slider } from "$lib/components/ui/slider";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";

  let { canvasApi } = $props<{ canvasApi: {
    getCanvas: () => HTMLCanvasElement; getSegments: () => any[];
    getSize: () => { width: number; height: number };
    loadSrc: (s: string) => void; loadFile: (f: File) => void;
  } }>();

  const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
  function exportPng() { downloadCanvasPng(canvasApi.getCanvas(), `triangles-${stamp()}.png`); }
  function exportSvg() {
    const { width, height } = canvasApi.getSize();
    const svg = segmentsToSvg(canvasApi.getSegments(), width, height,
      { background: settings.background, line: settings.line, lineWidth: settings.lineWidth });
    downloadSvg(svg, `triangles-${stamp()}.svg`);
  }
  function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (f) canvasApi.loadFile(f);
  }
</script>

<div class="space-y-6">
  <div class="space-y-2">
    <Label>Detail ({settings.threshold.toFixed(3)})</Label>
    <Slider type="single" min={0.001} max={0.05} step={0.001} bind:value={settings.threshold} />
  </div>
  <div class="space-y-2">
    <Label>Build speed ({settings.buildSpeed})</Label>
    <Slider type="single" min={50} max={3000} step={50} bind:value={settings.buildSpeed} />
  </div>
  <div class="space-y-2">
    <Label>Line weight ({settings.lineWidth.toFixed(1)})</Label>
    <Slider type="single" min={0.25} max={5} step={0.25} bind:value={settings.lineWidth} />
  </div>
  <div class="flex gap-4">
    <label class="flex items-center gap-2 text-sm">Background <input type="color" bind:value={settings.background} /></label>
    <label class="flex items-center gap-2 text-sm">Line <input type="color" bind:value={settings.line} /></label>
  </div>
  <div class="space-y-2">
    <Label>Samples</Label>
    <div class="flex flex-wrap gap-2">
      {#each SAMPLES as s}
        <Button variant="outline" size="sm" onclick={() => canvasApi.loadSrc(s.src)}>{s.name}</Button>
      {/each}
    </div>
    <input type="file" accept="image/*" onchange={onFile} class="text-sm" />
  </div>
  <div class="flex gap-2">
    <Button onclick={exportPng}>Download PNG</Button>
    <Button variant="secondary" onclick={exportSvg}>Download SVG</Button>
  </div>
</div>
```

- [ ] **Step 2: Implement App.svelte**
```svelte
<script lang="ts">
  import Canvas from "$lib/components/Canvas.svelte";
  import Controls from "$lib/components/Controls.svelte";
  import * as Card from "$lib/components/ui/card";
  let canvas = $state<ReturnType<typeof Canvas>>();
</script>

<main class="min-h-screen bg-background text-foreground p-6 flex flex-col lg:flex-row gap-6 items-start">
  <div class="flex-1 flex justify-center w-full">
    <Canvas bind:this={canvas} />
  </div>
  <Card.Root class="w-full lg:w-80 shrink-0">
    <Card.Header><Card.Title>Triangle Art</Card.Title></Card.Header>
    <Card.Content>
      {#if canvas}
        <Controls canvasApi={canvas} />
      {/if}
    </Card.Content>
  </Card.Root>
</main>
```
(Note: `bind:this` on a Svelte 5 component returns its exported API; confirm the exported functions in Canvas.svelte are accessible. If component-instance exports aren't directly bindable, expose the API via a callback prop instead — verify pattern in integration.)

- [ ] **Step 3: Typecheck + build** — `npx svelte-check` then `npm run build` — Expected: success.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Add Controls + App layout, wire exports"`

---

## Task 12: Integration verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite** — `npm test` — Expected: all engine tests pass.
- [ ] **Step 2: Run dev server + drive with agent-browser**
  - Confirm: page loads, Turing portrait animates triangle-by-triangle to completion.
  - Drag the Detail slider → mesh resets and re-animates at new density.
  - Drag Build speed → animation pace changes without resetting an in-progress build.
  - Drag Line weight → strokes thicken live, no reset.
  - Swap background to white and line to black → polarity flips, mesh re-animates with detail in the previously-dark regions.
  - Click a sample / choose a file → loads and re-animates; canvas resizes to image.
  - Download PNG → opens as a raster image.
  - Download SVG → opens as crisp vector; line count matches segment count.
  - Check heap stays bounded (no OOM) and no console errors.
- [ ] **Step 3: Final commit** — `git add -A && git commit -m "Verify interactive demo integration"`

---

## Self-Review

**Spec coverage:**
- Watch it build → Task 5 (incremental generator) + Task 10 (rAF loop). ✓
- Live controls (threshold, build speed, line weight, colors) → Task 11 + re-gen wiring Task 10. ✓
- Color↔polarity coupling → Task 9 (derivePolarity) + Task 10 (re-gen on flip). ✓
- Bring your own image (drag-drop + button + default + samples) → Task 8 + Task 10 (drop) + Task 11 (button/samples). ✓
- PNG + SVG export → Task 7 + Task 11. ✓
- Drop p5/React, modernize toolchain → Task 1. ✓
- Framework-agnostic, Node-testable engine → Tasks 2–5, 9 (all pure TS with tests). ✓
- Bounds clamp (OOM fix) + maxNodes → Task 4 + Task 5 (tested). ✓

**Placeholder scan:** No TBD/TODO; every code step has real code. Two integration notes flag patterns to verify at runtime (Svelte component-instance export binding; effect interplay) rather than leaving logic unspecified.

**Type consistency:** `Segment`/`Point` defined in Task 2 and reused everywhere; `ImageLike` defined in Task 4, consumed in 5/8/10; `RenderStyle` defined in Task 6, consumed in 7/10/11; `SubdivideOn`/`GeneratorOptions` defined in Task 5; `derivePolarity` signature consistent across Tasks 9/10. Generator API (`reset`, `step`, `segments`, `done`) consistent across Tasks 5/10.
