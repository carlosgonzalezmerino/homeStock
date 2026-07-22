import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function useScanner(onDetect: (ean: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const elementId = ref.current.id || "qr-region";
    if (!ref.current.id) ref.current.id = elementId;

    const scanner = new Html5Qrcode(elementId);
    let active = true;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (active) onDetect(decodedText);
        },
        undefined,
      )
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Cámara no disponible",
        );
      });

    return () => {
      active = false;
      scanner.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, error };
}
