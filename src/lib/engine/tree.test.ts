import { test, expect } from "vitest";
import { createImageRectangle, rectangleBorderSegments } from "./tree";

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
test("rectangleBorderSegments returns 4 edges", () => {
  const r = createImageRectangle(100, 80);
  expect(rectangleBorderSegments(r).length).toBe(4);
});
