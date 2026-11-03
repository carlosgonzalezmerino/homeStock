import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import { EAN, productFixture, trackedFixture } from "@/test/fixtures";
import { ProductDetail } from "./ProductDetail";
import { localIsoDate } from "@/utils/date";
import { CONFLICT_MESSAGE } from "@/hooks/useProductEditor";

/** Routes used by the detail screen: the detail itself, and the screens it can return to. */
function detailRoutes(mode: "scan" | "manage") {
  const path = mode === "scan" ? "/scan/:ean" : "/despensa/:ean";
  return (
    <Routes>
      <Route path={path} element={<ProductDetail mode={mode} />} />
      <Route path="/scan" element={<div>SCAN_SCREEN</div>} />
      <Route path="/despensa" element={<div>PANTRY_SCREEN</div>} />
      <Route path="/home" element={<div>HOME_SCREEN</div>} />
    </Routes>
  );
}

/**
 * Mocks the product lookup and the inventory list.
 *
 * @param inventory - The inventory list the API returns.
 * @param product - The product the API returns, or `null` for not found.
 */
function mockDetailApi(inventory: unknown[], product: unknown | null = productFixture()) {
  server.use(
    http.get(`/api/resolve/${EAN}`, () =>
      product ? HttpResponse.json(product) : HttpResponse.json({ ean: EAN }, { status: 404 }),
    ),
    http.get("/api/inventory", () => HttpResponse.json(inventory)),
  );
}

/**
 * Serves one tracked item and applies PATCH requests to it, so the screen sees the saved state like in the app.
 *
 * @param item - The tracked item at the start.
 * @returns The last PATCH body received.
 */
function mockInventoryStore(item: ReturnType<typeof trackedFixture>) {
  let current = item;
  let lastPatch: Record<string, unknown> | undefined;
  server.use(
    http.get(`/api/resolve/${EAN}`, () => HttpResponse.json(productFixture())),
    http.get("/api/inventory", () => HttpResponse.json([current])),
    http.patch(`/api/inventory/${EAN}`, async ({ request }) => {
      lastPatch = (await request.json()) as Record<string, unknown>;
      current = { ...current, inventory: { ...current.inventory, ...lastPatch } };
      return HttpResponse.json(current.inventory);
    }),
  );
  return { lastPatch: () => lastPatch };
}

/**
 * Records the body of the next request sent to a path and answers it.
 *
 * @param method - The HTTP method to intercept.
 * @param path - The path to intercept.
 * @param status - The status to answer with.
 * @returns A function that returns the recorded body, or `undefined` before any request.
 */
function recordBody(method: "post" | "patch", path: string, status = 200) {
  let body: Record<string, unknown> | undefined;
  const handler = http[method](path, async ({ request }) => {
    body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({}, { status });
  });
  server.use(handler);
  return () => body;
}

describe("ProductDetail — scan mode, product not in the pantry", () => {
  it("test_scanNewProduct_showsNewProductNoticeAndAddButton", async () => {
    mockDetailApi([]);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    expect(await screen.findByText("Producto nuevo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Añadir a Despensa" })).toBeInTheDocument();
  });

  it("test_scanNewProduct_defaultsToActiveLocationFreezer", async () => {
    localStorage.setItem("activeLocation", "freezer");
    mockDetailApi([]);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    expect(await screen.findByRole("button", { name: "Añadir a Congelador" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de congelación")).toHaveValue(localIsoDate());
  });

  it("test_scanNewProduct_savePostsLocationThresholdAndQuantity", async () => {
    mockDetailApi([]);
    const body = recordBody("post", "/api/inventory");
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    fireEvent.click(await screen.findByRole("button", { name: "Añadir a Despensa" }));
    await waitFor(() => expect(body()).toMatchObject({ ean: EAN, quantity: 1, threshold: 2, unit: "units", location: "pantry" }));
    expect(body()).not.toHaveProperty("drawer");
  });

  it("test_scanNewProduct_freezerSavePostsDrawerAndTodayAsFrozenDate", async () => {
    mockDetailApi([]);
    const body = recordBody("post", "/api/inventory");
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    fireEvent.click(await screen.findByRole("radio", { name: "Congelador" }));
    fireEvent.click(screen.getByRole("tab", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir a Congelador" }));
    await waitFor(() =>
      expect(body()).toMatchObject({ location: "freezer", drawer: 3, frozen_at: localIsoDate() }),
    );
  });

  it("test_scanNewProduct_thresholdZero_isPostedAsZero", async () => {
    mockDetailApi([]);
    const body = recordBody("post", "/api/inventory");
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    const thresholdInput = (await screen.findAllByLabelText("cantidad"))[1];
    fireEvent.change(thresholdInput, { target: { value: "0" } });
    fireEvent.blur(thresholdInput);
    fireEvent.click(screen.getByRole("button", { name: "Añadir a Despensa" }));
    await waitFor(() => expect(body()).toMatchObject({ threshold: 0 }));
  });

  it("test_scanNewProduct_saveReturnsToScannerWithAddedState", async () => {
    mockDetailApi([]);
    recordBody("post", "/api/inventory");
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    fireEvent.click(await screen.findByRole("button", { name: "Añadir a Despensa" }));
    expect(await screen.findByText("SCAN_SCREEN")).toBeInTheDocument();
  });

  it("test_scanNewProduct_conflictShowsMessageAndStaysOnScreen", async () => {
    mockDetailApi([]);
    recordBody("post", "/api/inventory", 409);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    fireEvent.click(await screen.findByRole("button", { name: "Añadir a Despensa" }));
    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("SCAN_SCREEN")).not.toBeInTheDocument();
  });
});

describe("ProductDetail — scan mode, product already in the pantry", () => {
  it("test_scanTracked_showsAlreadyExistsNoticeWithCurrentQuantityAndLocation", async () => {
    mockDetailApi([trackedFixture({ quantity: 5, unit: "L", location: "pantry" })]);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    expect(await screen.findByText(/Ya existe: 5 L en Despensa\. Se sumarán 1/)).toBeInTheDocument();
  });

  it("test_scanTracked_sumPatchesCurrentQuantityPlusAmount", async () => {
    mockDetailApi([trackedFixture({ quantity: 5 })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    fireEvent.click(await screen.findByRole("button", { name: "＋" }));
    fireEvent.click(screen.getByRole("button", { name: "Sumar 2" }));
    await waitFor(() => expect(body()).toEqual({ quantity: 7, reason: "purchase" }));
  });

  it("test_scanTracked_decimalAmountIsAddedExactly", async () => {
    mockDetailApi([trackedFixture({ quantity: 5 })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    const amount = await screen.findByLabelText("cantidad");
    fireEvent.change(amount, { target: { value: "0,5" } });
    fireEvent.blur(amount);
    fireEvent.click(screen.getByRole("button", { name: "Sumar 0,5" }));
    await waitFor(() => expect(body()).toEqual({ quantity: 5.5, reason: "purchase" }));
  });

  it("test_scanTracked_savedAddReturnsToScanner", async () => {
    mockDetailApi([trackedFixture({ quantity: 5 })]);
    recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    fireEvent.click(await screen.findByRole("button", { name: "Sumar 1" }));
    expect(await screen.findByText("SCAN_SCREEN")).toBeInTheDocument();
  });

  it("test_scanTracked_changingLocationShowsWarningAndSendsLocationWithDate", async () => {
    mockDetailApi([trackedFixture({ quantity: 5, location: "pantry" })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    fireEvent.click(await screen.findByRole("radio", { name: "Congelador" }));
    expect(screen.getByText("Cambiar la ubicación mueve todas las unidades")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sumar 1" }));
    await waitFor(() =>
      expect(body()).toEqual({ quantity: 6, reason: "purchase", location: "freezer", frozen_at: localIsoDate() }),
    );
  });

  it("test_scanTracked_preselectsCurrentLocationNotActiveTab", async () => {
    localStorage.setItem("activeLocation", "pantry");
    mockDetailApi([trackedFixture({ quantity: 5, location: "freezer" })]);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    expect(await screen.findByRole("radio", { name: "Congelador" })).toBeChecked();
    expect(screen.queryByText("Cambiar la ubicación mueve todas las unidades")).not.toBeInTheDocument();
  });
});

describe("ProductDetail — manage mode, product in the pantry", () => {
  it("test_manageTracked_updateSendsExactDecimalQuantity", async () => {
    mockDetailApi([trackedFixture({ quantity: 3 })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    const quantity = (await screen.findAllByLabelText("cantidad"))[0];
    fireEvent.change(quantity, { target: { value: "0,5" } });
    fireEvent.blur(quantity);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar cantidad" }));
    await waitFor(() => expect(body()).toEqual({ quantity: 0.5 }));
  });

  it("test_manageTracked_minusAtHalfUnitGoesToZeroNotNegative", async () => {
    mockDetailApi([trackedFixture({ quantity: 0.5 })]);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    const minus = (await screen.findAllByRole("button", { name: "−" }))[0];
    fireEvent.click(minus);
    expect((await screen.findAllByLabelText("cantidad"))[0]).toHaveValue("0");
  });

  it("test_manageTracked_saveWithPreviousScreenGoesBack", async () => {
    mockDetailApi([trackedFixture({ quantity: 3 })]);
    recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(
      detailRoutes("manage"),
      ["/home", `/despensa/${EAN}`],
      1,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar cantidad" }));
    expect(await screen.findByText("HOME_SCREEN")).toBeInTheDocument();
  });

  it("test_manageTracked_saveWithoutPreviousScreenGoesToPantry", async () => {
    mockDetailApi([trackedFixture({ quantity: 3 })]);
    recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    fireEvent.click(await screen.findByRole("button", { name: "Actualizar cantidad" }));
    expect(await screen.findByText("PANTRY_SCREEN")).toBeInTheDocument();
  });

  it("test_manageTracked_threshold_canBeSetToZero", async () => {
    mockDetailApi([trackedFixture({ threshold: 2 })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    await screen.findByText("Umbral de alerta");
    const thresholdMinus = screen.getAllByRole("button", { name: "−" })[1];
    fireEvent.click(thresholdMinus);
    fireEvent.click(thresholdMinus);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(body()).toEqual({ threshold: 0 }));
  });

  it("test_manageTracked_moveToFreezerSendsLocationAndTodayAsFrozenDate", async () => {
    mockDetailApi([trackedFixture({ location: "pantry" })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    fireEvent.click(await screen.findByRole("radio", { name: "Congelador" }));
    await waitFor(() => expect(body()).toEqual({ location: "freezer", frozen_at: localIsoDate() }));
  });

  it("test_manageTracked_moveToPantryHidesFreezerFields", async () => {
    const store = mockInventoryStore(trackedFixture({ location: "freezer", drawer: 2, frozen_at: "2026-10-01" }));
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    fireEvent.click(await screen.findByRole("radio", { name: "Despensa" }));
    await waitFor(() => expect(store.lastPatch()).toEqual({ location: "pantry" }));
    await waitFor(() => expect(screen.queryByLabelText("Fecha de congelación")).not.toBeInTheDocument());
  });

  it("test_manageTracked_moveToFreezerShowsFreezerFieldsAfterSave", async () => {
    mockInventoryStore(trackedFixture({ location: "pantry" }));
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    fireEvent.click(await screen.findByRole("radio", { name: "Congelador" }));
    expect(await screen.findByLabelText("Fecha de congelación")).toHaveValue(localIsoDate());
  });

  it("test_manageTracked_freezerCardSavesDrawerAndDate", async () => {
    mockDetailApi([trackedFixture({ location: "freezer", drawer: null, frozen_at: "2026-10-01" })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    fireEvent.click(await screen.findByRole("tab", { name: "3" }));
    fireEvent.change(screen.getByLabelText("Fecha de congelación"), { target: { value: "2026-09-15" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" })[0]);
    await waitFor(() => expect(body()).toEqual({ drawer: 3, frozen_at: "2026-09-15" }));
  });

  it("test_manageTracked_freezerRowWithoutDate_saysNoDateAndStillWorks", async () => {
    mockDetailApi([trackedFixture({ location: "freezer", drawer: null, frozen_at: null })]);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    expect(await screen.findByText("Sin fecha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar cantidad" })).toBeEnabled();
  });

  it("test_manageTracked_freezerCardShowsAgeNextToDate", async () => {
    const twelveDaysAgo = new Date();
    twelveDaysAgo.setDate(twelveDaysAgo.getDate() - 12);
    mockDetailApi([trackedFixture({ location: "freezer", drawer: 2, frozen_at: localIsoDate(twelveDaysAgo) })]);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    expect(await screen.findByText("Hace 12 días")).toBeInTheDocument();
  });

  it("test_manageTracked_notesSaveOnlyWhenChanged", async () => {
    mockDetailApi([trackedFixture({ notes: null })]);
    const body = recordBody("patch", `/api/inventory/${EAN}`);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    const notes = await screen.findByLabelText("Notas");
    const saveNote = screen.getByRole("button", { name: "Guardar nota" });
    expect(saveNote).toBeDisabled();
    fireEvent.change(notes, { target: { value: "Hay 5 muslitos" } });
    fireEvent.click(saveNote);
    await waitFor(() => expect(body()).toEqual({ notes: "Hay 5 muslitos" }));
  });

  it("test_manageTracked_noteAboveFourHundredCharacters_showsCounter", async () => {
    mockDetailApi([trackedFixture({ notes: "x".repeat(410) })]);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    expect(await screen.findByText("410/500")).toBeInTheDocument();
  });

  it("test_manageTracked_removeDeletesAndGoesToPantry", async () => {
    mockDetailApi([trackedFixture()]);
    let deleted = false;
    server.use(
      http.delete(`/api/inventory/${EAN}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    fireEvent.click(await screen.findByRole("button", { name: "Quitar de la despensa" }));
    expect(await screen.findByText("PANTRY_SCREEN")).toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it("test_manageTracked_untrackedProductInManageMode_showsAddCard", async () => {
    mockDetailApi([]);
    renderInApp(detailRoutes("manage"), [`/despensa/${EAN}`]);
    expect(await screen.findByText("Producto nuevo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actualizar cantidad" })).not.toBeInTheDocument();
  });
});

describe("ProductDetail — loading and errors", () => {
  it("test_detail_productNotFound_showsNotFoundMessage", async () => {
    mockDetailApi([], null);
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    expect(await screen.findByText("Producto no encontrado")).toBeInTheDocument();
  });

  it("test_detail_inventoryFails_doesNotShowAddFormAsNewProduct", async () => {
    server.use(
      http.get(`/api/resolve/${EAN}`, () => HttpResponse.json(productFixture())),
      http.get("/api/inventory", () => HttpResponse.json({}, { status: 500 })),
    );
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    expect(await screen.findByText("Error al cargar el inventario")).toBeInTheDocument();
    expect(screen.queryByText("Producto nuevo")).not.toBeInTheDocument();
  });

  it("test_detail_inventoryStillLoading_doesNotShowAddFormAsNewProduct", async () => {
    server.use(
      http.get(`/api/resolve/${EAN}`, () => HttpResponse.json(productFixture())),
      http.get("/api/inventory", () => new Promise(() => undefined)),
    );
    renderInApp(detailRoutes("scan"), [`/scan/${EAN}`]);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Producto nuevo")).not.toBeInTheDocument();
  });
});
