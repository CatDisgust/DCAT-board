import { describe, expect, it } from "vitest";
import { dateInTimeZone } from "./user-date";

describe("dateInTimeZone", () => {
  it("uses the profile timezone instead of the server date", () => {
    const instant = new Date("2026-08-05T15:30:00Z");
    expect(dateInTimeZone(instant, "Australia/Sydney")).toBe("2026-08-06");
    expect(dateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-08-05");
  });
});
