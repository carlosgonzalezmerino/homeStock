import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useScanner } from "@/hooks";
import { get, ApiError } from "@/api/client";
import type { ProductOut } from "@/types";

export function Scan() {
  const navigate = useNavigate();
  const [manualEan, setManualEan] = useState("");
  const resolving = useRef(false);

  const handleDetect = useCallback(
    async (ean: string) => {
      if (resolving.current) return;
      resolving.current = true;
      await resolveAndNavigate(ean, navigate);
      resolving.current = false;
    },
    [navigate]
  );

  const { ref, error: cameraError } = useScanner(handleDetect);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ean = manualEan.trim();
    if (!ean) return;
    await resolveAndNavigate(ean, navigate);
  }

  return (
    <div className="flex flex-col items-center gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Escanear producto</h1>

      {!cameraError && (
        <div
          ref={ref}
          className="w-full max-w-sm aspect-square rounded-lg overflow-hidden bg-surface-container"
        />
      )}

      <p className="text-body-sm text-on-surface-variant">
        {cameraError ? "Cámara no disponible — introduce el código manualmente" : "Apunta al código de barras"}
      </p>

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
    // 5xx: stay on page; user can retry
  }
}
