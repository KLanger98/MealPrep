import { describe, expect, it } from "vitest";
import { parseQuantity } from "../../app/lib/quantity-parser";

// Ported from tests/Unit/QuantityParserTest.php
describe("parseQuantity", () => {
  it.each([
    ["integer", 800, 800],
    ["float", 1.5, 1.5],
    ["numeric string", "2.5", 2.5],
    ["simple fraction", "1/2", 0.5],
    ["mixed number", "1 1/2", 1.5],
    ["fraction with spaces", "3 / 4", 0.75],
    ["null", null, null],
    ["empty string", "", null],
    ["prose", "to taste", null],
    ["zero denominator", "1/0", null],
  ] as Array<[string, unknown, number | null]>)(
    "%s",
    (_label, input, expected) => {
      expect(parseQuantity(input)).toBe(expected);
    },
  );
});
