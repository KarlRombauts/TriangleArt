import { test, expect } from "vitest";
import { segmentsToSvg } from "./exportSvg";

test("produces valid svg with a line per segment and background rect", () => {
  const svg = segmentsToSvg(
    [{ x1: 0, y1: 0, x2: 10, y2: 10 }],
    100,
    80,
    { background: "#000000", line: "#ffffff", lineWidth: 1.5 },
  );
  expect(svg).toContain('width="100"');
  expect(svg).toContain('height="80"');
  expect(svg).toContain("<rect");
  expect(svg).toContain('fill="#000000"');
  expect(svg).toContain('<line x1="0" y1="0" x2="10" y2="10"');
  expect(svg).toContain('stroke="#ffffff"');
  expect((svg.match(/<line/g) || []).length).toBe(1);
});
