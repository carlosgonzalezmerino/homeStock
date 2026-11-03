import { describe, it, expect } from "vitest";
import type { ScanResult } from "@/types";
import { EMPTY_SESSION, addScan, countSession, dropRegistered, removeUnit } from "./purchaseSession";

/** A purchase scan answer, with the fields a test does not care about filled in. */
function scan(overrides: Partial<ScanResult> = {}): ScanResult {
  return { status: "applied", mode: "purchase", ean: "111", name: "Leche", movement_id: 1, ...overrides };
}

describe("addScan", () => {
  it("test_addScan_firstUnitOfAProduct_createsALineWithOneUnit", () => {
    const next = addScan(EMPTY_SESSION, scan());
    expect(next.lines).toEqual([
      { ean: "111", name: "Leche", imageUrl: null, units: 1, isNew: false, movementIds: [1] },
    ]);
  });

  it("test_addScan_sameProductAgain_addsAUnitToTheSameLine", () => {
    const next = addScan(addScan(EMPTY_SESSION, scan()), scan({ movement_id: 2 }));
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]).toMatchObject({ units: 2, movementIds: [1, 2] });
  });

  it("test_addScan_createdStatus_marksTheLineAsNew", () => {
    const next = addScan(EMPTY_SESSION, scan({ status: "created" }));
    expect(next.lines[0].isNew).toBe(true);
  });

  it("test_addScan_newProductScannedAgain_staysMarkedAsNew", () => {
    const first = addScan(EMPTY_SESSION, scan({ status: "created" }));
    expect(addScan(first, scan({ movement_id: 2 })).lines[0].isNew).toBe(true);
  });

  it("test_addScan_unknownCode_isQueuedOnce", () => {
    const unknown = scan({ status: "unknown", ean: "999", name: null, movement_id: null });
    const next = addScan(addScan(EMPTY_SESSION, unknown), unknown);
    expect(next.unknown).toEqual(["999"]);
  });

  it("test_addScan_consumeMode_leavesTheSessionUntouched", () => {
    expect(addScan(EMPTY_SESSION, scan({ mode: "consume" }))).toBe(EMPTY_SESSION);
  });

  it("test_addScan_scanThatChangedNothing_leavesTheSessionUntouched", () => {
    expect(addScan(EMPTY_SESSION, scan({ status: "already_empty" }))).toBe(EMPTY_SESSION);
  });

  it("test_addScan_missingNameAndMovement_fallsBackToTheEan", () => {
    const next = addScan(EMPTY_SESSION, scan({ name: null, movement_id: null }));
    expect(next.lines[0]).toMatchObject({ name: "111", movementIds: [] });
  });
});

describe("removeUnit", () => {
  it("test_removeUnit_lineWithTwoUnits_keepsOneAndForgetsTheMovement", () => {
    const two = addScan(addScan(EMPTY_SESSION, scan()), scan({ movement_id: 2 }));
    const next = removeUnit(two, "111", 2);
    expect(next.lines[0]).toMatchObject({ units: 1, movementIds: [1] });
  });

  it("test_removeUnit_lastUnit_removesTheLine", () => {
    const one = addScan(EMPTY_SESSION, scan());
    expect(removeUnit(one, "111", 1).lines).toEqual([]);
  });

  it("test_removeUnit_productNotInTheSession_returnsTheSameSession", () => {
    expect(removeUnit(EMPTY_SESSION, "111", 1)).toBe(EMPTY_SESSION);
  });
});

describe("dropRegistered and countSession", () => {
  it("test_dropRegistered_removesOnlyTheRegisteredCodes", () => {
    const data = { lines: [], unknown: ["1", "2", "3"] };
    expect(dropRegistered(data, new Set(["2"])).unknown).toEqual(["1", "3"]);
  });

  it("test_dropRegistered_nothingToDrop_returnsTheSameObject", () => {
    const data = { lines: [], unknown: ["1"] };
    expect(dropRegistered(data, new Set(["9"]))).toBe(data);
  });

  it("test_countSession_addsUnitsAndUnknownCodes", () => {
    let data = addScan(EMPTY_SESSION, scan());
    data = addScan(data, scan({ movement_id: 2 }));
    data = addScan(data, scan({ status: "unknown", ean: "9", movement_id: null }));
    expect(countSession(data)).toBe(3);
  });

  it("test_countSession_emptySession_isZero", () => {
    expect(countSession(EMPTY_SESSION)).toBe(0);
  });
});
