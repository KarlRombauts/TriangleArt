import { test, expect } from "vitest";
import { analyzeTriangle, type ImageLike } from "./analysis";

function halfSplit(w: number, h: number, edgeX: number): ImageLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = x >= edgeX ? 255 : 0;
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

test("uniform white triangle reports mean ~255", () => {
  const w = 200,
    h = 200;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const a = analyzeTriangle({ data, width: w, height: h }, [
    { x: 0, y: 0 },
    { x: 199, y: 0 },
    { x: 0, y: 199 },
  ]);
  expect(a).not.toBeNull();
  expect(a!.mean).toBeCloseTo(255, 0);
});

test("triangle over a vertical edge: mean ~half, cut near the edge", () => {
  const w = 201,
    h = 151;
  const img = halfSplit(w, h, 100);
  // Symmetric triangle: apex directly above the image edge (x=100), longest edge
  // is the bottom (0,0)-(200,0). The fan from the apex straight down meets the
  // bottom at its midpoint, where the image edge is -> best split ~0.5.
  const a = analyzeTriangle(img, [
    { x: 100, y: 140 },
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ]);
  expect(a).not.toBeNull();
  expect(a!.mean).toBeGreaterThan(80);
  expect(a!.mean).toBeLessThan(175);
  expect(a!.splitParam).toBeGreaterThan(0.4);
  expect(a!.splitParam).toBeLessThan(0.6);
});

test("returns null for a sub-minArea triangle", () => {
  const img = halfSplit(50, 50, 25);
  const a = analyzeTriangle(img, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ], 100);
  expect(a).toBeNull();
});
