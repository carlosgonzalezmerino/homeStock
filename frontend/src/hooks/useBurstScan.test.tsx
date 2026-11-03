import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import type { ScanMode, ScanResult } from "@/types";
import { RESULT_SHEET_MS, SCAN_ERROR_MESSAGE, UNDO_ERROR_MESSAGE, useBurstScan } from "./useBurstScan";
import { usePurchaseSession } from "./usePurchaseSession";

/** A scan answer, with the fields a test does not care about filled in. */
function answer(overrides: Partial<ScanResult> = {}): ScanResult {
  return { status: "applied", mode: "purchase", ean: "111", name: "Leche", movement_id: 5, quantity_after: 3, ...overrides };
}

/** Answers every scan with the given results, in order, and the last one forever after. */
function mockScans(...results: ScanResult[]) {
  let call = 0;
  server.use(http.post("/api/scan", () => HttpResponse.json(results[Math.min(call++, results.length - 1)])));
}

/** Renders the hook together with the session it records into. */
function renderBurst(mode: ScanMode = "purchase") {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
  return renderHook(
    () => {
      const session = usePurchaseSession();
      return { session, burst: useBurstScan({ mode, location: "pantry", session }) };
    },
    { wrapper },
  );
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useBurstScan — the sheet", () => {
  it("test_burst_scan_showsTheResultAndRecordsAPurchaseInTheSession", async () => {
    mockScans(answer());
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    expect(result.current.burst.sheet).toMatchObject({ kind: "result", result: { ean: "111" } });
    expect(result.current.session.count).toBe(1);
  });

  it("test_burst_scan_consumeMode_doesNotTouchThePurchaseSession", async () => {
    mockScans(answer({ mode: "consume" }));
    const { result } = renderBurst("consume");
    await act(() => result.current.burst.scan("111"));
    expect(result.current.burst.sheet?.kind).toBe("result");
    expect(result.current.session.count).toBe(0);
  });

  it("test_burst_sheet_closesItselfAfterTheDelay", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockScans(answer());
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    expect(result.current.burst.sheet).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(RESULT_SHEET_MS + 1);
    });
    expect(result.current.burst.sheet).toBeNull();
  });

  it("test_burst_newScan_replacesTheOldSheetAndRestartsTheClock", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockScans(answer({ name: "Leche" }), answer({ name: "Pan", ean: "222", movement_id: 6 }));
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    act(() => {
      vi.advanceTimersByTime(RESULT_SHEET_MS - 500);
    });
    await act(() => result.current.burst.scan("222"));
    act(() => {
      vi.advanceTimersByTime(RESULT_SHEET_MS - 500);
    });
    expect(result.current.burst.sheet).toMatchObject({ result: { name: "Pan" } });
  });

  it("test_burst_dismiss_closesTheSheetAtOnce", async () => {
    mockScans(answer());
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    act(() => result.current.burst.dismiss());
    expect(result.current.burst.sheet).toBeNull();
  });

  it("test_burst_scanFails_showsAnErrorSheetAndKeepsTheSessionUntouched", async () => {
    server.use(http.post("/api/scan", () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    expect(result.current.burst.sheet).toMatchObject({ kind: "error", message: SCAN_ERROR_MESSAGE });
    expect(result.current.session.count).toBe(0);
  });
});

describe("useBurstScan — undo", () => {
  it("test_burst_undo_confirmsAndTakesTheUnitBackOutOfTheSession", async () => {
    mockScans(answer());
    server.use(http.post("/api/movements/:id/undo", () => HttpResponse.json({ id: 9 })));
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    await act(() => result.current.burst.undo());
    expect(result.current.burst.sheet).toMatchObject({ kind: "undone", name: "Leche" });
    expect(result.current.session.count).toBe(0);
  });

  it("test_burst_undo_failure_showsAnErrorAndKeepsTheUnit", async () => {
    mockScans(answer());
    server.use(http.post("/api/movements/:id/undo", () => HttpResponse.json({}, { status: 409 })));
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    await act(() => result.current.burst.undo());
    expect(result.current.burst.sheet).toMatchObject({ kind: "error", message: UNDO_ERROR_MESSAGE });
    expect(result.current.session.count).toBe(1);
  });

  it("test_burst_undo_scanWithoutAMovement_doesNothing", async () => {
    mockScans(answer({ status: "unknown", movement_id: null }));
    const undoCalls = vi.fn();
    server.use(http.post("/api/movements/:id/undo", () => { undoCalls(); return HttpResponse.json({}); }));
    const { result } = renderBurst();
    await act(() => result.current.burst.scan("111"));
    await act(() => result.current.burst.undo());
    expect(undoCalls).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.burst.sheet?.kind).toBe("result"));
  });

  it("test_burst_undo_whenThereIsNoSheet_doesNothing", async () => {
    const { result } = renderBurst();
    await act(() => result.current.burst.undo());
    expect(result.current.burst.sheet).toBeNull();
  });
});
