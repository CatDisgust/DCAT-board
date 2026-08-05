import { describe, expect, it } from "vitest";
import { analyzeRecords } from "./analytics";
import { emptyRecord, type DailyRecord } from "./types";

const day = (date: string, patch: Partial<DailyRecord> = {}): DailyRecord => ({ ...emptyRecord(date), ...patch });

describe("analyzeRecords", () => {
  it("compares two 7-day averages instead of a single-day weight", () => {
    const records = Array.from({ length: 14 }, (_, index) => day(`2026-07-${String(index + 1).padStart(2, "0")}`, {
      weight: index < 7 ? 72 : 71.5,
      morning_completed_at: "2026-07-01T00:00:00Z",
    }));
    const result = analyzeRecords(records);
    expect(result.weight.trend).toBe("down");
    expect(result.weight.change).toBe(-0.5);
  });

  it("never treats missing values as zero", () => {
    const records = Array.from({ length: 14 }, (_, index) => day(`2026-07-${String(index + 1).padStart(2, "0")}`, {
      weight: index === 13 ? 71 : null,
    }));
    const result = analyzeRecords(records);
    expect(result.weight.trend).toBe("insufficient");
    expect(result.weight.recentMean).toBe(71);
  });

  it("pairs an evening boundary with the next morning, not the same date", () => {
    const records = [
      day("2026-07-01", { boundary_violated: true, thoughts_expanding_at_night: true, sleep_start_time: "22:00" }),
      day("2026-07-02", { sleep_start_time: "00:40", sleep_duration_minutes: 370, morning_clarity: "tired" }),
    ];
    const result = analyzeRecords(records);
    expect(result.boundary.violated.n).toBe(1);
    expect(result.boundary.violated.bedtime).toBe(1480);
    expect(result.boundary.violated.duration).toBe(370);
    expect(result.boundary.violated.clarity).toBe(2);
  });
});
