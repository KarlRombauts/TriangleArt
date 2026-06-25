import { test, expect } from "vitest";
import { createImageRectangle, rectangleBorderSegments } from "./tree";
import { triangleArea } from "./geometry";

test("rectangle has 4 points and area w*h", () => {
  const r = createImageRectangle(100, 80);
  expect(r.points.length).toBe(4);
  expect(r.area).toBeCloseTo(100 * 80);
});
test("rectangle divides into two triangles and emits one diagonal segment", () => {
  const r = createImageRectangle(100, 80);
  const { children, segments } = r.divideRectangle();
  expect(children.length).toBe(2);
  expect(children.every((c) => c.points.length === 3)).toBe(true);
  expect(segments.length).toBe(1);
});
test("depth increments", () => {
  const r = createImageRectangle(100, 80);
  expect(r.depth).toBe(1);
  expect(r.divideRectangle().children[0].depth).toBe(2);
});
test("rectangleBorderSegments returns 4 edges", () => {
  const r = createImageRectangle(100, 80);
  expect(rectangleBorderSegments(r).length).toBe(4);
});

import { triangleMinAngleDeg } from "./geometry";

test("triangle area is correct for a non-right child", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const child = tri.divideTriangle().children[0];
  const [a, b, c] = child.points;
  expect(child.area).toBeCloseTo(triangleArea(a, b, c));
});
test("divideTriangle emits one cevian and two children sharing the cut vertex", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const { children, segments } = tri.divideTriangle();
  expect(children.length).toBe(2);
  expect(segments.length).toBe(1);
  // both children share the new cut vertex as their first point (foot)
  expect(children[0].points[0]).toEqual(children[1].points[0]);
});
test("divideTriangle is deterministic (same triangle -> same split)", () => {
  const mk = () => createImageRectangle(100, 80).divideRectangle().children[0].divideTriangle();
  expect(mk().children[0].points[0]).toEqual(mk().children[0].points[0]);
});
test("jittered split keeps child angles >= 10 degrees", () => {
  const r = createImageRectangle(100, 80);
  // subdivide a few generations and check no sliver children appear
  let nodes = r.divideRectangle().children;
  for (let gen = 0; gen < 4; gen++) {
    const next: typeof nodes = [];
    for (const n of nodes) {
      const kids = n.divideTriangle().children;
      for (const k of kids) {
        const [a, b, c] = k.points;
        expect(triangleMinAngleDeg(a, b, c)).toBeGreaterThanOrEqual(10 - 1e-6);
      }
      next.push(...kids);
    }
    nodes = next;
  }
});
test("inheritedCutoff defaults to Infinity", () => {
  const r = createImageRectangle(100, 80);
  expect(r.inheritedCutoff).toBe(Infinity);
});
