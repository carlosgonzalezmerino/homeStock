import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ScanResult } from "@/types";
import { usePurchaseSession } from "./usePurchaseSession";

const RESULT: ScanResult = { status: "applied", mode: "purchase", ean: "111", name: "Leche", movement_id: 7 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePurchaseSession", () => {
  it("test_usePurchaseSession_startsEmpty", () => {
    const { result } = renderHook(() => usePurchaseSession());
    expect(result.current).toMatchObject({ lines: [], unknown: [], count: 0 });
  });

  it("test_usePurchaseSession_recordScan_addsTheLineAndCountsIt", () => {
    const { result } = renderHook(() => usePurchaseSession());
    act(() => result.current.recordScan(RESULT));
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.count).toBe(1);
  });

  it("test_usePurchaseSession_recordUndo_takesTheUnitBack", () => {
    const { result } = renderHook(() => usePurchaseSession());
    act(() => result.current.recordScan(RESULT));
    act(() => result.current.recordUndo("111", 7));
    expect(result.current.count).toBe(0);
  });

  it("test_usePurchaseSession_survivesAReload", () => {
    const first = renderHook(() => usePurchaseSession());
    act(() => first.result.current.recordScan(RESULT));
    first.unmount();
    const second = renderHook(() => usePurchaseSession());
    expect(second.result.current.lines[0]).toMatchObject({ ean: "111", units: 1 });
  });

  it("test_usePurchaseSession_clear_emptiesItAndTheStorage", () => {
    const { result } = renderHook(() => usePurchaseSession());
    act(() => result.current.recordScan(RESULT));
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
    expect(JSON.parse(localStorage.getItem("purchaseSession") ?? "{}")).toEqual({ lines: [], unknown: [] });
  });

  it("test_usePurchaseSession_clearThenUnmountInTheSameTick_stillSavesTheEmptySession", () => {
    const { result, unmount } = renderHook(() => usePurchaseSession());
    act(() => result.current.recordScan(RESULT));
    // "Terminar" clears and leaves the screen in one click; no render happens in between.
    act(() => {
      result.current.clear();
      unmount();
    });
    expect(JSON.parse(localStorage.getItem("purchaseSession") ?? "{}")).toEqual({ lines: [], unknown: [] });
  });

  it("test_usePurchaseSession_twoScansInTheSameTick_bothCount", () => {
    const { result } = renderHook(() => usePurchaseSession());
    act(() => {
      result.current.recordScan(RESULT);
      result.current.recordScan({ ...RESULT, movement_id: 8 });
    });
    expect(result.current.lines[0].units).toBe(2);
  });

  it("test_usePurchaseSession_forgetRegistered_dropsRegisteredCodes", () => {
    const unknown: ScanResult = { status: "unknown", mode: "purchase", ean: "999" };
    const { result } = renderHook(() => usePurchaseSession());
    act(() => result.current.recordScan(unknown));
    act(() => result.current.forgetRegistered(new Set(["999"])));
    expect(result.current.unknown).toEqual([]);
  });

  it("test_usePurchaseSession_garbageInStorage_startsEmpty", () => {
    localStorage.setItem("purchaseSession", "{\"nope\":1}");
    const { result } = renderHook(() => usePurchaseSession());
    expect(result.current.count).toBe(0);
  });

  it("test_usePurchaseSession_unparsableStorage_startsEmptyAndWarns", () => {
    localStorage.setItem("purchaseSession", "not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => usePurchaseSession());
    expect(result.current.count).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it("test_usePurchaseSession_storageBlocked_keepsWorkingInMemory", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => usePurchaseSession());
    act(() => result.current.recordScan(RESULT));
    expect(result.current.count).toBe(1);
    expect(warn).toHaveBeenCalled();
  });
});
