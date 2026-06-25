import { test, expect } from "vitest";
import { TriangleGenerator } from "./generator";
import type { ImageLike } from "./analysis";

function edgeImage(w: number, h: number): ImageLike {
  // left third black, rest white -> a bright region that should subdivide
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = x < w / 3 ? 0 : 255;
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

test("starts with 4 border segments after reset", () => {
  const g = new TriangleGenerator();
  g.reset(edgeImage(128, 128), { threshold: 0.01 });
  expect(g.segments.length).toBe(4);
  expect(g.done).toBe(false);
});

test("terminates and is deterministic", () => {
  const run = () => {
    const g = new TriangleGenerator();
    g.reset(edgeImage(128, 128), { threshold: 0.01 });
    let guard = 0;
    while (!g.done && guard++ < 1_000_000) g.step(2000);
    expect(g.done).toBe(true);
    return g.segments.length;
  };
  expect(run()).toBe(run());
});

test("step returns only newly emitted segments", () => {
  const g = new TriangleGenerator();
  g.reset(edgeImage(128, 128), { threshold: 0.01 });
  const before = g.segments.length;
  const emitted = g.step(10);
  expect(g.segments.length).toBe(before + emitted.length);
});

test("cutoffs are monotone (filter == fresh rebuild at threshold)", () => {
  const img = edgeImage(128, 128);
  const floor = 0.002;
  const built = new TriangleGenerator();
  built.reset(img, { threshold: floor });
  while (!built.done) built.step(4000);
  for (const T of [0.005, 0.01, 0.02, 0.04]) {
    const filtered = built.segments.filter((s) => s.cutoff >= T).length;
    const fresh = new TriangleGenerator();
    fresh.reset(img, { threshold: T });
    while (!fresh.done) fresh.step(4000);
    expect(filtered).toBe(fresh.segments.length);
  }
});

test("respects maxNodes safety bound", () => {
  const g = new TriangleGenerator();
  g.reset(edgeImage(128, 128), { threshold: 0.00001, maxNodes: 50 });
  let guard = 0;
  while (!g.done && guard++ < 1_000_000) g.step(1000);
  expect(g.done).toBe(true);
});
