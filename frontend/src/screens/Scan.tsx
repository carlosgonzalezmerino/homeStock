import { useRef, useState, useCallback, useEffect, type RefObject } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useScanner } from "@/hooks";
import { get, ApiError } from "@/api/client";
import type { ProductOut } from "@/types";

export function Scan() {
  const navigate = useNavigate();
  const location = useLocation();
  const [manualEan, setManualEan] = useState("");
  const [showAddedToast, setShowAddedToast] = useState(false);
  const resolving = useRef(false);

  const handleDetect = useCallback(
    async (raw: string) => {
      if (resolving.current) return;
      resolving.current = true;
      scanner.stop();
      await resolveAndNavigate(extractEan(raw), navigate);
      resolving.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate]
  );

  const scanner = useScanner(handleDetect);

  // Auto-start camera and show toast when returning from a successful add
  useEffect(() => {
    if (location.state?.added) {
      setShowAddedToast(true);
      scanner.start();
      // Clear the state so the toast doesn't reappear on back navigation
      navigate(".", { state: {}, replace: true });
      const timer = setTimeout(() => setShowAddedToast(false), 1000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop camera on unmount
  useEffect(() => () => scanner.stop(), []);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ean = manualEan.trim();
    if (!ean) return;
    scanner.stop();
    await resolveAndNavigate(ean, navigate);
  }

  const isScanning = scanner.state === "scanning";
  const isStarting = scanner.state === "starting";
  const hasError = scanner.state === "error" || !!scanner.error;

  return (
    <div className="flex flex-col items-center gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Escanear producto</h1>

      {/* Success toast */}
      {showAddedToast && (
        <div
          role="status"
          className="w-full max-w-sm rounded-lg bg-secondary-container px-4 py-3 text-body-md text-on-secondary-container text-center"
        >
          ✓ Producto añadido
        </div>
      )}

      {/* Camera viewfinder */}
      <div className="relative w-full max-w-sm">
        <video
          ref={scanner.ref as RefObject<HTMLVideoElement>}
          muted
          playsInline
          className={`w-full rounded-lg bg-surface-container transition-opacity ${isScanning ? "opacity-100" : "opacity-0 h-0"}`}
        />

        {/* Aim overlay */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-64 rounded-md border-2 border-primary opacity-70" />
          </div>
        )}
      </div>

      {/* State messages */}
      {!isScanning && !hasError && (
        <p className="text-body-sm text-on-surface-variant text-center">
          {isStarting ? "Iniciando cámara…" : "Pulsa el botón para activar la cámara"}
        </p>
      )}
      {isScanning && (
        <p className="text-body-sm text-on-surface-variant text-center">
          Apunta al código de barras o QR
        </p>
      )}
      {hasError && (
        <p className="text-body-sm text-error text-center">
          {scanner.error ?? "Cámara no disponible"}
        </p>
      )}

      {/* Primary action button */}
      {!isScanning && !isStarting && (
        <button
          onClick={() => scanner.start()}
          className="rounded-full bg-primary px-8 py-4 text-label-lg font-semibold text-on-primary"
        >
          Activar cámara
        </button>
      )}

      {/* Debug panel — remove once scanner works reliably */}
      {scanner.debugInfo.length > 0 && (
        <div className="w-full max-w-sm rounded-lg bg-surface-container p-3 font-mono text-xs text-on-surface-variant space-y-0.5">
          {scanner.debugInfo.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex w-full max-w-sm items-center gap-3">
        <hr className="flex-1 border-outline-variant" />
        <span className="text-label-md text-on-surface-variant">o introduce manualmente</span>
        <hr className="flex-1 border-outline-variant" />
      </div>

      {/* Manual input */}
      <form
        role="form"
        onSubmit={handleManualSubmit}
        className="flex w-full max-w-sm gap-2"
        aria-label="Introduir EAN manual"
      >
        <input
          type="text"
          value={manualEan}
          onChange={(e) => setManualEan(e.target.value)}
          placeholder="Código EAN"
          className="flex-1 rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="rounded-full bg-primary-container px-6 py-3 text-label-md text-on-primary-container"
        >
          Buscar
        </button>
      </form>

      {/* Add without barcode */}
      <button
        onClick={() => navigate("/custom-entry")}
        className="text-label-lg text-primary underline"
        type="button"
      >
        Añadir sin código
      </button>
    </div>
  );
}

async function resolveAndNavigate(ean: string, navigate: ReturnType<typeof useNavigate>) {
  try {
    await get<ProductOut>(`/resolve/${ean}`);
    navigate(`/scan/${ean}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      navigate(`/scan/${ean}/manual`);
    }
  }
}

export function extractEan(raw: string): string {
  const m = raw.match(/https?:\/\/qrtrack\.mercadona\.es\/code\/(\d{8,13})\//);
  return m ? m[1] : raw;
}
