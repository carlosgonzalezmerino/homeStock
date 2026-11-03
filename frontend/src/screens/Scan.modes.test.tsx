import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { ActiveLocationProvider } from "@/location";
import type { ScanResult } from "@/types";
import { Scan } from "./Scan";

/** Shared test double for the camera hook: it records the options and lets a test read codes. */
const scannerDouble = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  onDetect: undefined as ((code: string) => void) | undefined,
  options: undefined as { continuous?: boolean } | undefined,
}));

vi.mock("@/hooks/useScanner", () => ({
  useScanner: (onDetect: (code: string) => void, options?: { continuous?: boolean }) => {
    scannerDouble.onDetect = onDetect;
    scannerDouble.options = options;
    return {
      ref: { current: null },
      state: "scanning" as const,
      error: null,
      debugInfo: [],
      start: scannerDouble.start,
      stop: scannerDouble.stop,
    };
  },
}));

const VALID_EAN = "8410376003139";

/** A purchase answer for the valid EAN, overridable per test. */
function answer(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    status: "applied",
    mode: "purchase",
    ean: VALID_EAN,
    name: "Leche Entera",
    unit: "units",
    quantity_before: 2,
    quantity_after: 3,
    movement_id: 11,
    ...overrides,
  };
}

/** Records every `POST /api/scan` and answers with the given result. */
function mockScan(result: ScanResult) {
  const sent: Array<Record<string, unknown>> = [];
  server.use(
    http.post("/api/scan", async ({ request }) => {
      sent.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(result);
    }),
  );
  return sent;
}

/** Renders the scan screen with the routes it can lead to. */
function renderScan() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ActiveLocationProvider>
        <MemoryRouter initialEntries={["/scan"]}>
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/:ean" element={<div>ProductDetail</div>} />
            <Route path="/scan/revisar" element={<div>ReviewScreen</div>} />
            <Route path="/lista" element={<div>ShoppingScreen</div>} />
          </Routes>
        </MemoryRouter>
      </ActiveLocationProvider>
    </QueryClientProvider>,
  );
}

/** Simulates the camera reading a code. */
async function detect(code: string) {
  await act(async () => {
    scannerDouble.onDetect?.(code);
  });
}

/** Picks a mode in the selector. */
function pickMode(name: "Detalle" | "Compra" | "Gastar") {
  fireEvent.click(screen.getByRole("tab", { name }));
}

beforeEach(() => {
  scannerDouble.start.mockClear();
  scannerDouble.stop.mockClear();
  scannerDouble.options = undefined;
});

describe("Scan — mode selector", () => {
  it("test_scan_default_isDetailModeAndTheCameraStopsAfterOneCode", () => {
    renderScan();
    expect(screen.getByRole("tab", { name: "Detalle" })).toHaveAttribute("aria-selected", "true");
    expect(scannerDouble.options?.continuous).toBe(false);
  });

  it("test_scan_detailMode_aCodeOpensTheProductAsBefore", async () => {
    renderScan();
    server.use(http.get("/api/resolve/:ean", () => HttpResponse.json({ ean: VALID_EAN, name: "x", source: "x" })));
    await detect(VALID_EAN);
    expect(await screen.findByText("ProductDetail")).toBeInTheDocument();
  });

  it("test_scan_purchaseAndConsume_keepTheCameraOnBetweenCodes", () => {
    renderScan();
    pickMode("Compra");
    expect(scannerDouble.options?.continuous).toBe(true);
    pickMode("Gastar");
    expect(scannerDouble.options?.continuous).toBe(true);
  });

  it("test_scan_changingMode_doesNotRestartTheCamera", () => {
    renderScan();
    pickMode("Compra");
    pickMode("Gastar");
    pickMode("Detalle");
    expect(scannerDouble.stop).not.toHaveBeenCalled();
    expect(scannerDouble.start).not.toHaveBeenCalled();
  });

  it("test_scan_purchaseMode_isRememberedOnTheNextVisit", () => {
    const first = renderScan();
    pickMode("Compra");
    first.unmount();
    renderScan();
    expect(screen.getByRole("tab", { name: "Compra" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Scan — purchase mode", () => {
  it("test_scan_purchaseCode_postsToScanAndStaysOnTheScreen", async () => {
    const sent = mockScan(answer());
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    await waitFor(() => expect(sent).toEqual([{ ean: VALID_EAN, mode: "purchase", location: "pantry" }]));
    expect(screen.queryByText("ProductDetail")).not.toBeInTheDocument();
  });

  it("test_scan_purchaseCode_showsTheSheetWithTheNewTotalAndUndo", async () => {
    mockScan(answer());
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    expect(await screen.findByText("+1 · ahora 3 units")).toBeInTheDocument();
    expect(screen.getByText("Leche Entera")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
  });

  it("test_scan_undo_callsTheUndoEndpointAndConfirms", async () => {
    mockScan(answer());
    let undone: string | undefined;
    server.use(
      http.post("/api/movements/:id/undo", ({ params }) => {
        undone = String(params.id);
        return HttpResponse.json({ id: 12, undone: false });
      }),
    );
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    fireEvent.click(await screen.findByRole("button", { name: "Deshacer" }));
    expect(await screen.findByText("✓ Deshecho · Leche Entera")).toBeInTheDocument();
    expect(undone).toBe("11");
  });

  it("test_scan_undo_takesTheUnitBackOutOfTheSession", async () => {
    mockScan(answer());
    server.use(http.post("/api/movements/:id/undo", () => HttpResponse.json({ id: 12 })));
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    expect(await screen.findByRole("button", { name: "Terminar (1)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Terminar/ })).not.toBeInTheDocument());
  });

  it("test_scan_unknownCode_isQueuedAndWarnsWithoutAnError", async () => {
    mockScan(answer({ status: "unknown", name: null, movement_id: null }));
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    expect(await screen.findByText("Código sin identificar, queda para revisar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminar (1)" })).toBeInTheDocument();
  });

  it("test_scan_createdProduct_saysItIsNew", async () => {
    mockScan(answer({ status: "created", quantity_before: null, quantity_after: 1 }));
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    expect(await screen.findByText("Nuevo en la despensa · 1 units")).toBeInTheDocument();
  });

  it("test_scan_finishButton_opensTheReviewScreen", async () => {
    mockScan(answer());
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    fireEvent.click(await screen.findByRole("button", { name: "Terminar (1)" }));
    expect(await screen.findByText("ReviewScreen")).toBeInTheDocument();
  });

  it("test_scan_backendFailure_showsAnErrorSheetInsteadOfLosingTheScan", async () => {
    server.use(http.post("/api/scan", () => HttpResponse.json({}, { status: 500 })));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderScan();
    pickMode("Compra");
    await detect(VALID_EAN);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo registrar");
  });

  it("test_scan_typedEanInPurchaseMode_scansWithoutStoppingTheCamera", async () => {
    const sent = mockScan(answer());
    renderScan();
    pickMode("Compra");
    fireEvent.change(screen.getByLabelText("Código EAN"), { target: { value: VALID_EAN } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(scannerDouble.stop).not.toHaveBeenCalled();
  });

  it("test_scan_codeThatIsNotAnEan_isNotSentToTheBackend", async () => {
    const sent = mockScan(answer());
    renderScan();
    pickMode("Compra");
    await detect("hello");
    expect(await screen.findByText(/Código leído, pero no reconocido/)).toBeInTheDocument();
    expect(sent).toEqual([]);
  });
});

describe("Scan — consume mode", () => {
  it("test_scan_consumeMode_showsAPermanentBanner", () => {
    renderScan();
    pickMode("Gastar");
    expect(screen.getByRole("status")).toHaveTextContent("Modo gastar · cada lectura resta 1");
  });

  it("test_scan_consumeMode_isNeverRemembered", () => {
    const first = renderScan();
    pickMode("Gastar");
    expect(localStorage.getItem("scanMode")).toBeNull();
    first.unmount();
    renderScan();
    expect(screen.getByRole("tab", { name: "Gastar" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Detalle" })).toHaveAttribute("aria-selected", "true");
  });

  it("test_scan_consumeAfterPurchase_nextVisitReturnsToPurchase", () => {
    const first = renderScan();
    pickMode("Compra");
    pickMode("Gastar");
    first.unmount();
    renderScan();
    expect(screen.getByRole("tab", { name: "Compra" })).toHaveAttribute("aria-selected", "true");
  });

  it("test_scan_consumeCode_postsConsumeWithoutALocation", async () => {
    const sent = mockScan(answer({ mode: "consume", quantity_after: 2 }));
    renderScan();
    pickMode("Gastar");
    await detect(VALID_EAN);
    await waitFor(() => expect(sent).toEqual([{ ean: VALID_EAN, mode: "consume" }]));
    expect(await screen.findByText("−1 · quedan 2 units")).toBeInTheDocument();
  });

  it("test_scan_consumeToZero_saysItIsOnTheShoppingListAndLinksToIt", async () => {
    mockScan(answer({ mode: "consume", quantity_after: 0 }));
    renderScan();
    pickMode("Gastar");
    await detect(VALID_EAN);
    expect(await screen.findByText("Se acabó · ya está en la lista de la compra")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Ver la lista" }));
    expect(await screen.findByText("ShoppingScreen")).toBeInTheDocument();
  });

  it("test_scan_consumeOfAProductNotInThePantry_warnsAndChangesNothing", async () => {
    mockScan(answer({ mode: "consume", status: "not_tracked", quantity_after: null, movement_id: null }));
    renderScan();
    pickMode("Gastar");
    await detect(VALID_EAN);
    expect(await screen.findByText("No está en tu despensa")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  });

  it("test_scan_consumeCode_doesNotAddToThePurchaseSession", async () => {
    mockScan(answer({ mode: "consume", quantity_after: 1 }));
    renderScan();
    pickMode("Gastar");
    await detect(VALID_EAN);
    await screen.findByText("−1 · quedan 1 units");
    expect(screen.queryByRole("button", { name: /Terminar/ })).not.toBeInTheDocument();
  });
});
