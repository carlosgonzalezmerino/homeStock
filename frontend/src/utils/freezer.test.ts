import { describe, it, expect } from "vitest";
import { freezerCreateFields, locationPatch, normalizeLocation } from "./freezer";
import { localIsoDate } from "./date";

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
