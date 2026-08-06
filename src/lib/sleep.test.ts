import { describe, expect, it } from "vitest";
import { calculateSleepDurationMinutes, formatCompactSleepDuration, formatSleepDuration } from "./sleep";

describe("sleep duration", () => {
  it("calculates sleep across midnight", () => {
    expect(calculateSleepDurationMinutes("23:30", "07:00")).toBe(450);
  });

  it("calculates sleep within the same day", () => {
    expect(calculateSleepDurationMinutes("01:10", "08:00")).toBe(410);
  });

  it("does not invent a duration from incomplete or ambiguous times", () => {
    expect(calculateSleepDurationMinutes("23:30", null)).toBeNull();
    expect(calculateSleepDurationMinutes("08:00", "08:00")).toBeNull();
  });

  it("formats a readable duration", () => {
    expect(formatSleepDuration(430)).toBe("7 小时 10 分钟");
  });

  it("formats averaged minutes without floating-point noise", () => {
    expect(formatCompactSleepDuration(405.7)).toBe("6h 46m");
    expect(formatCompactSleepDuration(null)).toBe("—");
  });
});
