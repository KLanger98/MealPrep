import { describe, expect, it } from "vitest";
import { nextWeekday } from "../../app/lib/dates";

const FRIDAY = 5;
const SATURDAY = 6;

describe("nextWeekday", () => {
  // 2026-07-12 is a Sunday.
  it("finds the next occurrence of a weekday", () => {
    expect(nextWeekday("2026-07-12", FRIDAY)).toBe("2026-07-17");
    expect(nextWeekday("2026-07-12", SATURDAY)).toBe("2026-07-18");
  });

  it("returns the date itself when it already falls on the weekday", () => {
    expect(nextWeekday("2026-07-17", FRIDAY)).toBe("2026-07-17");
    expect(nextWeekday("2026-07-18", SATURDAY)).toBe("2026-07-18");
  });

  it("crosses month and year boundaries", () => {
    expect(nextWeekday("2026-07-26", FRIDAY)).toBe("2026-07-31");
    expect(nextWeekday("2026-12-27", FRIDAY)).toBe("2027-01-01");
  });
});
