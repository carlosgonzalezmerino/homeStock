import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { Scan } from "./Scan";

/** Shared test double for the camera hook, so the tests can read codes and count camera calls. */
const scannerDouble = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  onDetect: undefined as ((code: string) => void) | undefined,
}));

vi.mock("@/hooks/useScanner", () => ({
  useScanner: (onDetect: (code: string) => void) => {
    scannerDouble.onDetect = onDetect;
    return {
      ref: { current: null },
      state: "idle" as const,
      error: null,
      debugInfo: [],
      start: scannerDouble.start,
      stop: scannerDouble.stop,
    };
  },
}));

/**
 * Renders the scan screen at the given location, with a route for the product detail.
 *
 * @param entry - The initial location, optionally carrying router state.
 */
function renderScan(entry: string | { pathname: string; state: unknown }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/scan" element={<Scan />} />
          <Route path="/scan/:ean" element={<div>ProductDetail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** Simulates the camera reading a code. */
function detect(code: string): void {
  act(() => {
    scannerDouble.onDetect?.(code);
  });
}

beforeEach(() => {
  scannerDouble.start.mockClear();
  scannerDouble.stop.mockClear();
});

describe("Scan camera on return", () => {
  it("test_scan_openedWithoutAnyState_doesNotStartTheCamera", () => {
    renderScan("/scan");
    expect(scannerDouble.start).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Activar cámara" })).toBeInTheDocument();
  });

  it("test_scan_activateCameraButton_startsTheCameraOnce", () => {
    renderScan("/scan");
    fireEvent.click(screen.getByRole("button", { name: "Activar cámara" }));
    expect(scannerDouble.start).toHaveBeenCalledOnce();
  });

  it("test_addedFlag_showsToastWithoutStartingCamera", async () => {
    renderScan({ pathname: "/scan", state: { added: true } });
    expect(await screen.findByText("✓ Producto añadido")).toBeInTheDocument();
    expect(scannerDouble.start).not.toHaveBeenCalled();
  });
});

describe("Scan code validation", () => {
  it("test_detectNonEanCode_showsCodeAndStaysOnScanScreen", () => {
    renderScan("/scan");
    detect("https://example.com/otro");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Código leído, pero no reconocido: https://example.com/otro",
    );
    expect(screen.getByText("Escanear producto")).toBeInTheDocument();
  });

  it("test_detectValidEan_opensProductDetail", async () => {
    const ean = "8410376003139";
    server.use(http.get(`/api/resolve/${ean}`, () => HttpResponse.json({ ean, name: "Leche", source: "off" })));
    renderScan("/scan");
    detect(ean);
    expect(await screen.findByText("ProductDetail")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("test_detectMercadonaQr_opensProductDetailWithEan", async () => {
    const ean = "8410376003139";
    server.use(http.get(`/api/resolve/${ean}`, () => HttpResponse.json({ ean, name: "Leche", source: "off" })));
    renderScan("/scan");
    detect(`https://qrtrack.mercadona.es/01/08410376003139/10/ABC`);
    expect(await screen.findByText("ProductDetail")).toBeInTheDocument();
  });
});
