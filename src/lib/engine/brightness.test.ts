import { test, expect } from "vitest";
import { getAverageBrightnessInTriangle, type ImageLike } from "./brightness";

function solid(w: number, h: number, v: number): ImageLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h };
}

test("solid gray returns that brightness", () => {
  const img = solid(50, 50, 128);
  const b = getAverageBrightnessInTriangle(img, [
    { x: 0, y: 0 },
    { x: 49, y: 0 },
    { x: 0, y: 49 },
  ], 10);
  expect(b).toBeCloseTo(128, 0);
});

test("a large triangle does not skip over a thin bright feature", () => {
  // Black image with a thin (8px) bright vertical stripe — a sharp edge.
  const W = 1000;
  const H = 1000;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = x >= 496 && x < 504 ? 255 : 0;
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const img: ImageLike = { data, width: W, height: H };
  // Large triangle covering the stripe; default maxSample must still detect it
  // (otherwise the triangle's mean is 0 and it never subdivides -> a "gap").
  const big = [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 0, y: 1000 },
  ];
  expect(getAverageBrightnessInTriangle(img, big, 10)).toBeGreaterThan(0.5);
});

test("edge-touching triangle does not produce NaN (bounds clamp)", () => {
  const img = solid(40, 40, 128);
  // Corners on the far edges -> samples round to x==40 / y==40 without clamping.
  const b = getAverageBrightnessInTriangle(img, [
    { x: 0, y: 40 },
    { x: 40, y: 40 },
    { x: 0, y: 0 },
  ], 10);
  expect(Number.isNaN(b)).toBe(false);
  expect(b).toBeCloseTo(128, 0);
});
