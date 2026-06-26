import { test, expect } from "vitest";
import {
  sub,
  mag,
  dot,
  add,
  scale,
  normalize,
  cross,
  triangleArea,
  longestEdge,
  triangleMinAngleDeg,
  raySegmentParam,
} from "./geometry";

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

test("triangleArea via cross product (non-right triangle)", () => {
  expect(triangleArea({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 3 })).toBeCloseTo(6);
});
test("cross product sign", () => {
  expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
});
test("longestEdge returns opposite vertex + edge", () => {
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
  const u = raySegmentParam({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 2 }, { x: 2, y: -2 });
  expect(u).toBeCloseTo(0.5, 5);
});
