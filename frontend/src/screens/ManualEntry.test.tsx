import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { renderInApp } from "@/test/helpers";
import { ManualEntry, returnDestination } from "./ManualEntry";
import { localIsoDate } from "@/utils/date";
import { QUANTITY_RANGE_MESSAGE, REQUIRED_MESSAGE } from "@/utils/parse";
import { CONFLICT_MESSAGE, SAVE_ERROR_MESSAGE } from "@/hooks/useProductEditor";

const EAN = "8410376003139";

/** Routes of the manual entry flow: the form, and the pantry it returns to. */
function manualRoutes() {
  return (
    <Routes>
      <Route path="/scan/:ean/manual" element={<ManualEntry />} />
      <Route path="/despensa" element={<div>PANTRY_SCREEN</div>} />
    </Routes>
  );
}

/** Records the request bodies of the product and inventory endpoints. */
function recordSaves(options: { productStatus?: number; inventoryStatus?: number } = {}) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  server.use(
    http.post("/api/products", async ({ request }) => {
      calls.push({ path: "products", body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({}, { status: options.productStatus ?? 201 });
    }),
    http.post("/api/inventory", async ({ request }) => {
      calls.push({ path: "inventory", body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({}, { status: options.inventoryStatus ?? 201 });
    }),
  );
  return calls;
}

/**
 * Fills in the required name and submits the form.
 */
function submitWithName() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Aceite" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
}

describe("ManualEntry — quantities", () => {
  it("test_manualEntry_halfUnitQuantity_isPostedAsDecimal", async () => {
    const calls = recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    fireEvent.change(screen.getByLabelText("Cantidad inicial"), { target: { value: "0,5" } });
    submitWithName();
    await waitFor(() => expect(calls.at(-1)?.body).toMatchObject({ quantity: 0.5 }));
  });

  it("test_manualEntry_thresholdZero_isAccepted", async () => {
    const calls = recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    fireEvent.change(screen.getByLabelText("Umbral mínimo"), { target: { value: "0" } });
    submitWithName();
    await waitFor(() => expect(calls.at(-1)?.body).toMatchObject({ threshold: 0 }));
  });

  it("test_manualEntry_negativeQuantity_showsRangeErrorAndDoesNotSave", async () => {
    const calls = recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    fireEvent.change(screen.getByLabelText("Cantidad inicial"), { target: { value: "-1" } });
    submitWithName();
    expect(await screen.findByText(QUANTITY_RANGE_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("test_manualEntry_threeDecimals_showsRangeError", async () => {
    recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    fireEvent.change(screen.getByLabelText("Cantidad inicial"), { target: { value: "1,234" } });
    submitWithName();
    expect(await screen.findByText(QUANTITY_RANGE_MESSAGE)).toBeInTheDocument();
  });

  it("test_manualEntry_emptyQuantity_showsRequired", async () => {
    recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    fireEvent.change(screen.getByLabelText("Cantidad inicial"), { target: { value: "" } });
    submitWithName();
    expect(await screen.findByText(REQUIRED_MESSAGE)).toBeInTheDocument();
  });

  it("test_manualEntry_invalidNutritionValue_showsErrorAndDoesNotSave", async () => {
    const calls = recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    fireEvent.change(screen.getByLabelText("Calorías (kcal)"), { target: { value: "abc" } });
    submitWithName();
    expect(await screen.findByText(QUANTITY_RANGE_MESSAGE)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe("ManualEntry — location and freezer fields", () => {
  it("test_manualEntry_defaultLocationIsActiveLocation", async () => {
    localStorage.setItem("activeLocation", "freezer");
    recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    expect(screen.getByRole("radio", { name: "Congelador" })).toBeChecked();
    expect(screen.getByLabelText("Fecha de congelación")).toHaveValue(localIsoDate());
  });

  it("test_manualEntry_pantryLocation_hidesFreezerFields", async () => {
    recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    expect(screen.queryByLabelText("Fecha de congelación")).not.toBeInTheDocument();
  });

  it("test_manualEntry_freezerSave_postsDrawerAndFrozenDate", async () => {
    const calls = recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    fireEvent.click(screen.getByRole("radio", { name: "Congelador" }));
    fireEvent.click(screen.getByRole("tab", { name: "2" }));
    submitWithName();
    await waitFor(() =>
      expect(calls.at(-1)?.body).toMatchObject({ location: "freezer", drawer: 2, frozen_at: localIsoDate() }),
    );
    await screen.findByText("PANTRY_SCREEN");
    expect(localStorage.getItem("activeLocation")).toBe("freezer");
  });

  it("test_manualEntry_pantrySave_doesNotPostFreezerFields", async () => {
    const calls = recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    submitWithName();
    await waitFor(() => expect(calls.at(-1)?.body).toMatchObject({ location: "pantry" }));
    expect(calls.at(-1)?.body).not.toHaveProperty("drawer");
    expect(calls.at(-1)?.body).not.toHaveProperty("frozen_at");
  });
});

describe("ManualEntry — saving", () => {
  it("test_manualEntry_success_postsProductThenInventoryAndGoesToPantry", async () => {
    const calls = recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    submitWithName();
    expect(await screen.findByText("PANTRY_SCREEN")).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toEqual(["products", "inventory"]);
  });

  it("test_manualEntry_retryAfterInventoryFailure_doesNotPostProductAgain", async () => {
    const calls = recordSaves({ inventoryStatus: 500 });
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    submitWithName();
    expect(await screen.findByText(SAVE_ERROR_MESSAGE)).toBeInTheDocument();
    server.resetHandlers();
    recordSavesAgain(calls);
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(await screen.findByText("PANTRY_SCREEN")).toBeInTheDocument();
    expect(calls.filter((call) => call.path === "products")).toHaveLength(1);
  });

  it("test_manualEntry_productAlreadyExists_continuesToInventory", async () => {
    const calls = recordSaves({ productStatus: 409 });
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    submitWithName();
    expect(await screen.findByText("PANTRY_SCREEN")).toBeInTheDocument();
    expect(calls.map((call) => call.path)).toEqual(["products", "inventory"]);
  });

  it("test_manualEntry_inventoryAlreadyTracked_showsConflictMessage", async () => {
    recordSaves({ inventoryStatus: 409 });
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    submitWithName();
    expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("PANTRY_SCREEN")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Aceite");
  });
});

/**
 * Replaces the failing inventory endpoint with a working one, keeping the earlier recordings.
 *
 * @param calls - The list that receives the new requests.
 */
function recordSavesAgain(calls: Array<{ path: string; body: Record<string, unknown> }>) {
  server.use(
    http.post("/api/products", async ({ request }) => {
      calls.push({ path: "products", body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({}, { status: 201 });
    }),
    http.post("/api/inventory", async ({ request }) => {
      calls.push({ path: "inventory", body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({}, { status: 201 });
    }),
  );
}

describe("ManualEntry — scanned code", () => {
  it("test_manualEntry_routeEan_isPrefilledAndReadOnly", () => {
    recordSaves();
    renderInApp(manualRoutes(), [`/scan/${EAN}/manual`]);
    const field = screen.getByLabelText("EAN");
    expect(field).toHaveValue(EAN);
    expect(field).toHaveAttribute("readonly");
  });
});

describe("returnDestination", () => {
  it("test_returnDestination_noState_returnsThePantry", () => {
    expect(returnDestination(null)).toBe("/despensa");
    expect(returnDestination(undefined)).toBe("/despensa");
  });

  it("test_returnDestination_internalPath_isHonoured", () => {
    expect(returnDestination({ returnTo: "/scan/revisar" })).toBe("/scan/revisar");
  });

  it.each(["https://evil.example", "//evil.example", "scan/revisar", 42, null])(
    "test_returnDestination_unsafeValue_%s_returnsThePantry",
    (returnTo) => {
      expect(returnDestination({ returnTo })).toBe("/despensa");
    },
  );
});
