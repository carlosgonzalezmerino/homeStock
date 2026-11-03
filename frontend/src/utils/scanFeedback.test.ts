import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Audio double that records the beeps it was asked to play. */
function installFakeAudio() {
  const frequencies: number[] = [];
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    resume = vi.fn().mockResolvedValue(undefined);
    createOscillator() {
      const oscillator = {
        frequency: {
          set value(next: number) {
            frequencies.push(next);
          },
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      return oscillator;
    }
    createGain() {
      return { gain: { value: 0 }, connect: vi.fn() };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return frequencies;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scan feedback", () => {
  it("test_playScanFeedback_success_playsOneHighBeepAndVibratesOnce", async () => {
    const frequencies = installFakeAudio();
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const { prepareScanFeedback, playScanFeedback } = await import("./scanFeedback");
    prepareScanFeedback();
    playScanFeedback("success");
    expect(frequencies).toEqual([880]);
    expect(vibrate).toHaveBeenCalledWith([40]);
  });

  it("test_playScanFeedback_warning_playsTwoLowBeeps", async () => {
    const frequencies = installFakeAudio();
    vi.stubGlobal("navigator", { vibrate: vi.fn() });
    const { prepareScanFeedback, playScanFeedback } = await import("./scanFeedback");
    prepareScanFeedback();
    playScanFeedback("warning");
    expect(frequencies).toEqual([330, 330]);
  });

  it("test_playScanFeedback_beforePrepare_isSilentButStillVibrates", async () => {
    const frequencies = installFakeAudio();
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    const { playScanFeedback } = await import("./scanFeedback");
    playScanFeedback("success");
    expect(frequencies).toEqual([]);
    expect(vibrate).toHaveBeenCalled();
  });

  it("test_playScanFeedback_noVibrationSupport_doesNotThrow", async () => {
    vi.stubGlobal("navigator", {});
    const { playScanFeedback } = await import("./scanFeedback");
    expect(() => playScanFeedback("success")).not.toThrow();
  });

  it("test_playScanFeedback_audioThrows_logsAndDoesNotBreakTheScan", async () => {
    installFakeAudio();
    vi.stubGlobal("navigator", { vibrate: vi.fn() });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { prepareScanFeedback, playScanFeedback } = await import("./scanFeedback");
    prepareScanFeedback();
    vi.stubGlobal("navigator", {
      get vibrate() {
        throw new Error("boom");
      },
    });
    expect(() => playScanFeedback("success")).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("test_prepareScanFeedback_noWebAudio_doesNothing", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const { prepareScanFeedback } = await import("./scanFeedback");
    expect(() => prepareScanFeedback()).not.toThrow();
  });
});
