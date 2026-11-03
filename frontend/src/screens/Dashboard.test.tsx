import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import { trackedFixture } from "@/test/fixtures";
import { Dashboard } from "./Dashboard";

/**
 * Serves an inventory list to the dashboard.
 *
 * @param items - The tracked items to list.
 */
function mockInventory(items: ReturnType<typeof trackedFixture>[]) {
  server.use(http.get("/api/inventory", () => HttpResponse.json(items)));
}

/** Routes of the dashboard and the detail screen its alerts open. */
function dashboardRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/despensa/:ean" element={<div>MANAGE_DETAIL</div>} />
    </Routes>
  );
}

describe("Dashboard — alerts", () => {
  it("test_alert_clickOpensProductDetailInManageMode", async () => {
    mockInventory([trackedFixture({ quantity: 1, threshold: 2 }, { name: "Aceite Oliva", ean: "9999999999999" })]);
    renderInApp(dashboardRoutes(), ["/"]);
    fireEvent.click(await screen.findByText("Aceite Oliva"));
    expect(await screen.findByText("MANAGE_DETAIL")).toBeInTheDocument();
  });

  it("test_alert_emptyItemShowsEmptyBadgeAndNoBrokenBar", async () => {
    mockInventory([trackedFixture({ quantity: 0, threshold: 0 }, { name: "Hamburguesa" })]);
    renderInApp(dashboardRoutes(), ["/"]);
    expect(await screen.findByText("Hamburguesa")).toBeInTheDocument();
    expect(screen.getByLabelText("Agotado")).toBeInTheDocument();
    expect(screen.getByTestId("level-bar-fill")).toHaveStyle({ width: "0%" });
  });

  it("test_alert_zeroThresholdWithHalfUnitLeft_isNotAnAlert", async () => {
    mockInventory([trackedFixture({ quantity: 0.5, threshold: 0 }, { name: "Pan" })]);
    renderInApp(dashboardRoutes(), ["/"]);
    expect(await screen.findByText(/Sin alertas/)).toBeInTheDocument();
    expect(screen.queryByText("Pan")).not.toBeInTheDocument();
  });

  it("test_alert_halfUnitQuantity_isShownWithDecimalComma", async () => {
    mockInventory([trackedFixture({ quantity: 0.5, threshold: 1, unit: "L" }, { name: "Leche" })]);
    renderInApp(dashboardRoutes(), ["/"]);
    expect(await screen.findByText("0,5 L restantes")).toBeInTheDocument();
  });
});

describe("Dashboard — alerts for custom products", () => {
  it("test_alert_customProductWithoutBarcode_opensDetailWithEncodedCode", async () => {
    mockInventory([trackedFixture({ ean: "CUSTOM-AB12CD34", quantity: 0, threshold: 1 }, { ean: "CUSTOM-AB12CD34", name: "Tupper" })]);
    renderInApp(dashboardRoutes(), ["/"]);
    fireEvent.click(await screen.findByText("Tupper"));
    expect(await screen.findByText("MANAGE_DETAIL")).toBeInTheDocument();
  });
});
