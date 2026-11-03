import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { BarcodeCameraScanner, type ScannerState } from "@/scanner/BarcodeCameraScanner";

export type { ScannerState } from "@/scanner/BarcodeCameraScanner";

/** Number of diagnostic lines kept for the debug panel. */
const DEBUG_LOG_LIMIT = 10;

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
 * @param onDetect - Called once with the first code the camera reads.
 * @returns The video ref to attach to a `<video>` element, the scanner state and actions.
 */
export function useScanner(onDetect: (code: string) => void): UseScannerReturn {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const detectRef = useRef(onDetect);
  const [scanner] = useState(() => createScanner(detectRef, setState, setError, setDebugInfo));

  useEffect(() => {
    detectRef.current = onDetect;
  }, [onDetect]);

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
 * @param setState - State setter for the scanner lifecycle state.
 * @param setError - State setter for the last error message.
 * @param setDebugInfo - State setter for the diagnostic log.
 * @returns A new scanner instance.
 */
function createScanner(
  detectRef: { current: (code: string) => void },
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
  });
}
