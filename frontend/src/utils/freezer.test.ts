import { describe, it, expect } from "vitest";
import {
  compareByFreezerAge,
  formatFrozenAge,
  freezerCreateFields,
  isFreezerStale,
  locationPatch,
  monthsFrozen,
  normalizeLocation,
} from "./freezer";
import { localIsoDate } from "./date";
import type { InventoryOut } from "@/types";

/** A fixed "today" so the age tests never depend on when they run. */
const TODAY = new Date(2026, 10, 3);

/**
 * Builds the ISO date a number of days before {@link TODAY}.
 *
 * @param days - How many days before today.
 * @returns The local ISO date, as `frozen_at` stores it.
 */
function daysAgo(days: number): string {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - days);
  return localIsoDate(date);
}

/**
 * Builds the minimal inventory row {@link compareByFreezerAge} needs.
 *
 * @param frozenAt - The frozen date to give the row, or `null` for none.
 * @returns An inventory row with that frozen date.
 */
function row(frozenAt: string | null): InventoryOut {
  return { id: 1, ean: "EAN", quantity: 1, threshold: 1, unit: "units", frozen_at: frozenAt };
}

describe("normalizeLocation", () => {
  it("test_normalizeLocation_missingValue_returnsPantry", () => {
    expect(normalizeLocation(null)).toBe("pantry");
  });

  it("test_normalizeLocation_freezer_returnsFreezer", () => {
    expect(normalizeLocation("freezer")).toBe("freezer");
  });
});

describe("freezerCreateFields", () => {
  it("test_freezerCreateFields_pantry_returnsNoFields", () => {
    expect(freezerCreateFields("pantry", 2, "2026-10-01")).toEqual({});
  });

  it("test_freezerCreateFields_freezerWithoutDate_usesToday", () => {
    expect(freezerCreateFields("freezer", null, null)).toEqual({ drawer: null, frozen_at: localIsoDate() });
  });

  it("test_freezerCreateFields_freezerWithDate_keepsDate", () => {
    expect(freezerCreateFields("freezer", 3, "2026-10-01")).toEqual({ drawer: 3, frozen_at: "2026-10-01" });
  });
});

describe("locationPatch", () => {
  it("test_locationPatch_sameLocation_returnsEmptyPatch", () => {
    expect(locationPatch("pantry", "pantry")).toEqual({});
  });

  it("test_locationPatch_movingIntoFreezer_addsTodayAsFrozenDate", () => {
    expect(locationPatch("pantry", "freezer")).toEqual({ location: "freezer", frozen_at: localIsoDate() });
  });

  it("test_locationPatch_movingOutOfFreezer_onlySendsLocation", () => {
    expect(locationPatch("freezer", "pantry")).toEqual({ location: "pantry" });
  });
});

describe("monthsFrozen", () => {
  it("test_monthsFrozen_missingDate_returnsNull", () => {
    expect(monthsFrozen(null, TODAY)).toBeNull();
  });

  it("test_monthsFrozen_fiveMonths_isBelowThreshold", () => {
    expect(monthsFrozen(daysAgo(150), TODAY)).toBe(5);
  });

  it("test_monthsFrozen_sixMonths_reachesThreshold", () => {
    expect(monthsFrozen(daysAgo(180), TODAY)).toBe(6);
  });
});

describe("formatFrozenAge", () => {
  it("test_formatFrozenAge_today_returnsHoy", () => {
    expect(formatFrozenAge(daysAgo(0), TODAY)).toBe("Hoy");
  });

  it("test_formatFrozenAge_yesterday_returnsAyer", () => {
    expect(formatFrozenAge(daysAgo(1), TODAY)).toBe("Ayer");
  });

  it("test_formatFrozenAge_twelveDays_returnsDaysText", () => {
    expect(formatFrozenAge(daysAgo(12), TODAY)).toBe("Hace 12 días");
  });

  it("test_formatFrozenAge_thirtyDays_staysInDays", () => {
    expect(formatFrozenAge(daysAgo(30), TODAY)).toBe("Hace 30 días");
  });

  it("test_formatFrozenAge_thirtyOneDays_switchesToOneMonth", () => {
    expect(formatFrozenAge(daysAgo(31), TODAY)).toBe("Hace 1 mes");
  });

  it("test_formatFrozenAge_ninetyFiveDays_returnsThreeMonths", () => {
    expect(formatFrozenAge(daysAgo(95), TODAY)).toBe("Hace 3 meses");
  });

  it("test_formatFrozenAge_missingDate_returnsNull", () => {
    expect(formatFrozenAge(null, TODAY)).toBeNull();
  });

  it("test_formatFrozenAge_futureDate_returnsHoyNotNegativeDays", () => {
    const tomorrow = new Date(TODAY);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatFrozenAge(localIsoDate(tomorrow), TODAY)).toBe("Hoy");
  });

  it("test_formatFrozenAge_invalidText_returnsNullWithoutThrowing", () => {
    expect(formatFrozenAge("not-a-date", TODAY)).toBeNull();
  });
});

describe("isFreezerStale", () => {
  it("test_isFreezerStale_fiveMonths_isNotStale", () => {
    expect(isFreezerStale(daysAgo(150), TODAY)).toBe(false);
  });

  it("test_isFreezerStale_sixMonths_isStale", () => {
    expect(isFreezerStale(daysAgo(180), TODAY)).toBe(true);
  });

  it("test_isFreezerStale_missingDate_isNotStale", () => {
    expect(isFreezerStale(null, TODAY)).toBe(false);
  });
});

describe("compareByFreezerAge", () => {
  it("test_compareByFreezerAge_olderFirst_returnsNegative", () => {
    expect(compareByFreezerAge(row(daysAgo(60)), row(daysAgo(10)), TODAY)).toBeLessThan(0);
  });

  it("test_compareByFreezerAge_newerSecond_returnsPositive", () => {
    expect(compareByFreezerAge(row(daysAgo(10)), row(daysAgo(60)), TODAY)).toBeGreaterThan(0);
  });

  it("test_compareByFreezerAge_missingDate_goesLast", () => {
    expect(compareByFreezerAge(row(null), row(daysAgo(10)), TODAY)).toBeGreaterThan(0);
  });

  it("test_compareByFreezerAge_bothMissingDates_returnsZero", () => {
    expect(compareByFreezerAge(row(null), row(null), TODAY)).toBe(0);
  });
});
