import { test, expect } from "vitest";
import { encodeSegments, decodeSegments } from "./protocol";

test("segments round-trip through Float32Array", () => {
  const segs = [
    { x1: 1, y1: 2, x2: 3, y2: 4, cutoff: 0.5 },
    { x1: 5, y1: 6, x2: 7, y2: 8, cutoff: Infinity },
  ];
  const back = decodeSegments(encodeSegments(segs));
  expect(back.length).toBe(2);
  expect(back[0]).toEqual(segs[0]);
  expect(back[1].cutoff).toBe(Infinity);
});
