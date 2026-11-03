import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import { describeError } from "@/utils/errors";
import {
  createBarcodeDetector,
  type DiagnosticLogger,
  type NativeBarcodeDetector,
} from "./barcodeDetector";

/** Lifecycle states of the camera scanner. */
export type ScannerState = "idle" | "starting" | "scanning" | "error";

/** Callbacks that connect a {@link BarcodeCameraScanner} to its owner. */
export interface BarcodeCameraScannerOptions {
  onStateChange: (state: ScannerState, errorMessage: string | null) => void;
  onLog: DiagnosticLogger;
  onDetect: (code: string) => void;
  /**
   * Asked on every reading. When it answers `true` the camera stays on and keeps reading
   * after a code; otherwise the camera stops after the first code. Absent means one shot.
   */
  isContinuous?: () => boolean;
}

/** Decodes the current video frame. Resolves `null` when the frame holds no code. */
type FrameDecoder = (video: HTMLVideoElement) => Promise<string | null>;

/** Time between two ZXing decodes. Decoding every frame is too heavy for a phone. */
export const ZXING_DECODE_INTERVAL_MS = 100;

/**
 * In continuous mode, how long a code must be out of sight before it can count again.
 * Every sighting renews the window, so a product held still in front of the camera counts
 * once, and a second unit only counts after the first one has been taken away.
 */
export const REPEAT_SUPPRESSION_MS = 1500;

const IDEAL_CAMERA_WIDTH = 1280;
const IDEAL_CAMERA_HEIGHT = 720;
/** Asks for the rear camera at a size that is enough to read small barcodes. */
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "environment",
    width: { ideal: IDEAL_CAMERA_WIDTH },
    height: { ideal: IDEAL_CAMERA_HEIGHT },
  },
};
const FRAMES_PER_LOG_LINE = 30;
const MAX_FRAMES_WITH_ERROR_LOG = 5;

/**
 * Drives the rear camera and reports the first barcode it reads.
 *
 * Uses the native BarcodeDetector when the browser provides it, and ZXing otherwise.
 * ZXing is driven by our own frame loop because `decodeFromVideoElement` is unreliable on Safari.
 */
export class BarcodeCameraScanner {
  readonly hasNativeDetector: boolean;
  private stream: MediaStream | null = null;
  private frameRequestId = 0;
  private isActive = false;
  private isStarting = false;
  /**
   * Incremented by every `stop()`. A start sequence that finishes after a stop sees a
   * different value and releases what it opened, so the camera never stays on unnoticed.
   */
  private sessionId = 0;
  /** Last code seen in continuous mode and when, to ignore the same code held in view. */
  private lastCode: string | null = null;
  private lastSeenAt = Number.NEGATIVE_INFINITY;

  /**
   * @param options - State, log and detection callbacks supplied by the owner.
   */
  constructor(private readonly options: BarcodeCameraScannerOptions) {
    this.hasNativeDetector = "BarcodeDetector" in window;
  }

  /**
   * Opens the camera, plays it in the given video element and starts looking for codes.
   *
   * Does nothing when the scanner is already running.
   *
   * @param video - The element that will show the camera feed, or `null` if it is not mounted.
   * @returns A promise that resolves once the detection loop has been scheduled.
   */
  async start(video: HTMLVideoElement | null): Promise<void> {
    if (this.isActive || this.isStarting) return;
    const session = this.sessionId;
    this.isStarting = true;
    this.options.onStateChange("starting", null);
    try {
      await this.activate(video);
    } finally {
      if (session === this.sessionId) this.isStarting = false;
    }
  }

  /**
   * Performs the start sequence: camera, playback and detection loop.
   *
   * Every await is followed by a check that no `stop()` happened in the meantime.
   *
   * @param video - The element that will show the camera feed, or `null` if it is not mounted.
   */
  private async activate(video: HTMLVideoElement | null): Promise<void> {
    const session = this.sessionId;
    const stream = await this.openCamera();
    if (!stream) return;

    if (!video || session !== this.sessionId) {
      releaseStream(stream);
      if (session === this.sessionId) this.options.onStateChange("idle", null);
      return;
    }

    this.isActive = true;
    this.stream = stream;
    await this.playInto(video, stream);
    if (!this.isActive || session !== this.sessionId) return;

    this.options.onStateChange("scanning", null);
    await this.startDetection(video);
  }

  /**
   * Stops the detection loop, releases the camera and returns to the idle state.
   *
   * It also cancels a start that is still waiting for the camera, so the next `start()` is not blocked.
   */
  stop(): void {
    this.sessionId++;
    this.isActive = false;
    this.isStarting = false;
    this.lastCode = null;
    cancelAnimationFrame(this.frameRequestId);
    if (this.stream) releaseStream(this.stream);
    this.stream = null;
    this.options.onStateChange("idle", null);
  }

  /**
   * Requests the rear camera. Failures are reported through the error state.
   *
   * @returns The camera stream, or `null` when the user denies access or no camera exists.
   */
  private async openCamera(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      this.options.onLog("getUserMedia OK");
      return stream;
    } catch (error) {
      const message = describeError(error);
      this.options.onLog(`getUserMedia ERR: ${message}`);
      this.options.onStateChange("error", message);
      return null;
    }
  }

  /**
   * Attaches the stream to the video element and starts playback.
   *
   * On failure the scanner stops itself, because nothing can be detected without playback.
   *
   * @param video - The element that shows the camera feed.
   * @param stream - The camera stream to attach.
   */
  private async playInto(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
    video.srcObject = stream;
    try {
      await video.play();
      this.options.onLog("video.play OK");
    } catch (error) {
      this.options.onLog(`video.play ERR: ${describeError(error)}`);
      this.stop();
    }
  }

  /**
   * Chooses the decoder for this browser and starts its frame loop.
   *
   * @param video - The element whose frames are decoded.
   */
  private async startDetection(video: HTMLVideoElement): Promise<void> {
    if (this.hasNativeDetector) {
      await this.startNativeDetection(video);
      return;
    }
    this.startZxingDetection(video);
  }

  /**
   * Starts the native BarcodeDetector frame loop.
   *
   * @param video - The element whose frames are decoded.
   */
  private async startNativeDetection(video: HTMLVideoElement): Promise<void> {
    let detector: NativeBarcodeDetector;
    try {
      detector = await createBarcodeDetector(this.options.onLog);
      this.options.onLog("detector created OK");
    } catch (error) {
      const message = describeError(error);
      this.options.onLog(`detector ERR: ${message}`);
      this.stop();
      this.options.onStateChange("error", message);
      return;
    }
    this.runFrameLoop(video, "frames", async (frame) => {
      const results = await detector.detect(frame);
      return results.length > 0 ? results[0].rawValue : null;
    });
  }

  /** Starts the ZXing frame loop used when the browser has no native detector. */
  private startZxingDetection(video: HTMLVideoElement): void {
    const reader = new BrowserMultiFormatReader();
    const canvas = document.createElement("canvas");
    let lastDecodeAt = Number.NEGATIVE_INFINITY;
    this.options.onLog("ZXing fallback: starting frame loop");
    this.runFrameLoop(video, "ZXing frames", async (frame) => {
      const now = performance.now();
      if (!isDecodeDue(now, lastDecodeAt)) return null;
      lastDecodeAt = now;
      copyFrameToCanvas(frame, canvas);
      try {
        return reader.decodeFromCanvas(canvas).getText();
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
    });
  }

  /**
   * Runs one decode per animation frame until a code is found or the scanner stops.
   *
   * Errors from a single frame are logged only for the first few frames, so the log is not flooded.
   *
   * @param video - The element whose frames are decoded.
   * @param label - Name shown in the periodic progress log lines.
   * @param decodeFrame - Decoder that returns the code found in a frame, or `null`.
   */
  private runFrameLoop(video: HTMLVideoElement, label: string, decodeFrame: FrameDecoder): void {
    const session = this.sessionId;
    let frameCount = 0;
    const tick = async (): Promise<void> => {
      if (!this.isActive || session !== this.sessionId) return;
      frameCount++;
      if (frameCount % FRAMES_PER_LOG_LINE === 0) this.options.onLog(`${label}: ${frameCount}`);
      const code = await this.decodeSafely(video, decodeFrame, frameCount);
      if (session !== this.sessionId) return;
      if (code !== null && this.isActive) {
        if (!this.isContinuous()) {
          this.handleDetection(code);
          return;
        }
        this.handleRepeatableDetection(code);
      }
      this.frameRequestId = requestAnimationFrame(tick);
    };
    this.frameRequestId = requestAnimationFrame(tick);
  }

  /**
   * Decodes one frame and logs failures without interrupting the loop.
   *
   * @param video - The element whose frame is decoded.
   * @param decodeFrame - The decoder for the active browser path.
   * @param frameCount - Index of this frame, used to limit the number of error log lines.
   * @returns The code found in the frame, or `null` when there is none or decoding failed.
   */
  private async decodeSafely(
    video: HTMLVideoElement,
    decodeFrame: FrameDecoder,
    frameCount: number,
  ): Promise<string | null> {
    try {
      return await decodeFrame(video);
    } catch (error) {
      if (frameCount < MAX_FRAMES_WITH_ERROR_LOG) {
        this.options.onLog(`decode ERR: ${describeError(error)}`);
      }
      return null;
    }
  }

  /**
   * Tells whether the owner wants the camera to stay on after a code.
   *
   * @returns `true` in continuous mode. Asked on every reading, so the mode can change
   *   while the camera is running without restarting it.
   */
  private isContinuous(): boolean {
    return this.options.isContinuous?.() ?? false;
  }

  /**
   * Hands a code to the owner without stopping the camera, unless it is the same code that
   * was already in view a moment ago.
   *
   * @param code - The raw value that was decoded.
   */
  private handleRepeatableDetection(code: string): void {
    const now = performance.now();
    const isRepeat = code === this.lastCode && now - this.lastSeenAt < REPEAT_SUPPRESSION_MS;
    this.lastCode = code;
    this.lastSeenAt = now;
    if (isRepeat) return;
    this.options.onLog(`detected (continuous): ${code}`);
    this.options.onDetect(code);
  }

  /**
   * Releases the camera and hands the code to the owner.
   *
   * @param code - The raw value that was decoded.
   */
  private handleDetection(code: string): void {
    this.options.onLog(`detected: ${code}`);
    this.stop();
    this.options.onDetect(code);
  }
}

/**
 * Stops every track of a media stream so the camera light turns off.
 *
 * @param stream - The stream to release.
 */
function releaseStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

/**
 * Tells whether enough time has passed since the last ZXing decode to run another one.
 *
 * @param now - The current time in milliseconds.
 * @param lastDecodeAt - The time of the last decode, or negative infinity before the first one.
 * @returns `true` when at least `ZXING_DECODE_INTERVAL_MS` has passed.
 */
export function isDecodeDue(now: number, lastDecodeAt: number): boolean {
  return now - lastDecodeAt >= ZXING_DECODE_INTERVAL_MS;
}

/**
 * Draws the current frame of a video onto a canvas, resizing the canvas when the video size changes.
 *
 * @param video - The element whose current frame is copied.
 * @param canvas - The canvas that receives the frame.
 * @throws {Error} When the browser cannot provide a 2D drawing context.
 */
function copyFrameToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
}
