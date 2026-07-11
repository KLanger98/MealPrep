import { describe, expect, it } from "vitest";
import {
  canonicalize,
  humanize,
  normalizeUnit,
} from "../../app/lib/unit-normalizer";

// Ported from tests/Unit/UnitNormalizerTest.php
describe("normalizeUnit", () => {
  it("normalizes aliases", () => {
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit(" G ")).toBe("g");
    expect(normalizeUnit("tablespoons")).toBe("tbsp");
    expect(normalizeUnit("each")).toBe("whole");
    expect(normalizeUnit("tins")).toBe("can");
  });

  it("passes unknown units through", () => {
    expect(normalizeUnit("Rasher")).toBe("rasher");
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit("  ")).toBeNull();
  });
});

describe("canonicalize", () => {
  it("canonicalizes metric pairs", () => {
    expect(canonicalize(1.5, "kg")).toEqual([1500, "g"]);
    expect(canonicalize(2, "litres")).toEqual([2000, "ml"]);
    expect(canonicalize(500, "g")).toEqual([500, "g"]);
    expect(canonicalize(3, "tbsp")).toEqual([3, "tbsp"]);
  });
});

describe("humanize", () => {
  it("humanizes large canonical quantities", () => {
    expect(humanize(1800, "g")).toEqual([1.8, "kg"]);
    expect(humanize(900, "g")).toEqual([900, "g"]);
    expect(humanize(1250, "ml")).toEqual([1.25, "l"]);
  });
});
