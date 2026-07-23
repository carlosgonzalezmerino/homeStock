import { useEffect, useRef, useState } from "react";

// BarcodeDetector is a browser API not yet in TypeScript's lib
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

export function useScanner(onDetect: (ean: string) => void) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("BarcodeDetector" in window)) {
      setError("Escáner no soportado en este navegador — introduce el código manualmente");
      return;
    }

    const detector = new BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
    });

    let stream: MediaStream | null = null;
    let rafId: number;
    let active = true;

    async function tick() {
      if (!active || !ref.current) return;
      try {
        const results = await detector.detect(ref.current);
        if (results.length > 0 && active) {
          active = false;
          onDetect(results[0].rawValue);
          return;
        }
      } catch {
        // frame not ready — keep looping
      }
      rafId = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = ref.current!;
        video.srcObject = s;
        video.play().then(() => {
          if (active) rafId = requestAnimationFrame(tick);
        }).catch(() => undefined);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Cámara no disponible");
      });

    return () => {
      active = false;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, error };
}
