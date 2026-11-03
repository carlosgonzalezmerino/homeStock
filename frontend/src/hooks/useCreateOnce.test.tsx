import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "@/api/client";
import { useCreateOnce } from "./useCreateOnce";

describe("useCreateOnce", () => {
  it("test_createOnce_firstCall_runsTheRequestWithItsArguments", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCreateOnce(create));
    await act(() => result.current("milk", 2));
    expect(create).toHaveBeenCalledWith("milk", 2);
  });

  it("test_createOnce_callAfterSuccess_doesNotRunTheRequestAgain", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCreateOnce(create));
    await act(() => result.current());
    await act(() => result.current());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("test_createOnce_conflict_countsAsCreatedAndSkipsLaterCalls", async () => {
    const create = vi.fn().mockRejectedValue(new ApiError(409, { ean: "1" }));
    const { result } = renderHook(() => useCreateOnce(create));
    await act(() => result.current());
    await act(() => result.current());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("test_createOnce_otherError_isThrownAndTheNextCallTriesAgain", async () => {
    const create = vi.fn().mockRejectedValueOnce(new ApiError(500, null)).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCreateOnce(create));
    await act(async () => {
      await expect(result.current()).rejects.toBeInstanceOf(ApiError);
    });
    await act(() => result.current());
    expect(create).toHaveBeenCalledTimes(2);
  });
});
