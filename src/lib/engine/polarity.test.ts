import { test, expect } from "vitest";
import { derivePolarity, relativeLuminance } from "./polarity";

test("white line on black bg subdivides bright", () => {
  expect(derivePolarity("#ffffff", "#000000")).toBe("bright");
});
test("black line on white bg subdivides dark", () => {
  expect(derivePolarity("#000000", "#ffffff")).toBe("dark");
});
test("luminance: white > black", () => {
  expect(relativeLuminance("#ffffff")).toBeGreaterThan(relativeLuminance("#000000"));
});
