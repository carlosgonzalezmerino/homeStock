import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { ADDED_TOAST_DURATION_MS, useAddedToast } from "./useAddedToast";

/**
 * Renders the hook at a location, reading the toast flag and the current router state.
 *
 * @param state - The router state the screen is reached with.
 * @returns The hook result.
 */
function renderToast(state: unknown) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[{ pathname: "/despensa", state }]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ visible: useAddedToast(), location: useLocation() }), { wrapper });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAddedToast", () => {
  it("test_addedToast_reachedWithAddedState_isVisible", () => {
    const { result } = renderToast({ added: true });
    expect(result.current.visible).toBe(true);
  });

  it("test_addedToast_reachedWithoutState_isHidden", () => {
    const { result } = renderToast(undefined);
    expect(result.current.visible).toBe(false);
  });

  it("test_addedToast_afterTheDuration_hidesItself", () => {
    const { result } = renderToast({ added: true });
    act(() => {
      vi.advanceTimersByTime(ADDED_TOAST_DURATION_MS);
    });
    expect(result.current.visible).toBe(false);
  });

  it("test_addedToast_whenShown_clearsTheRouterStateSoBackDoesNotShowItAgain", () => {
    const { result } = renderToast({ added: true });
    expect(result.current.location.state).toEqual({});
  });
});
