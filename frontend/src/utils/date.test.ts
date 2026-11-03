import { describe, it, expect } from "vitest";
import { localIsoDate } from "./date";

describe("localIsoDate", () => {
  it("test_localIsoDate_singleDigitMonthAndDay_padsWithZero", () => {
    expect(localIsoDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });

  it("test_localIsoDate_lateEvening_usesLocalCalendarDay", () => {
    expect(localIsoDate(new Date(2026, 10, 2, 23, 59))).toBe("2026-11-02");
  });
});
