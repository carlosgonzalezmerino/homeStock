import { describe, it, expect, vi, afterEach } from "vitest";
import { DEFAULT_SCAN_MODE, readStoredScanMode, writeStoredScanMode } from "./scanMode";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scan mode storage", () => {
  it("test_readStoredScanMode_nothingStored_returnsDetail", () => {
    expect(readStoredScanMode()).toBe(DEFAULT_SCAN_MODE);
  });

  it("test_writeStoredScanMode_purchase_isRemembered", () => {
    writeStoredScanMode("purchase");
    expect(readStoredScanMode()).toBe("purchase");
  });

  it("test_writeStoredScanMode_consume_isNeverWritten", () => {
    writeStoredScanMode("consume");
    expect(localStorage.getItem("scanMode")).toBeNull();
  });

  it("test_writeStoredScanMode_consumeAfterPurchase_keepsPurchase", () => {
    writeStoredScanMode("purchase");
    writeStoredScanMode("consume");
    expect(readStoredScanMode()).toBe("purchase");
  });

  it("test_readStoredScanMode_consumeFoundInStorage_isNotRestored", () => {
    localStorage.setItem("scanMode", "consume");
    expect(readStoredScanMode()).toBe("detail");
  });

  it("test_readStoredScanMode_garbageInStorage_returnsDetail", () => {
    localStorage.setItem("scanMode", "banana");
    expect(readStoredScanMode()).toBe("detail");
  });

  it("test_readStoredScanMode_storageBlocked_returnsDetailAndWarns", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readStoredScanMode()).toBe("detail");
    expect(warn).toHaveBeenCalled();
  });

  it("test_writeStoredScanMode_storageBlocked_doesNotThrow", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => writeStoredScanMode("purchase")).not.toThrow();
  });
});
