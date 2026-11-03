import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScanner } from "./useScanner";

/** Camera track double that records whether it was stopped. */
function fakeTrack() {
  return { stop: vi.fn() };
}

/** Native detector double that never finds a code, so the scanner stays in the scanning state. */
class IdleBarcodeDetector {
  static getSupportedFormats(): Promise<string[]> {
    return Promise.resolve(["ean_13"]);
  }

  detect(): Promise<Array<{ rawValue: string }>> {
    return Promise.resolve([]);
  }
}

/** Sets `document.hidden`, which is read-only in browsers, for the duration of a test. */
function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
}

/** Starts the hook with a camera and a video element, and returns the track that the camera opened. */
async function startScanning(result: { current: ReturnType<typeof useScanner> }) {
  const track = fakeTrack();
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) },
  });
  const video = document.createElement("video");
  video.play = vi.fn().mockResolvedValue(undefined);
  (result.current.ref as { current: HTMLVideoElement | null }).current = video;
  await act(async () => {
    await result.current.start();
  });
  return track;
}

beforeEach(() => {
  vi.stubGlobal("BarcodeDetector", IdleBarcodeDetector);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  setDocumentHidden(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setDocumentHidden(false);
});

describe("useScanner background handling", () => {
  it("test_visibilityHidden_stopsCameraAndReturnsToIdle", async () => {
    const { result } = renderHook(() => useScanner(() => undefined));
    const track = await startScanning(result);
    expect(result.current.state).toBe("scanning");

    setDocumentHidden(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(track.stop).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
  });

  it("test_pageHide_stopsCamera", async () => {
    const { result } = renderHook(() => useScanner(() => undefined));
    const track = await startScanning(result);

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(track.stop).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
  });

  it("test_unmount_leavingTheScreenStopsTheCamera", async () => {
    const { result, unmount } = renderHook(() => useScanner(() => undefined));
    const track = await startScanning(result);
    unmount();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("test_visibilityReturnsToVisible_doesNotRestartTheCamera", async () => {
    const { result } = renderHook(() => useScanner(() => undefined));
    const track = await startScanning(result);
    setDocumentHidden(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    setDocumentHidden(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("idle");
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
  });

  it("test_visibilityVisible_keepsCameraRunning", async () => {
    const { result } = renderHook(() => useScanner(() => undefined));
    const track = await startScanning(result);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(track.stop).not.toHaveBeenCalled();
    expect(result.current.state).toBe("scanning");
  });
});
