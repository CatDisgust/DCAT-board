import { describe, expect, it } from "vitest";
import { isRecordDate, recordDateOr } from "./record-date";

describe("record dates", () => {
  it("accepts a real ISO calendar date", () => {
    expect(isRecordDate("2026-08-05")).toBe(true);
  });

  it("rejects empty, malformed and impossible dates", () => {
    expect(isRecordDate("")).toBe(false);
    expect(isRecordDate("05-08-2026")).toBe(false);
    expect(isRecordDate("2026-02-30")).toBe(false);
  });

  it("falls back before an invalid date reaches the database", () => {
    expect(recordDateOr("", "2026-08-05")).toBe("2026-08-05");
  });
});
