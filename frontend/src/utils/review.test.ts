import { describe, it, expect } from "vitest";
import type { ReviewCandidate } from "@/types";
import { describeIdleTime, describeReviewReason } from "./review";

/** A review candidate with the fields a test does not care about filled in. */
function candidate(overrides: Partial<ReviewCandidate>): ReviewCandidate {
  return { ean: "1", name: "Leche", quantity: 2, unit: "units", reason: "stale", days_since_activity: 70, ...overrides };
}

describe("describeIdleTime", () => {
  it("test_describeIdleTime_oneDay_isSingular", () => {
    expect(describeIdleTime(1)).toBe("hace 1 día");
  });

  it("test_describeIdleTime_fewDays_usesDays", () => {
    expect(describeIdleTime(45)).toBe("hace 45 días");
  });

  it("test_describeIdleTime_sixtyDaysOrMore_usesRoundedMonths", () => {
    expect(describeIdleTime(60)).toBe("hace 2 meses");
    expect(describeIdleTime(100)).toBe("hace 3 meses");
  });
});

describe("describeReviewReason", () => {
  it("test_describeReviewReason_overdue_mentionsTheConsumptionPace", () => {
    expect(describeReviewReason(candidate({ reason: "overdue" }))).toContain("ritmo");
  });

  it("test_describeReviewReason_stale_saysHowLongAgo", () => {
    expect(describeReviewReason(candidate({ reason: "stale", days_since_activity: 95 }))).toBe(
      "Lo tocaste por última vez hace 3 meses",
    );
  });
});
