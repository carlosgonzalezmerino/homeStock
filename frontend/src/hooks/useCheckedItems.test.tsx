import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCheckedItems } from "./useCheckedItems";

describe("useCheckedItems", () => {
  it("test_useCheckedItems_nothingStored_startsEmpty", () => {
    const { result } = renderHook(() => useCheckedItems(["1111111111111"]));
    expect(result.current.checked.size).toBe(0);
  });

  it("test_toggle_onceOnAnEan_marksIt", () => {
    const { result } = renderHook(() => useCheckedItems(["1111111111111"]));
    act(() => result.current.toggle("1111111111111"));
    expect(result.current.checked.has("1111111111111")).toBe(true);
  });

  it("test_toggle_twiceOnTheSameEan_unmarksIt", () => {
    const { result } = renderHook(() => useCheckedItems(["1111111111111"]));
    act(() => result.current.toggle("1111111111111"));
    act(() => result.current.toggle("1111111111111"));
    expect(result.current.checked.has("1111111111111")).toBe(false);
  });

  it("test_toggle_isSavedToStorage", () => {
    const { result } = renderHook(() => useCheckedItems(["1111111111111"]));
    act(() => result.current.toggle("1111111111111"));
    expect(localStorage.getItem("shoppingChecked")).toBe(JSON.stringify(["1111111111111"]));
  });

  it("test_useCheckedItems_storedMark_isRestoredWhenStillOnTheList", () => {
    localStorage.setItem("shoppingChecked", JSON.stringify(["1111111111111"]));
    const { result } = renderHook(() => useCheckedItems(["1111111111111"]));
    expect(result.current.checked.has("1111111111111")).toBe(true);
  });

  it("test_useCheckedItems_storedMarkNoLongerOnTheList_isDropped", () => {
    localStorage.setItem("shoppingChecked", JSON.stringify(["9999999999999"]));
    const { result } = renderHook(() => useCheckedItems(["1111111111111"]));
    expect(result.current.checked.has("9999999999999")).toBe(false);
  });

  it("test_clear_givenEans_unmarksOnlyThose", () => {
    const { result } = renderHook(() => useCheckedItems(["1111111111111", "2222222222222"]));
    act(() => {
      result.current.toggle("1111111111111");
      result.current.toggle("2222222222222");
    });
    act(() => result.current.clear(["1111111111111"]));
    expect(result.current.checked.has("1111111111111")).toBe(false);
    expect(result.current.checked.has("2222222222222")).toBe(true);
  });

  it("test_useCheckedItems_storageBlocked_stillWorksInMemory", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => useCheckedItems(["1111111111111"]));
    act(() => result.current.toggle("1111111111111"));
    expect(result.current.checked.has("1111111111111")).toBe(true);
    vi.restoreAllMocks();
  });
});
