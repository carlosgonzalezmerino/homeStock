import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ActiveLocationProvider, useActiveLocation } from "./ActiveLocationProvider";

/**
 * Wraps a hook in the provider, so the hook reads the stored location.
 *
 * @param children - The provider's children, unused.
 * @returns The provider element.
 */
function wrapper({ children }: { children: ReactNode }) {
  return <ActiveLocationProvider>{children}</ActiveLocationProvider>;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("ActiveLocationProvider", () => {
  it("test_activeLocation_nothingStored_defaultsToPantry", () => {
    const { result } = renderHook(() => useActiveLocation(), { wrapper });
    expect(result.current.location).toBe("pantry");
  });

  it("test_activeLocation_storedFreezer_isRestored", () => {
    localStorage.setItem("activeLocation", "freezer");
    const { result } = renderHook(() => useActiveLocation(), { wrapper });
    expect(result.current.location).toBe("freezer");
  });

  it("test_activeLocation_invalidStoredValue_defaultsToPantry", () => {
    localStorage.setItem("activeLocation", "garage");
    const { result } = renderHook(() => useActiveLocation(), { wrapper });
    expect(result.current.location).toBe("pantry");
  });

  it("test_setLocation_change_isStored", () => {
    const { result } = renderHook(() => useActiveLocation(), { wrapper });
    act(() => result.current.setLocation("freezer"));
    expect(result.current.location).toBe("freezer");
    expect(localStorage.getItem("activeLocation")).toBe("freezer");
  });

  it("test_activeLocation_storageBlocked_stillWorksInMemory", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = renderHook(() => useActiveLocation(), { wrapper });
    act(() => result.current.setLocation("freezer"));
    expect(result.current.location).toBe("freezer");
  });

  it("test_activeLocation_renderedWithoutErrors", () => {
    const { container } = render(<ActiveLocationProvider><span>ok</span></ActiveLocationProvider>);
    expect(container).toHaveTextContent("ok");
  });
});
