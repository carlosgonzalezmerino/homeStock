import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import type { ReviewCandidate } from "@/types";
import { Review } from "./Review";

/** A review card, with the fields a test does not care about filled in. */
function card(overrides: Partial<ReviewCandidate> = {}): ReviewCandidate {
  return {
    ean: "111",
    name: "Leche",
    brand: "Hacendado",
    quantity: 2,
    unit: "units",
    reason: "overdue",
    estimated_empty_on: "2026-10-30",
    days_since_activity: 20,
    ...overrides,
  };
}

/** What the fake backend received from the review screen. */
interface Received {
  confirmed: string[];
  patches: Array<{ ean: string; body: Record<string, unknown>; source: string | null }>;
}

/** Serves a review list and records the answers. */
function serveReview(cards: ReviewCandidate[], failing = false): Received {
  const received: Received = { confirmed: [], patches: [] };
  server.use(
    http.get("/api/review", () => HttpResponse.json(cards)),
    http.post("/api/review/:ean/confirm", ({ params }) => {
      if (failing) return HttpResponse.json({}, { status: 500 });
      received.confirmed.push(String(params.ean));
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch("/api/inventory/:ean", async ({ request, params }) => {
      received.patches.push({
        ean: String(params.ean),
        body: (await request.json()) as Record<string, unknown>,
        source: request.headers.get("x-homestock-source"),
      });
      return HttpResponse.json({});
    }),
  );
  return received;
}

function renderReview() {
  return renderInApp(
    <Routes>
      <Route path="/repaso" element={<Review />} />
    </Routes>,
    ["/repaso"],
  );
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("Review — loading and empty", () => {
  it("test_review_noCandidates_saysThereIsNothingToReview", async () => {
    serveReview([]);
    renderReview();
    expect(await screen.findByText("No hay nada que repasar")).toBeInTheDocument();
  });

  it("test_review_loadFails_showsTheErrorState", async () => {
    server.use(http.get("/api/review", () => HttpResponse.json({}, { status: 500 })));
    renderReview();
    expect(await screen.findByText("Error al cargar")).toBeInTheDocument();
  });
});

describe("Review — one card at a time", () => {
  it("test_review_showsTheFirstCardWithItsProgressAndReason", async () => {
    serveReview([card(), card({ ean: "222", name: "Pan" })]);
    renderReview();
    expect(await screen.findByText("Leche")).toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByText(/ya debería haberse acabado/)).toBeInTheDocument();
    expect(screen.getByText("Tienes registrados 2 units")).toBeInTheDocument();
  });

  it("test_review_staleCard_saysHowLongAgoItWasTouched", async () => {
    serveReview([card({ reason: "stale", days_since_activity: 95 })]);
    renderReview();
    expect(await screen.findByText("Lo tocaste por última vez hace 3 meses")).toBeInTheDocument();
  });

  it("test_review_unchangedStepper_mainButtonConfirmsWithoutChangingStock", async () => {
    const received = serveReview([card(), card({ ean: "222", name: "Pan" })]);
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "Sigue igual" }));
    expect(await screen.findByText("Pan")).toBeInTheDocument();
    expect(received.confirmed).toEqual(["111"]);
    expect(received.patches).toEqual([]);
  });

  it("test_review_lowerQuantity_savesAConsumptionFromTheReview", async () => {
    const received = serveReview([card()]);
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "−" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar 1" }));
    await waitFor(() => expect(received.patches).toHaveLength(1));
    expect(received.patches[0]).toEqual({ ean: "111", body: { quantity: 1, reason: "consume" }, source: "review" });
  });

  it("test_review_higherQuantity_savesAPurchaseFromTheReview", async () => {
    const received = serveReview([card()]);
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "＋" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar 3" }));
    await waitFor(() => expect(received.patches[0]?.body).toEqual({ quantity: 3, reason: "purchase" }));
  });

  it("test_review_runOut_setsZeroAsAConsumption", async () => {
    const received = serveReview([card()]);
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "Se acabó" }));
    await waitFor(() => expect(received.patches).toHaveLength(1));
    expect(received.patches[0]).toEqual({ ean: "111", body: { quantity: 0, reason: "consume" }, source: "review" });
  });

  it("test_review_skip_movesOnWithoutAnyRequest", async () => {
    const received = serveReview([card(), card({ ean: "222", name: "Pan" })]);
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "Saltar" }));
    expect(await screen.findByText("Pan")).toBeInTheDocument();
    expect(received.confirmed).toEqual([]);
    expect(received.patches).toEqual([]);
  });

  it("test_review_afterTheLastCard_saysHowManyWereChecked", async () => {
    serveReview([card(), card({ ean: "222", name: "Pan" })]);
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "Sigue igual" }));
    await screen.findByText("Pan"); // the second card; the first card's buttons are disabled while saving
    fireEvent.click(screen.getByRole("button", { name: "Saltar" }));
    expect(await screen.findByText("Listo, 1 comprobados")).toBeInTheDocument();
  });

  it("test_review_answerFails_staysOnTheCardAndShowsTheError", async () => {
    serveReview([card(), card({ ean: "222", name: "Pan" })], true);
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "Sigue igual" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(screen.getByText("Leche")).toBeInTheDocument();
    expect(screen.queryByText("Pan")).not.toBeInTheDocument();
  });

  it("test_review_listIsFrozen_soAnswersDoNotReorderTheCards", async () => {
    const cards = [card(), card({ ean: "222", name: "Pan" }), card({ ean: "333", name: "Café" })];
    serveReview(cards);
    renderReview();
    await screen.findByText("Leche");
    // After the first answer the backend no longer lists the first card, as it really would.
    let refetches = 0;
    server.use(
      http.get("/api/review", () => {
        refetches += 1;
        return HttpResponse.json(cards.slice(1));
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sigue igual" }));
    await waitFor(() => expect(refetches).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50)); // let the refetched list reach the screen
    });
    expect(screen.getByText("Pan")).toBeInTheDocument();
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
  });
});
