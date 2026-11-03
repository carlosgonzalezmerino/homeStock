import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BarcodeCameraScanner,
  isDecodeDue,
  REPEAT_SUPPRESSION_MS,
  ZXING_DECODE_INTERVAL_MS,
} from "./BarcodeCameraScanner";
import { createBarcodeDetector, FORMAT_CANDIDATES } from "./barcodeDetector";
import { createCallbacks, fakeStream, fakeTrack, makeVideo } from "./testDoubles";

/** Queue of animation-frame callbacks that the test runs by hand. */
let frameQueue: Array<() => unknown> = [];
let detectResults: Array<{ rawValue: string }> = [];
let constructorFormats: string[][] = [];
let supportedFormats: string[] = ["ean_13", "ean_8"];
let supportedFormatsError: Error | null = null;
let rejectedFormatLists = new Set<string>();

/** Native detector double that records its constructor arguments. */
class FakeBarcodeDetector {
  static getSupportedFormats(): Promise<string[]> {
    if (supportedFormatsError) return Promise.reject(supportedFormatsError);
    return Promise.resolve(supportedFormats);
  }

  constructor(options?: { formats: string[] }) {
    const formats = options?.formats ?? [];
    if (formats.length > 0 && rejectedFormatLists.has(formats.join(","))) {
      throw new Error(`unsupported formats: ${formats.join(",")}`);
    }
    constructorFormats.push(formats);
  }

  detect(): Promise<Array<{ rawValue: string }>> {
    return Promise.resolve(detectResults);
  }
}

/** Runs queued animation frames, awaiting each one, for the given number of frames. */
async function runFrames(frameCount: number): Promise<void> {
  for (let index = 0; index < frameCount; index++) {
    const nextFrame = frameQueue.shift();
    if (nextFrame) await nextFrame();
    await Promise.resolve();
  }
}

beforeEach(() => {
  frameQueue = [];
  detectResults = [];
  constructorFormats = [];
  supportedFormats = ["ean_13", "ean_8"];
  supportedFormatsError = null;
  rejectedFormatLists = new Set();
  vi.stubGlobal("BarcodeDetector", FakeBarcodeDetector);
  vi.stubGlobal("requestAnimationFrame", (callback: () => unknown) => {
    frameQueue.push(callback);
    return frameQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BarcodeCameraScanner.start", () => {
  it("test_start_cameraGranted_reportsScanningState", async () => {
    const stream = fakeStream();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    await scanner.start(makeVideo());
    expect(callbacks.states.map(([state]) => state)).toEqual(["starting", "scanning"]);
  });

  it("test_start_permissionDenied_reportsErrorWithMessage", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")) },
    });
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    await scanner.start(makeVideo());
    expect(callbacks.states.at(-1)).toEqual(["error", "Permission denied"]);
  });

  it("test_start_noVideoElement_releasesStreamAndReturnsToIdle", async () => {
    const track = fakeTrack();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream(track)) },
    });
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    await scanner.start(null);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(callbacks.states.at(-1)).toEqual(["idle", null]);
  });

  it("test_start_alreadyRunning_doesNotRequestCameraAgain", async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream());
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const scanner = new BarcodeCameraScanner(createCallbacks().options);
    const video = makeVideo();
    await scanner.start(video);
    await scanner.start(video);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it("test_start_playbackFails_stopsScannerAndLogsError", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    const video = makeVideo();
    video.play = vi.fn().mockRejectedValue(new Error("autoplay blocked"));
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    await scanner.start(video);
    expect(callbacks.logs).toContain("video.play ERR: autoplay blocked");
    expect(callbacks.states.at(-1)).toEqual(["idle", null]);
  });
});

describe("BarcodeCameraScanner.stop", () => {
  it("test_stop_activeScanner_releasesCameraTracks", async () => {
    const track = fakeTrack();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream(track)) },
    });
    const scanner = new BarcodeCameraScanner(createCallbacks().options);
    await scanner.start(makeVideo());
    scanner.stop();
    expect(track.stop).toHaveBeenCalledOnce();
  });
});

describe("BarcodeCameraScanner frame loop", () => {
  it("test_frameLoop_codeFound_callsOnDetectWithRawValueAndStopsCamera", async () => {
    const track = fakeTrack();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream(track)) },
    });
    detectResults = [{ rawValue: "8410376003139" }];
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    await scanner.start(makeVideo());
    await runFrames(1);
    expect(callbacks.detected).toEqual(["8410376003139"]);
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("test_frameLoop_noCodeInFrame_schedulesAnotherFrame", async () => {
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) } });
    detectResults = [];
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    await scanner.start(makeVideo());
    await runFrames(1);
    expect(frameQueue).toHaveLength(1);
    expect(callbacks.detected).toEqual([]);
  });
});

describe("BarcodeCameraScanner stop during start", () => {
  it("test_stop_whileCameraIsOpening_releasesLateStreamAndStaysIdle", async () => {
    const track = fakeTrack();
    let resolveCamera: (stream: MediaStream) => void = () => undefined;
    const pendingCamera = new Promise<MediaStream>((resolve) => {
      resolveCamera = resolve;
    });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockReturnValue(pendingCamera) } });
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    const video = makeVideo();
    const starting = scanner.start(video);
    scanner.stop();
    resolveCamera(fakeStream(track));
    await starting;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeFalsy();
    expect(callbacks.states.map(([state]) => state)).not.toContain("scanning");
    expect(callbacks.states.at(-1)).toEqual(["idle", null]);
  });

  it("test_start_afterStopWhileCameraIsOpening_requestsCameraAgain", async () => {
    let resolveFirst: (stream: MediaStream) => void = () => undefined;
    const getUserMedia = vi
      .fn()
      .mockReturnValueOnce(new Promise<MediaStream>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(fakeStream());
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const scanner = new BarcodeCameraScanner(createCallbacks().options);
    const firstStart = scanner.start(makeVideo());
    scanner.stop();
    await scanner.start(makeVideo());
    resolveFirst(fakeStream());
    await firstStart;
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("test_start_nativeDetectorCannotBeCreated_releasesCameraAndReportsError", async () => {
    const track = fakeTrack();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream(track)) },
    });
    vi.stubGlobal(
      "BarcodeDetector",
      class {
        static getSupportedFormats(): Promise<string[]> {
          return Promise.reject(new Error("no formats"));
        }

        constructor() {
          throw new Error("detector unavailable");
        }
      },
    );
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner(callbacks.options);
    await scanner.start(makeVideo());
    expect(track.stop).toHaveBeenCalledOnce();
    expect(callbacks.states.at(-1)).toEqual(["error", "detector unavailable"]);
  });
});

describe("createBarcodeDetector", () => {
  it("test_createBarcodeDetector_supportedFormatsReported_requestsIntersection", async () => {
    supportedFormats = ["ean_13", "qr_code"];
    await createBarcodeDetector(vi.fn());
    expect(constructorFormats[0]).toEqual(["ean_13", "qr_code"]);
  });

  it("test_createBarcodeDetector_getSupportedFormatsThrows_logsAndFallsBackToCandidates", async () => {
    supportedFormatsError = new Error("not available");
    const log = vi.fn();
    await createBarcodeDetector(log);
    expect(log).toHaveBeenCalledWith("getSupportedFormats unavailable: not available");
    expect(constructorFormats[0]).toEqual(FORMAT_CANDIDATES[0]);
  });

  it("test_createBarcodeDetector_firstCandidateRejected_triesNextCandidate", async () => {
    supportedFormatsError = new Error("nope");
    rejectedFormatLists.add(FORMAT_CANDIDATES[0].join(","));
    const log = vi.fn();
    await createBarcodeDetector(log);
    expect(constructorFormats[0]).toEqual(FORMAT_CANDIDATES[1]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Format list rejected"));
  });

  it("test_createBarcodeDetector_everyCandidateRejected_usesBrowserDefaults", async () => {
    supportedFormatsError = new Error("nope");
    FORMAT_CANDIDATES.forEach((formats) => rejectedFormatLists.add(formats.join(",")));
    const log = vi.fn();
    await createBarcodeDetector(log);
    expect(log).toHaveBeenCalledWith("No format list accepted; using browser defaults");
    expect(constructorFormats).toEqual([[]]);
  });
});

describe("isDecodeDue", () => {
  it("test_isDecodeDue_firstDecode_returnsTrue", () => {
    expect(isDecodeDue(0, Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it("test_isDecodeDue_beforeInterval_returnsFalse", () => {
    expect(isDecodeDue(1000 + ZXING_DECODE_INTERVAL_MS - 1, 1000)).toBe(false);
  });

  it("test_isDecodeDue_atInterval_returnsTrue", () => {
    expect(isDecodeDue(1000 + ZXING_DECODE_INTERVAL_MS, 1000)).toBe(true);
  });
});

describe("BarcodeCameraScanner continuous mode", () => {
  /** Starts a scanner whose continuous flag the test controls, with a clock it controls too. */
  async function startContinuous(initiallyContinuous = true) {
    const track = fakeTrack();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream(track)) } });
    const state = { continuous: initiallyContinuous, now: 0 };
    vi.spyOn(performance, "now").mockImplementation(() => state.now);
    const callbacks = createCallbacks();
    const scanner = new BarcodeCameraScanner({ ...callbacks.options, isContinuous: () => state.continuous });
    await scanner.start(makeVideo());
    return { scanner, callbacks, track, state };
  }

  /** Shows a code to the camera for one frame, `afterMs` after the previous call. */
  async function show(state: { now: number }, code: string | null, afterMs = 100) {
    state.now += afterMs;
    detectResults = code === null ? [] : [{ rawValue: code }];
    await runFrames(1);
  }

  it("test_continuous_codeFound_reportsItAndKeepsTheCameraOn", async () => {
    const { callbacks, track, state } = await startContinuous();
    await show(state, "8410376003139");
    expect(callbacks.detected).toEqual(["8410376003139"]);
    expect(track.stop).not.toHaveBeenCalled();
    expect(frameQueue).toHaveLength(1);
  });

  it("test_continuous_sameCodeHeldInView_countsOnce", async () => {
    const { callbacks, state } = await startContinuous();
    for (let frame = 0; frame < 5; frame++) await show(state, "A");
    expect(callbacks.detected).toEqual(["A"]);
  });

  it("test_continuous_sameCodeAfterBeingOutOfSight_countsAgain", async () => {
    const { callbacks, state } = await startContinuous();
    await show(state, "A");
    await show(state, "A", REPEAT_SUPPRESSION_MS + 1);
    expect(callbacks.detected).toEqual(["A", "A"]);
  });

  it("test_continuous_everySightingRenewsTheWindow", async () => {
    const { callbacks, state } = await startContinuous();
    const step = REPEAT_SUPPRESSION_MS - 100;
    await show(state, "A");
    await show(state, "A", step);
    await show(state, "A", step);
    expect(callbacks.detected).toEqual(["A"]);
  });

  it("test_continuous_differentCodeRightAfter_isReportedAtOnce", async () => {
    const { callbacks, state } = await startContinuous();
    await show(state, "A");
    await show(state, "B", 50);
    expect(callbacks.detected).toEqual(["A", "B"]);
  });

  it("test_continuous_framesWithoutCode_doNotReportAnything", async () => {
    const { callbacks, state } = await startContinuous();
    await show(state, null);
    await show(state, null);
    expect(callbacks.detected).toEqual([]);
  });

  it("test_continuous_stopAndRestart_forgetsTheLastCode", async () => {
    const { scanner, callbacks, state } = await startContinuous();
    await show(state, "A");
    scanner.stop();
    frameQueue = []; // a real cancelAnimationFrame would have dropped the pending frame
    await scanner.start(makeVideo());
    await show(state, "A", 10);
    expect(callbacks.detected).toEqual(["A", "A"]);
  });

  it("test_continuous_switchedOffWhileRunning_nextCodeStopsTheCamera", async () => {
    const { callbacks, track, state } = await startContinuous();
    await show(state, "A");
    state.continuous = false;
    await show(state, "B");
    expect(callbacks.detected).toEqual(["A", "B"]);
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("test_continuous_notRequested_stillStopsAfterTheFirstCode", async () => {
    const { callbacks, track, state } = await startContinuous(false);
    await show(state, "A");
    expect(callbacks.detected).toEqual(["A"]);
    expect(track.stop).toHaveBeenCalledOnce();
  });
});
