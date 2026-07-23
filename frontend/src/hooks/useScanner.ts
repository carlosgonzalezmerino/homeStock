import { useRef, useState, useCallback } from "react";

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

export type ScannerState = "idle" | "starting" | "scanning" | "error";

export interface UseScannerReturn {
  ref: React.RefObject<HTMLVideoElement>;
  state: ScannerState;
  error: string | null;
  hasBarcodeDetector: boolean;
  start: () => Promise<void>;
  stop: () => void;
  detect: () => Promise<string | null>;
}

const WANTED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

async function makeBarcodeDetector(): Promise<BarcodeDetector> {
  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    const formats = WANTED_FORMATS.filter((f) => supported.includes(f));
    return new BarcodeDetector({ formats: formats.length ? formats : WANTED_FORMATS });
  } catch {
    return new BarcodeDetector({ formats: WANTED_FORMATS });
  }
}

export function useScanner(onDetect?: (ean: string) => void): UseScannerReturn {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const hasBarcodeDetector = "BarcodeDetector" in window;

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    setError(null);
    setState("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cámara no disponible";
      setError(msg);
      setState("error");
      return;
    }

    if (!ref.current) {
      stream.getTracks().forEach((t) => t.stop());
      setState("idle");
      return;
    }

    activeRef.current = true;
    streamRef.current = stream;
    const video = ref.current;
    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      stop();
      return;
    }

    setState("scanning");

    // Continuous detection loop — only if BarcodeDetector available AND callback given
    if (hasBarcodeDetector && onDetect) {
      const detector = await makeBarcodeDetector();

      const tick = async () => {
        if (!activeRef.current || !ref.current) return;
        try {
          const results = await detector.detect(ref.current);
          if (results.length > 0 && activeRef.current) {
            activeRef.current = false;
            onDetect(results[0].rawValue);
            return;
          }
        } catch {
          // frame not ready
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    }
  }, [hasBarcodeDetector, onDetect, stop]);

  // One-shot detect — for manual capture button (iOS fallback)
  const detect = useCallback(async (): Promise<string | null> => {
    if (!hasBarcodeDetector || !ref.current) return null;
    try {
      const detector = await makeBarcodeDetector();
      const results = await detector.detect(ref.current);
      return results.length > 0 ? results[0].rawValue : null;
    } catch {
      return null;
    }
  }, [hasBarcodeDetector]);

  return { ref, state, error, hasBarcodeDetector, start, stop, detect };
}
