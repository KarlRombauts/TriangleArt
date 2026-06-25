import { test, expect } from "vitest";
import { TriangleGenerator } from "./generator";
import type { ImageLike } from "./brightness";

function gradient(w: number, h: number): ImageLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / w) * 255);
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
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
  const run = () => {
    const g = new TriangleGenerator();
    g.reset(gradient(64, 64), { threshold: 0.05, subdivideOn: "bright" });
    let guard = 0;
    while (!g.done && guard++ < 100000) g.step(500);
    expect(g.done).toBe(true);
    return g.segments.length;
  };
  expect(run()).toBe(run());
});

test("step returns only newly emitted segments", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.05, subdivideOn: "bright" });
  const before = g.segments.length;
  const emitted = g.step(10);
  expect(g.segments.length).toBe(before + emitted.length);
});

// Asymmetric: a small bright square in a mostly-dark field. A linear gradient
// is antisymmetric, so bright/dark subdivision would mirror to equal counts;
// this image makes the two polarities genuinely diverge.
function brightCorner(w: number, h: number): ImageLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < w * 0.3 && y < h * 0.3 ? 255 : 30;
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

test("polarity changes the resulting mesh", () => {
  const mk = (s: "bright" | "dark") => {
    const g = new TriangleGenerator();
    g.reset(brightCorner(64, 64), { threshold: 0.05, subdivideOn: s });
    while (!g.done) g.step(500);
    return g.segments.length;
  };
  expect(mk("bright")).not.toBe(mk("dark"));
});

test("respects maxNodes safety bound", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.0001, subdivideOn: "bright", maxNodes: 50 });
  let guard = 0;
  while (!g.done && guard++ < 100000) g.step(1000);
  expect(g.done).toBe(true);
});

test("segments carry cutoff; borders are Infinity", () => {
  const g = new TriangleGenerator();
  g.reset(gradient(64, 64), { threshold: 0.002, subdivideOn: "bright" });
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
