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
