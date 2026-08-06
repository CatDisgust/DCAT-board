import { describe, expect, it } from "vitest";
import { analyzeBodyMeasurements, analyzeRecords, ruleBasedNarrative, todayMetricComparison } from "./analytics";
import { emptyRecord, type BodyMeasurement, type DailyRecord } from "./types";

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

  it("uses adjacent calendar windows instead of the last 14 stored rows", () => {
    const records = [
      ...Array.from({ length: 7 }, (_, index) => day(`2026-07-${String(index + 1).padStart(2, "0")}`, { weight: 72 })),
      day("2026-07-14", { weight: 71 }),
    ];
    const result = analyzeRecords(records);
    expect(result.weight.sample).toBe(1);
    expect(result.weight.trend).toBe("insufficient");
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

  it("rounds average sleep to a whole minute", () => {
    const records = [400, 401, 402, 403, 404, 424].map((minutes, index) => day(`2026-07-${String(index + 1).padStart(2, "0")}`, {
      sleep_duration_minutes: minutes,
    }));
    const result = analyzeRecords(records);
    expect(result.sleep.averageMinutes).toBe(406);
  });

  it("uses a 0.3 percentage-point stable band for body fat", () => {
    const records = Array.from({ length: 14 }, (_, index) => day(`2026-07-${String(index + 1).padStart(2, "0")}`, {
      body_fat_percentage: index < 7 ? 18.5 : 18.7,
    }));
    expect(analyzeRecords(records).bodyFat.trend).toBe("stable");
  });

  it("compares today's metric only with earlier valid records", () => {
    const records = [
      day("2026-07-01", { weight: 72 }),
      day("2026-07-02", { weight: 71 }),
      day("2026-07-03", { weight: 70 }),
      day("2026-07-04", { weight: 68 }),
    ];
    const comparison = todayMetricComparison(records, "2026-07-04", "weight");
    expect(comparison.baseline).toBe(71);
    expect(comparison.change).toBe(-3);
  });

  it("keeps the general analysis narrative independent from body metrics", () => {
    const records = [day("2026-07-01", { weight: 72, evening_completed_at: "2026-07-01T12:00:00Z" })];
    const narrative = ruleBasedNarrative(analyzeRecords(records));
    expect(narrative.current).not.toContain("体重");
    expect(narrative.current).toContain("晚间记录");
  });
});

describe("analyzeBodyMeasurements", () => {
  it("compares the latest two measurements and keeps only 12 chart points", () => {
    const measurements: BodyMeasurement[] = Array.from({ length: 13 }, (_, index) => ({
      measurement_date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      chest_cm: 100 - index * 0.1,
      waist_cm: 90 - index * 0.2,
      hip_cm: 101 - index * 0.1,
    }));
    const result = analyzeBodyMeasurements(measurements);
    expect(result.change.waist).toBe(-0.2);
    expect(result.chart).toHaveLength(12);
    expect(result.chart[0].measurement_date).toBe("2026-07-02");
  });
});
