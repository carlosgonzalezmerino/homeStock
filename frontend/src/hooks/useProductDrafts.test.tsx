import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuantityDraft, useSavedFieldDraft, useThresholdDraft } from "./useProductDrafts";
import { useDebouncedValue } from "./useDebouncedValue";
import { DEFAULT_NEW_QUANTITY, DEFAULT_THRESHOLD } from "@/constants/inventory";

afterEach(() => {
  vi.useRealTimers();
});

describe("useQuantityDraft", () => {
  it("test_useQuantityDraft_noServerValue_returnsDefaultQuantity", () => {
    const { result } = renderHook(() => useQuantityDraft(undefined));
    expect(result.current.value).toBe(DEFAULT_NEW_QUANTITY);
  });

  it("test_useQuantityDraft_serverValue_followsServerValue", () => {
    const { result } = renderHook(() => useQuantityDraft(7));
    expect(result.current.value).toBe(7);
  });

  it("test_useQuantityDraft_userChange_overridesServerValue", () => {
    const { result } = renderHook(() => useQuantityDraft(7));
    act(() => result.current.change(3));
    expect(result.current.value).toBe(3);
  });
});

describe("useThresholdDraft", () => {
  it("test_useThresholdDraft_noServerValue_returnsDefaultThreshold", () => {
    const { result } = renderHook(() => useThresholdDraft(undefined));
    expect(result.current.value).toBe(DEFAULT_THRESHOLD);
    expect(result.current.isDirty).toBe(false);
  });

  it("test_useThresholdDraft_serverValueChanges_updatesWhenNotDirty", () => {
    const { result, rerender } = renderHook(({ server }) => useThresholdDraft(server), {
      initialProps: { server: 2 as number | undefined },
    });
    rerender({ server: 5 });
    expect(result.current.value).toBe(5);
  });

  it("test_useThresholdDraft_userChange_marksDirtyAndIgnoresServerUpdates", () => {
    const { result, rerender } = renderHook(({ server }) => useThresholdDraft(server), {
      initialProps: { server: 2 as number | undefined },
    });
    act(() => result.current.change(4));
    rerender({ server: 9 });
    expect(result.current.value).toBe(4);
    expect(result.current.isDirty).toBe(true);
  });

  it("test_useThresholdDraft_markSaved_clearsDirtyFlag", () => {
    const { result } = renderHook(() => useThresholdDraft(2));
    act(() => result.current.change(4));
    act(() => result.current.markSaved());
    expect(result.current.isDirty).toBe(false);
  });
});

describe("useDebouncedValue", () => {
  it("test_useDebouncedValue_valueChangesQuickly_returnsOnlyAfterDelay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });
    rerender({ value: "ab" });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("ab");
  });
});

describe("useSavedFieldDraft", () => {
  it("test_useSavedFieldDraft_noServerValue_returnsTheFallback", () => {
    const { result } = renderHook(() => useSavedFieldDraft<string | null>(undefined, null));
    expect(result.current.value).toBeNull();
  });

  it("test_useSavedFieldDraft_serverValueIsNull_isKeptAsNullNotReplacedByFallback", () => {
    const { result } = renderHook(() => useSavedFieldDraft<string | null>(null, "fallback"));
    expect(result.current.value).toBeNull();
  });

  it("test_useSavedFieldDraft_userEdit_marksDirtyAndKeepsTheEditWhenTheServerChanges", () => {
    const { result, rerender } = renderHook(({ server }) => useSavedFieldDraft<string | null>(server, null), {
      initialProps: { server: "a" as string | null },
    });
    act(() => result.current.change("typed"));
    rerender({ server: "b" });
    expect(result.current.value).toBe("typed");
    expect(result.current.isDirty).toBe(true);
  });

  it("test_useSavedFieldDraft_afterMarkSaved_followsTheServerAgain", () => {
    const { result, rerender } = renderHook(({ server }) => useSavedFieldDraft<string | null>(server, null), {
      initialProps: { server: "a" as string | null },
    });
    act(() => result.current.change("typed"));
    act(() => result.current.markSaved());
    rerender({ server: "typed" });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.value).toBe("typed");
  });
});
