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
