import { describe, expect, it } from "vitest";
import {
  removeFrontmatterKey,
  setFrontmatterRating,
} from "../../app/lib/frontmatter-surgery";

const FILE = `---
title: Test
slug: test
rating: 6
servings: 2
---
## Method
Cook.`;

describe("setFrontmatterRating", () => {
  it("replaces an existing rating line", () => {
    const result = setFrontmatterRating(FILE, 8.5);
    expect(result).toContain("rating: 8.5");
    expect(result!.match(/rating:/g)).toHaveLength(1);
  });

  it("writes whole ratings without a decimal point", () => {
    expect(setFrontmatterRating(FILE, 8)).toContain("rating: 8\n");
  });

  it("appends when there is no rating line", () => {
    const noRating = FILE.replace("rating: 6\n", "");
    const result = setFrontmatterRating(noRating, 7);
    expect(result).toContain("rating: 7");
  });

  it("clears the rating with null", () => {
    const result = setFrontmatterRating(FILE, null);
    expect(result).not.toContain("rating:");
    expect(result).toContain("title: Test");
  });

  it("returns null when there is no frontmatter", () => {
    expect(setFrontmatterRating("# Just markdown", 5)).toBeNull();
  });

  it("leaves the body untouched", () => {
    expect(setFrontmatterRating(FILE, 3)).toContain("## Method\nCook.");
  });
});

describe("removeFrontmatterKey", () => {
  it("removes the key's line", () => {
    const withImage = FILE.replace("servings: 2", "image: images/x.jpg\nservings: 2");
    const result = removeFrontmatterKey(withImage, "image");
    expect(result).not.toContain("image:");
    expect(result).toContain("servings: 2");
  });

  it("returns contents unchanged when the key is absent", () => {
    expect(removeFrontmatterKey(FILE, "image")).toBe(FILE);
  });

  it("returns contents unchanged without frontmatter", () => {
    expect(removeFrontmatterKey("# md", "image")).toBe("# md");
  });
});
