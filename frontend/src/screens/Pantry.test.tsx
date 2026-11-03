import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import { trackedFixture } from "@/test/fixtures";
import { Pantry } from "./Pantry";

const PANTRY_ITEM = trackedFixture(
  { ean: "1111111111111", id: 1, quantity: 5, threshold: 2, location: "pantry" },
  { ean: "1111111111111", name: "Leche Entera", brand: "Hacendado", source: "openfoodfacts" },
);
const FREEZER_ITEM = trackedFixture(
  { ean: "2222222222222", id: 2, quantity: 0.5, threshold: 1, location: "freezer", drawer: 2, notes: "Hay 5 muslitos", unit: "units" },
  { ean: "2222222222222", name: "Pollo troceado", brand: null, source: "manual" },
);

/** Routes of the pantry screen and the screens its links open. */
function pantryRoutes() {
  return (
    <Routes>
      <Route path="/despensa" element={<Pantry />} />
      <Route path="/scan" element={<div>SCAN_SCREEN</div>} />
    </Routes>
  );
}

/**
 * Serves the given inventory and records the PATCH bodies sent by the inline stepper.
 *
 * @param items - The inventory items to list.
 * @returns A function that returns the PATCH bodies received so far.
 */
function mockInventory(items = [PANTRY_ITEM, FREEZER_ITEM]) {
  const patches: Array<Record<string, unknown>> = [];
  server.use(
    http.get("/api/inventory", () => HttpResponse.json(items)),
    http.patch("/api/inventory/:ean", async ({ request }) => {
      patches.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({});
    }),
  );
  return () => patches;
}

describe("Pantry — location shared with the rest of the app", () => {
  it("test_pantry_startsOnStoredLocation", async () => {
    localStorage.setItem("activeLocation", "freezer");
    mockInventory();
    renderInApp(pantryRoutes(), ["/despensa"]);
    expect(await screen.findByText("Pollo troceado")).toBeInTheDocument();
    expect(screen.queryByText("Leche Entera")).not.toBeInTheDocument();
  });

  it("test_pantry_switchingTab_storesLocationForOtherScreens", async () => {
    mockInventory();
    renderInApp(pantryRoutes(), ["/despensa"]);
    fireEvent.click(await screen.findByRole("tab", { name: "Congelador" }));
    expect(screen.getByText("Pollo troceado")).toBeInTheDocument();
    expect(screen.queryByText("Leche Entera")).not.toBeInTheDocument();
    expect(localStorage.getItem("activeLocation")).toBe("freezer");
  });

  it("test_pantry_freezerEmptyState_mentionsCustomEntry", async () => {
    mockInventory([PANTRY_ITEM]);
    renderInApp(pantryRoutes(), ["/despensa"]);
    fireEvent.click(await screen.findByRole("tab", { name: "Congelador" }));
    expect(screen.getByText(/Tu congelador está vacío/)).toBeInTheDocument();
  });
});

describe("Pantry — item details", () => {
  it("test_pantry_freezerItem_showsDrawerAndNote", async () => {
    localStorage.setItem("activeLocation", "freezer");
    mockInventory();
    renderInApp(pantryRoutes(), ["/despensa"]);
    expect(await screen.findByText("Cajón 2 · Hay 5 muslitos")).toBeInTheDocument();
  });

  it("test_pantry_manualProduct_showsManualIconOnlyForManualProducts", async () => {
    mockInventory();
    localStorage.setItem("activeLocation", "freezer");
    const { unmount } = renderInApp(pantryRoutes(), ["/despensa"]);
    expect(await screen.findByRole("img", { name: "Añadido a mano" })).toBeInTheDocument();
    unmount();
    localStorage.setItem("activeLocation", "pantry");
    renderInApp(pantryRoutes(), ["/despensa"]);
    expect(await screen.findByText("Leche Entera")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Añadido a mano" })).not.toBeInTheDocument();
  });

  it("test_pantry_halfUnitQuantity_isShownWithDecimalComma", async () => {
    localStorage.setItem("activeLocation", "freezer");
    mockInventory();
    renderInApp(pantryRoutes(), ["/despensa"]);
    expect(await screen.findByText("0,5")).toBeInTheDocument();
  });

  it("test_pantry_itemLinksToDetailInManageMode", async () => {
    mockInventory();
    renderInApp(
      <Routes>
        <Route path="/despensa" element={<Pantry />} />
        <Route path="/despensa/:ean" element={<div>MANAGE_DETAIL</div>} />
      </Routes>,
      ["/despensa"],
    );
    fireEvent.click(await screen.findByRole("button", { name: "Leche Entera" }));
    expect(await screen.findByText("MANAGE_DETAIL")).toBeInTheDocument();
  });
});

describe("Pantry — inline quantity", () => {
  it("test_pantry_plusFromHalfUnit_sendsRoundedQuantity", async () => {
    localStorage.setItem("activeLocation", "freezer");
    const patches = mockInventory();
    renderInApp(pantryRoutes(), ["/despensa"]);
    const row = (await screen.findByText("Pollo troceado")).closest("div.flex") as HTMLElement;
    fireEvent.click(within(row.parentElement as HTMLElement).getByRole("button", { name: "＋" }));
    await waitFor(() => expect(patches()).toEqual([{ quantity: 1.5 }]));
  });

  it("test_pantry_minusFromHalfUnit_sendsZeroNotNegative", async () => {
    localStorage.setItem("activeLocation", "freezer");
    const patches = mockInventory();
    renderInApp(pantryRoutes(), ["/despensa"]);
    const minus = (await screen.findAllByRole("button", { name: "−" }))[0];
    fireEvent.click(minus);
    await waitFor(() => expect(patches()).toEqual([{ quantity: 0 }]));
  });
});

describe("Pantry — added confirmation", () => {
  it("test_pantry_arrivingWithAddedState_showsConfirmation", async () => {
    mockInventory();
    renderInApp(
      <Routes>
        <Route path="/despensa" element={<Pantry />} />
      </Routes>,
      [{ pathname: "/despensa", state: { added: true } }],
    );
    expect(await screen.findByText("✓ Producto añadido")).toBeInTheDocument();
  });

  it("test_pantry_withoutAddedState_hidesConfirmation", async () => {
    mockInventory();
    renderInApp(pantryRoutes(), ["/despensa"]);
    await screen.findByText("Leche Entera");
    expect(screen.queryByText("✓ Producto añadido")).not.toBeInTheDocument();
  });
});

describe("Pantry — manual products in the pantry tab", () => {
  it("test_pantry_manualProductInPantryTab_showsManualIcon", async () => {
    const manualPantryItem = trackedFixture(
      { ean: "3333333333333", id: 3, location: "pantry" },
      { ean: "3333333333333", name: "Pan casero", source: "manual" },
    );
    mockInventory([manualPantryItem]);
    renderInApp(pantryRoutes(), ["/despensa"]);
    expect(await screen.findByText("Pan casero")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Añadido a mano" })).toBeInTheDocument();
  });
});
