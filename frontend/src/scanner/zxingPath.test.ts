import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotFoundException } from "@zxing/library";
import { BarcodeCameraScanner, ZXING_DECODE_INTERVAL_MS } from "./BarcodeCameraScanner";
import { createCallbacks, fakeStream, fakeTrack, makeVideo } from "./testDoubles";

/** The ZXing reader's decode call, which each test programs. */
const decodeFromCanvas = vi.hoisted(() => vi.fn());

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    decodeFromCanvas = decodeFromCanvas;
  },
}));

/** Queue of animation-frame callbacks that the test runs by hand. */
let frameQueue: Array<() => unknown> = [];
let clock = 0;

/**
 * Runs the next queued animation frame at the given time.
 *
 * @param at - What `performance.now()` returns during the frame, in milliseconds.
 */
async function runFrameAt(at: number): Promise<void> {
  clock = at;
  const next = frameQueue.shift();
  if (next) await next();
  await Promise.resolve();
}

/**
 * Starts a scanner on the ZXing path, which is used when the browser has no `BarcodeDetector`.
 *
 * @param track - The camera track to observe.
 * @returns The scanner and the recorded callbacks.
 */
async function startZxingScanner(track = fakeTrack()) {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(fakeStream(track)) } });
  const callbacks = createCallbacks();
  const scanner = new BarcodeCameraScanner(callbacks.options);
  await scanner.start(makeVideo());
  return { scanner, callbacks, track };
}

beforeEach(() => {
  frameQueue = [];
  clock = 0;
  decodeFromCanvas.mockReset();
  vi.stubGlobal("requestAnimationFrame", (callback: () => unknown) => {
    frameQueue.push(callback);
    return frameQueue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ZXing frame loop (browsers without BarcodeDetector)", () => {
  it("test_zxingLoop_browserWithoutNativeDetector_usesTheZxingPath", async () => {
    const { callbacks } = await startZxingScanner();
    expect(callbacks.logs).toContain("ZXing fallback: starting frame loop");
  });

  it("test_zxingLoop_codeFound_reportsItAndReleasesTheCamera", async () => {
    decodeFromCanvas.mockReturnValue({ getText: () => "8410376003139" });
    const { callbacks, track } = await startZxingScanner();
    await runFrameAt(1000);
    expect(callbacks.detected).toEqual(["8410376003139"]);
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("test_zxingLoop_nothingInFrame_keepsScanningWithoutLoggingAnError", async () => {
    decodeFromCanvas.mockImplementation(() => {
      throw new NotFoundException();
    });
    const { callbacks } = await startZxingScanner();
    await runFrameAt(1000);
    expect(frameQueue).toHaveLength(1);
    expect(callbacks.logs.some((line) => line.startsWith("decode ERR"))).toBe(false);
  });

  it("test_zxingLoop_framesCloserThanTheInterval_decodeOnlyOnce", async () => {
    decodeFromCanvas.mockImplementation(() => {
      throw new NotFoundException();
    });
    await startZxingScanner();
    await runFrameAt(1000);
    await runFrameAt(1000 + ZXING_DECODE_INTERVAL_MS - 1);
    expect(decodeFromCanvas).toHaveBeenCalledTimes(1);
  });

  it("test_zxingLoop_frameAfterTheInterval_decodesAgain", async () => {
    decodeFromCanvas.mockImplementation(() => {
      throw new NotFoundException();
    });
    await startZxingScanner();
    await runFrameAt(1000);
    await runFrameAt(1000 + ZXING_DECODE_INTERVAL_MS);
    expect(decodeFromCanvas).toHaveBeenCalledTimes(2);
  });

  it("test_zxingLoop_stoppedBeforeTheNextFrame_doesNotDecodeAgain", async () => {
    decodeFromCanvas.mockImplementation(() => {
      throw new NotFoundException();
    });
    const { scanner } = await startZxingScanner();
    await runFrameAt(1000);
    scanner.stop();
    await runFrameAt(2000);
    expect(decodeFromCanvas).toHaveBeenCalledTimes(1);
  });

  it("test_zxingLoop_unexpectedDecoderError_isLoggedAndScanningContinues", async () => {
    decodeFromCanvas.mockImplementation(() => {
      throw new Error("decoder crashed");
    });
    const { callbacks } = await startZxingScanner();
    await runFrameAt(1000);
    expect(callbacks.logs).toContain("decode ERR: decoder crashed");
    expect(frameQueue).toHaveLength(1);
  });

  it("test_zxingLoop_noCanvasContext_isLoggedInsteadOfCrashing", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { callbacks } = await startZxingScanner();
    await runFrameAt(1000);
    expect(callbacks.logs).toContain("decode ERR: Canvas 2D context unavailable");
  });
});
