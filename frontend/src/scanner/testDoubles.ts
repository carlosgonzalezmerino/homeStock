import { vi } from "vitest";
import type { ScannerState } from "./BarcodeCameraScanner";

/**
 * Fake camera track that records whether it was stopped.
 *
 * @returns An object with a `stop` spy.
 */
export function fakeTrack() {
  return { stop: vi.fn() };
}

/**
 * Builds a fake camera stream made of one track.
 *
 * @param track - The track the stream holds.
 * @returns A stream double.
 */
export function fakeStream(track = fakeTrack()) {
  return { getTracks: () => [track] } as unknown as MediaStream;
}

/**
 * Creates a video element whose `play` resolves, because jsdom does not implement playback.
 *
 * @returns The video element.
 */
export function makeVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  video.play = vi.fn().mockResolvedValue(undefined);
  return video;
}

/**
 * Creates the callbacks that the scanner receives, plus recorders for their calls.
 *
 * @returns The options to give the scanner and the lists that record what it reports.
 */
export function createCallbacks() {
  const states: Array<[ScannerState, string | null]> = [];
  const logs: string[] = [];
  const detected: string[] = [];
  return {
    states,
    logs,
    detected,
    options: {
      onStateChange: (state: ScannerState, message: string | null) => states.push([state, message]),
      onLog: (message: string) => logs.push(message),
      onDetect: (code: string) => detected.push(code),
    },
  };
}
