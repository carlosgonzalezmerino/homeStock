import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import { productFixture } from "@/test/fixtures";
import { CustomEntry } from "./CustomEntry";
import { localIsoDate } from "@/utils/date";
import { REQUIRED_MESSAGE, QUANTITY_RANGE_MESSAGE } from "@/utils/parse";
import { SAVE_ERROR_MESSAGE } from "@/hooks/useProductEditor";

/** Routes of the custom entry flow and the screens it opens. */
function customRoutes() {
  return (
    <Routes>
      <Route path="/custom-entry" element={<CustomEntry />} />
      <Route path="/scan/:ean" element={<div>SCAN_DETAIL</div>} />
      <Route path="/despensa" element={<div>PANTRY_SCREEN</div>} />
    </Routes>
  );
}

/**
 * Records the product and inventory requests of the custom entry.
 *
 * @param options - Status codes to answer with.
 * @returns The list of recorded calls.
 */
function recordSaves(
  options: { inventoryStatus?: number } = {},
  calls: Array<{ path: string; body: Record<string, unknown> }> = [],
) {
  server.use(
    http.post("/api/products", async ({ request }) => {
      calls.push({ path: "products", body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({}, { status: 201 });
    }),
    http.post("/api/inventory", async ({ request }) => {
      calls.push({ path: "inventory", body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({}, { status: options.inventoryStatus ?? 201 });
    }),
  );
  return calls;
}

/** Opens the form for a new product by searching first, as the user does. */
async function openCreateForm() {
  fireEvent.click(await screen.findByRole("button", { name: "Crear nuevo" }));
}

describe("CustomEntry — search", () => {
  it("test_customSearch_choosingExistingProduct_opensScanDetail", async () => {
    server.use(
      http.get("/api/products", () => HttpResponse.json([productFixture({ ean: "5000112637922", name: "Pasta" })])),
    );
    renderInApp(customRoutes(), ["/custom-entry"]);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pas" } });
    fireEvent.click(await screen.findByText("Pasta"));
    expect(await screen.findByText("SCAN_DETAIL")).toBeInTheDocument();
  });

  it("test_customSearch_createNew_opensFormWithFreezerPreselected", async () => {
    renderInApp(customRoutes(), ["/custom-entry"]);
    await openCreateForm();
    expect(screen.getByRole("radio", { name: "Congelador" })).toBeChecked();
    expect(screen.getByLabelText("Fecha de congelación")).toHaveValue(localIsoDate());
  });
});

describe("CustomEntry — validation", () => {
  it("test_customEntry_emptyName_showsRequiredAndDoesNotSave", async () => {
    const calls = recordSaves();
    renderInApp(customRoutes(), ["/custom-entry"]);
    await openCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText(REQUIRED_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("test_customEntry_invalidQuantity_showsRangeErrorAndDoesNotSave", async () => {
    const calls = recordSaves();
    renderInApp(customRoutes(), ["/custom-entry"]);
    await openCreateForm();
    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Pollo" } });
    fireEvent.change(screen.getByLabelText("Cantidad inicial"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText(QUANTITY_RANGE_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe("CustomEntry — saving", () => {
  it("test_customEntry_save_postsCustomProductThenFreezerStockAndGoesToPantry", async () => {
    const calls = recordSaves();
    renderInApp(customRoutes(), ["/custom-entry"]);
    await openCreateForm();
    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Albóndigas" } });
    fireEvent.change(screen.getByLabelText("Cantidad inicial"), { target: { value: "0,5" } });
    fireEvent.click(screen.getByRole("tab", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("PANTRY_SCREEN")).toBeInTheDocument();
    const product = calls.find((call) => call.path === "products")?.body;
    const stock = calls.find((call) => call.path === "inventory")?.body;
    expect(String(product?.ean)).toMatch(/^CUSTOM-[A-Z0-9]{8}$/);
    expect(stock).toMatchObject({
      ean: product?.ean,
      quantity: 0.5,
      threshold: 1,
      location: "freezer",
      drawer: 2,
      frozen_at: localIsoDate(),
    });
    expect(localStorage.getItem("activeLocation")).toBe("freezer");
  });

  it("test_customEntry_retryAfterInventoryFailure_reusesProductAndCode", async () => {
    const calls = recordSaves({ inventoryStatus: 500 });
    renderInApp(customRoutes(), ["/custom-entry"]);
    await openCreateForm();
    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Albóndigas" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText(SAVE_ERROR_MESSAGE)).toBeInTheDocument();
    server.resetHandlers();
    recordSaves({}, calls);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(calls.filter((call) => call.path === "products")).toHaveLength(1));
    await screen.findByText("PANTRY_SCREEN");
    const eans = calls.filter((call) => call.path === "products").map((call) => call.body.ean);
    expect(new Set(eans).size).toBe(1);
  });
});
