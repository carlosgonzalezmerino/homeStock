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
  debugInfo: string[];
  start: () => Promise<void>;
  stop: () => void;
  detect: () => Promise<string | null>;
}

const FORMAT_CANDIDATES = [
  ["ean_13", "ean_8", "code_128", "upc_e", "qr_code"],
  ["ean_13", "ean_8", "code_128"],
  ["ean_13", "ean_8"],
  ["ean_13"],
];

async function makeBarcodeDetector(): Promise<BarcodeDetector> {
  // Try to intersect with getSupportedFormats first (not available on all iOS builds)
  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    const formats = FORMAT_CANDIDATES[0].filter((f) => supported.includes(f));
    if (formats.length) return new BarcodeDetector({ formats });
  } catch {
    // getSupportedFormats not available — fall through to trial-and-error
  }

  // Trial-and-error: try progressively smaller format lists
  for (const formats of FORMAT_CANDIDATES) {
    try {
      return new BarcodeDetector({ formats });
    } catch {
      // this set not supported — try next
    }
  }

  // Last resort: no formats arg (browser picks defaults)
  return new BarcodeDetector();
}

export function useScanner(onDetect?: (ean: string) => void): UseScannerReturn {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const hasBarcodeDetector = "BarcodeDetector" in window;

  function dbg(msg: string) {
    setDebugInfo((prev) => [...prev.slice(-9), msg]);
  }

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

    dbg(`hasBarcodeDetector: ${hasBarcodeDetector}`);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      dbg("getUserMedia OK");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Cámara no disponible";
      dbg(`getUserMedia ERR: ${msg}`);
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
      dbg("video.play OK");
    } catch (err) {
      dbg(`video.play ERR: ${err instanceof Error ? err.message : err}`);
      stop();
      return;
    }

    setState("scanning");

    // Continuous detection loop — only if BarcodeDetector available AND callback given
    if (hasBarcodeDetector && onDetect) {
      let detector: BarcodeDetector;
      try {
        detector = await makeBarcodeDetector();
        dbg("detector created OK");
      } catch (err) {
        dbg(`detector ERR: ${err instanceof Error ? err.message : err}`);
        return;
      }

      let frameCount = 0;
      const tick = async () => {
        if (!activeRef.current || !ref.current) return;
        frameCount++;
        if (frameCount % 30 === 0) dbg(`frames scanned: ${frameCount}`);
        try {
          const results = await detector.detect(ref.current);
          if (results.length > 0 && activeRef.current) {
            dbg(`detected: ${results[0].rawValue}`);
            activeRef.current = false;
            onDetect(results[0].rawValue);
            return;
          }
        } catch (err) {
          if (frameCount < 5) dbg(`detect ERR: ${err instanceof Error ? err.message : err}`);
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

  return { ref, state, error, hasBarcodeDetector, debugInfo, start, stop, detect };
}
