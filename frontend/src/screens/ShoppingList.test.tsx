import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import type { ShoppingListItemOut } from "@/types";
import { ShoppingList } from "./ShoppingList";

/**
 * A shopping list line as the API returns it.
 *
 * @param overrides - Fields to change.
 * @returns The item.
 */
function item(overrides: Partial<ShoppingListItemOut> = {}): ShoppingListItemOut {
  return { ean: "1111111111111", name: "Leche", quantity: 0, threshold: 2, unit: "units", image_url: null, ...overrides };
}

/**
 * Serves a shopping list to the screen.
 *
 * @param items - The items the list should contain.
 */
function mockShoppingList(items: ShoppingListItemOut[]) {
  server.use(http.get("/api/shopping-list", () => HttpResponse.json(items)));
}

/**
 * Records every `PATCH /api/inventory/:ean` sent, failing the ones whose EAN is listed.
 *
 * @param failingEans - EANs whose patch should fail with a server error.
 * @returns A function that returns the patches received so far.
 */
function mockPatch(failingEans: string[] = []) {
  const patches: Array<{ ean: string; body: Record<string, unknown> }> = [];
  server.use(
    http.patch("/api/inventory/:ean", async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const ean = String(params.ean);
      patches.push({ ean, body });
      if (failingEans.includes(ean)) return HttpResponse.json({ detail: "fail" }, { status: 500 });
      return HttpResponse.json({});
    }),
  );
  return () => patches;
}

/** Routes of the shopping list and the detail screen its rows open. */
function listRoutes() {
  return (
    <Routes>
      <Route path="/lista" element={<ShoppingList />} />
      <Route path="/despensa/:ean" element={<div>MANAGE_DETAIL</div>} />
    </Routes>
  );
}

describe("ShoppingList — empty and loading", () => {
  it("test_shoppingList_empty_showsNoFaltaNada", async () => {
    mockShoppingList([]);
    renderInApp(listRoutes(), ["/lista"]);
    expect(await screen.findByText("No falta nada")).toBeInTheDocument();
  });

  it("test_shoppingList_loadError_showsRetry", async () => {
    server.use(http.get("/api/shopping-list", () => HttpResponse.json({ detail: "error" }, { status: 500 })));
    renderInApp(listRoutes(), ["/lista"]);
    expect(await screen.findByText("Error al cargar")).toBeInTheDocument();
  });
});

describe("ShoppingList — lines", () => {
  it("test_shoppingList_item_showsRemainingAndSuggested", async () => {
    mockShoppingList([item({ quantity: 1, threshold: 3 })]);
    renderInApp(listRoutes(), ["/lista"]);
    expect(await screen.findByText("Quedan 1 de 3 · comprar 2")).toBeInTheDocument();
  });

  it("test_shoppingList_zeroThresholdZeroQuantity_suggestsOneUnit", async () => {
    mockShoppingList([item({ quantity: 0, threshold: 0 })]);
    renderInApp(listRoutes(), ["/lista"]);
    expect(await screen.findByText("Quedan 0 de 0 · comprar 1")).toBeInTheDocument();
  });

  it("test_shoppingList_clickName_navigatesToDetail", async () => {
    mockShoppingList([item()]);
    renderInApp(listRoutes(), ["/lista"]);
    fireEvent.click(await screen.findByText("Leche"));
    expect(await screen.findByText("MANAGE_DETAIL")).toBeInTheDocument();
  });
});

describe("ShoppingList — checking items", () => {
  it("test_shoppingList_checkingItem_strikesAndMovesToEnd", async () => {
    mockShoppingList([item({ ean: "1111111111111", name: "Leche" }), item({ ean: "2222222222222", name: "Pan" })]);
    renderInApp(listRoutes(), ["/lista"]);
    await screen.findByText("Leche");
    fireEvent.click(screen.getByRole("checkbox", { name: "Leche" }));
    const names = screen.getAllByText(/^(Leche|Pan)$/).map((element) => element.textContent);
    expect(names).toEqual(["Pan", "Leche"]);
    expect(screen.getByText("Leche")).toHaveClass("line-through");
  });

  it("test_shoppingList_noItemsChecked_buttonDisabled", async () => {
    mockShoppingList([item()]);
    renderInApp(listRoutes(), ["/lista"]);
    expect(await screen.findByRole("button", { name: "Añadir al stock (0)" })).toBeDisabled();
  });

  it("test_shoppingList_oneItemChecked_buttonShowsCountAndEnables", async () => {
    mockShoppingList([item()]);
    renderInApp(listRoutes(), ["/lista"]);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    expect(screen.getByRole("button", { name: "Añadir al stock (1)" })).toBeEnabled();
  });
});

describe("ShoppingList — registering a purchase", () => {
  it("test_shoppingList_registerChecked_sendsPatchWithSummedQuantity", async () => {
    mockShoppingList([item({ quantity: 1, threshold: 3 })]);
    const patches = mockPatch();
    renderInApp(listRoutes(), ["/lista"]);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir al stock (1)" }));
    await waitFor(() => expect(patches()).toEqual([{ ean: "1111111111111", body: { quantity: 3 } }]));
    expect(await screen.findByText("✓ Compra añadida")).toBeInTheDocument();
  });

  it("test_shoppingList_registerTwoChecked_sendsOnePatchEach", async () => {
    mockShoppingList([
      item({ ean: "1111111111111", name: "Leche", quantity: 1, threshold: 3 }),
      item({ ean: "2222222222222", name: "Pan", quantity: 0, threshold: 1 }),
    ]);
    const patches = mockPatch();
    renderInApp(listRoutes(), ["/lista"]);
    await screen.findByText("Leche");
    fireEvent.click(screen.getByRole("checkbox", { name: "Leche" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pan" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir al stock (2)" }));
    await waitFor(() => expect(patches()).toHaveLength(2));
  });

  it("test_shoppingList_partialFailure_keepsFailedItemCheckedAndReportsCount", async () => {
    mockShoppingList([
      item({ ean: "1111111111111", name: "Leche", quantity: 1, threshold: 3 }),
      item({ ean: "2222222222222", name: "Pan", quantity: 0, threshold: 1 }),
    ]);
    mockPatch(["2222222222222"]);
    renderInApp(listRoutes(), ["/lista"]);
    await screen.findByText("Leche");
    fireEvent.click(screen.getByRole("checkbox", { name: "Leche" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pan" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir al stock (2)" }));
    expect(await screen.findByText("No se pudieron añadir 1 productos")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Pan" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Leche" })).not.toBeChecked();
  });
});

describe("ShoppingList — marks persist across a reload", () => {
  it("test_shoppingList_checkedMark_survivesRemount", async () => {
    mockShoppingList([item()]);
    const { unmount } = renderInApp(listRoutes(), ["/lista"]);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    await waitFor(() => expect(localStorage.getItem("shoppingChecked")).toBe(JSON.stringify(["1111111111111"])));
    unmount();
    renderInApp(listRoutes(), ["/lista"]);
    expect(await screen.findByRole("checkbox", { name: "Leche" })).toBeChecked();
  });

  it("test_shoppingList_storageBlocked_stillWorksInMemory", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mockShoppingList([item()]);
    renderInApp(listRoutes(), ["/lista"]);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    expect(screen.getByRole("checkbox", { name: "Leche" })).toBeChecked();
    vi.restoreAllMocks();
  });

  it("test_shoppingList_eanNoLongerOnList_markIsDiscarded", async () => {
    mockShoppingList([item({ ean: "1111111111111", name: "Leche" })]);
    const { unmount } = renderInApp(listRoutes(), ["/lista"]);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Leche" }));
    await waitFor(() => expect(localStorage.getItem("shoppingChecked")).toBe(JSON.stringify(["1111111111111"])));
    unmount();
    mockShoppingList([item({ ean: "2222222222222", name: "Pan" })]);
    renderInApp(listRoutes(), ["/lista"]);
    await screen.findByRole("checkbox", { name: "Pan" });
    await waitFor(() => expect(localStorage.getItem("shoppingChecked")).toBe("[]"));
  });
});
