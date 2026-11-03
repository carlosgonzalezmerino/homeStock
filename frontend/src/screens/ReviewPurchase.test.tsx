import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import { EAN, productFixture, trackedFixture } from "@/test/fixtures";
import { ReviewPurchase } from "./ReviewPurchase";

/** Writes a shopping session as the scan screen would have left it. */
function seedSession(session: unknown) {
  localStorage.setItem("purchaseSession", JSON.stringify(session));
}

const LINE = { ean: EAN, name: "Leche Entera", imageUrl: null, units: 3, isNew: false, movementIds: [1, 2, 3] };

/** Shows where the router is, so a test can check a navigation and its state. */
function WhereAmI() {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}|${JSON.stringify(location.state)}`}</div>;
}

/** Renders the review screen with the screens it leads to. */
function renderReview(trackedEans: string[] = []) {
  server.use(
    http.get("/api/inventory", () =>
      HttpResponse.json(trackedEans.map((ean) => trackedFixture({ ean }, productFixture({ ean })))),
    ),
  );
  return renderInApp(
    <Routes>
      <Route path="/scan/revisar" element={<ReviewPurchase />} />
      <Route path="*" element={<WhereAmI />} />
    </Routes>,
    ["/scan/revisar"],
  );
}

describe("ReviewPurchase", () => {
  it("test_reviewPurchase_emptySession_saysThereIsNothingToReview", async () => {
    renderReview();
    expect(await screen.findByText("No hay nada que revisar")).toBeInTheDocument();
  });

  it("test_reviewPurchase_showsEachScannedProductWithItsUnits", async () => {
    seedSession({ lines: [LINE], unknown: [] });
    renderReview([EAN]);
    expect(await screen.findByText("Leche Entera")).toBeInTheDocument();
    expect(screen.getByText("×3")).toBeInTheDocument();
  });

  it("test_reviewPurchase_newProducts_getTheirOwnBlockToCheckTheThreshold", async () => {
    seedSession({ lines: [{ ...LINE, isNew: true }, { ...LINE, ean: "999", name: "Pan", isNew: false }], unknown: [] });
    renderReview([EAN, "999"]);
    const block = await screen.findByRole("region", { name: "Revisa el umbral" });
    expect(block).toHaveTextContent("Leche Entera");
    expect(block).not.toHaveTextContent("Pan");
  });

  it("test_reviewPurchase_noNewProducts_hidesThatBlock", async () => {
    seedSession({ lines: [LINE], unknown: [] });
    renderReview([EAN]);
    await screen.findByText("Leche Entera");
    expect(screen.queryByRole("region", { name: "Revisa el umbral" })).not.toBeInTheDocument();
  });

  it("test_reviewPurchase_tappingAProduct_opensItsPantryDetail", async () => {
    seedSession({ lines: [LINE], unknown: [] });
    renderReview([EAN]);
    fireEvent.click(await screen.findByText("Leche Entera"));
    expect(await screen.findByTestId("where")).toHaveTextContent(`/despensa/${EAN}`);
  });

  it("test_reviewPurchase_unknownCode_offersToRegisterItAndComesBackHere", async () => {
    seedSession({ lines: [], unknown: ["0000000000017"] });
    renderReview();
    fireEvent.click(await screen.findByRole("button", { name: "Dar de alta" }));
    const where = await screen.findByTestId("where");
    expect(where).toHaveTextContent("/scan/0000000000017/manual");
    expect(where).toHaveTextContent('{"returnTo":"/scan/revisar"}');
  });

  it("test_reviewPurchase_unknownCodeThatIsNowTracked_disappearsByItself", async () => {
    seedSession({ lines: [LINE], unknown: [EAN] });
    renderReview([EAN]);
    await screen.findByText("Leche Entera");
    await waitFor(() => expect(screen.queryByRole("region", { name: "Sin identificar" })).not.toBeInTheDocument());
  });

  it("test_reviewPurchase_finish_clearsTheSessionAndGoesToThePantry", async () => {
    seedSession({ lines: [LINE], unknown: [] });
    renderReview([EAN]);
    fireEvent.click(await screen.findByRole("button", { name: "Terminar" }));
    const where = await screen.findByTestId("where");
    expect(where).toHaveTextContent("/despensa");
    expect(where).toHaveTextContent('{"added":true}');
    expect(JSON.parse(localStorage.getItem("purchaseSession") ?? "{}")).toEqual({ lines: [], unknown: [] });
  });
});
