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

test("triangle area is correct for a non-right child", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const split = tri.splitTriangle(0.5);
  const child = split.children[0];
  const [a, b, c] = child.points;
  expect(child.area).toBeCloseTo(triangleArea(a, b, c));
});
test("splitTriangle emits one cevian and two children", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const { children, segments } = tri.splitTriangle(0.5);
  expect(children.length).toBe(2);
  expect(segments.length).toBe(1);
});
test("split point sits on the longest edge at s (shared new vertex)", () => {
  const r = createImageRectangle(100, 80);
  const tri = r.divideRectangle().children[0];
  const { children } = tri.splitTriangle(0.5);
  expect(children[0].points[2]).toEqual(children[1].points[1]);
});
test("inheritedCutoff defaults to Infinity", () => {
  const r = createImageRectangle(100, 80);
  expect(r.inheritedCutoff).toBe(Infinity);
});
