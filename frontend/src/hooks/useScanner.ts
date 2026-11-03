import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { BarcodeCameraScanner, type ScannerState } from "@/scanner/BarcodeCameraScanner";

export type { ScannerState } from "@/scanner/BarcodeCameraScanner";

/** Number of diagnostic lines kept for the debug panel. */
const DEBUG_LOG_LIMIT = 10;

/** Options of {@link useScanner}. */
export interface UseScannerOptions {
  /** Keep the camera on after a code and keep reading. Can change while the camera runs. */
  continuous?: boolean;
}

/** Values and actions returned by {@link useScanner}. */
export interface UseScannerReturn {
  ref: RefObject<HTMLVideoElement>;
  state: ScannerState;
  error: string | null;
  debugInfo: string[];
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * React adapter around {@link BarcodeCameraScanner}.
 *
 * The scanner instance is created once per component. The latest `onDetect` callback is
 * read from a ref, so a new callback never restarts the camera.
 *
 * @param onDetect - Called with each code the camera reads. In one-shot mode, once, with the first.
 * @param options - `continuous` keeps the camera on and ignores the same code held in view.
 * @returns The video ref to attach to a `<video>` element, the scanner state and actions.
 */
export function useScanner(onDetect: (code: string) => void, options: UseScannerOptions = {}): UseScannerReturn {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const detectRef = useRef(onDetect);
  const continuousRef = useRef(options.continuous ?? false);
  const [scanner] = useState(() => createScanner(detectRef, continuousRef, setState, setError, setDebugInfo));

  useEffect(() => {
    detectRef.current = onDetect;
    continuousRef.current = options.continuous ?? false;
  }, [onDetect, options.continuous]);

  useEffect(() => {
    const stopScanner = () => scanner.stop();
    const stopWhenHidden = () => {
      if (document.hidden) stopScanner();
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", stopScanner);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("pagehide", stopScanner);
      stopScanner();
    };
  }, [scanner]);

  const start = useCallback(() => scanner.start(ref.current), [scanner]);
  const stop = useCallback(() => scanner.stop(), [scanner]);

  return { ref, state, error, debugInfo, start, stop };
}

/**
 * Builds the scanner and connects its callbacks to React state setters.
 *
 * @param detectRef - Ref holding the latest detection callback.
 * @param continuousRef - Ref holding whether the camera should stay on after a code.
 * @param setState - State setter for the scanner lifecycle state.
 * @param setError - State setter for the last error message.
 * @param setDebugInfo - State setter for the diagnostic log.
 * @returns A new scanner instance.
 */
function createScanner(
  detectRef: { current: (code: string) => void },
  continuousRef: { current: boolean },
  setState: (state: ScannerState) => void,
  setError: (message: string | null) => void,
  setDebugInfo: (update: (previous: string[]) => string[]) => void,
): BarcodeCameraScanner {
  return new BarcodeCameraScanner({
    onStateChange: (nextState, message) => {
      setState(nextState);
      setError(message);
    },
    onLog: (message) => {
      setDebugInfo((previous) => [...previous.slice(-(DEBUG_LOG_LIMIT - 1)), message]);
    },
    onDetect: (code) => detectRef.current(code),
    isContinuous: () => continuousRef.current,
  });
}
