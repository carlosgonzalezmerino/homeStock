import { describe, it, expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@/theme";
import { renderInApp } from "@/test/helpers";
import { installFakeBackend } from "@/test/fakeBackend";
import { EAN, productFixture } from "@/test/fixtures";
import { localIsoDate } from "@/utils/date";
import { AppRoutes } from "./AppRoutes";

/**
 * Renders the whole route table, as the app does, starting at a path.
 *
 * @param entries - The history to start with.
 * @param index - Which entry is the current one.
 */
function renderApp(entries: string[], index?: number) {
  return renderInApp(
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>,
    entries,
    index,
  );
}

/** Types an EAN in the scan screen and searches for it. */
function searchEan(ean: string) {
  fireEvent.change(screen.getByLabelText("Código EAN"), { target: { value: ean } });
  fireEvent.submit(screen.getByRole("form", { name: "Introducir EAN manual" }));
}

describe("Flow — scanning", () => {
  it("test_flow_scanKnownProduct_addsStockAndReturnsToScannerWithCameraOff", async () => {
    const backend = installFakeBackend({ products: [productFixture()] });
    renderApp(["/scan"]);
    searchEan(EAN);
    fireEvent.click(await screen.findByRole("button", { name: "Añadir a Despensa" }));
    expect(await screen.findByText("✓ Producto añadido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar cámara" })).toBeInTheDocument();
    expect(backend.received.inventoryPosts).toHaveLength(1);
  });

  it("test_flow_scanUnknownProduct_createdByHandShowsUpInTheList", async () => {
    installFakeBackend();
    renderApp(["/scan"]);
    searchEan("5000112637922");
    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "Pasta fresca" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));
    expect(await screen.findByText("✓ Producto añadido")).toBeInTheDocument();
    expect(await screen.findByText("Pasta fresca")).toBeInTheDocument();
  });

  it("test_flow_scanTrackedProduct_sumsToTheExistingQuantity", async () => {
    const backend = installFakeBackend({
      products: [productFixture()],
      rows: [{ id: 1, ean: EAN, quantity: 2, threshold: 1, unit: "units", location: "pantry" }],
    });
    renderApp(["/scan"]);
    searchEan(EAN);
    expect(await screen.findByText(/Ya existe: 2 units en Despensa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sumar 1" }));
    await waitFor(() => expect(backend.rows[0].quantity).toBe(3));
  });
});

describe("Flow — the chosen location follows the user", () => {
  it("test_flow_freezerTabChosenInPantry_isPreselectedWhenAddingFromTheScanner", async () => {
    installFakeBackend({ products: [productFixture()] });
    renderApp(["/despensa"]);
    fireEvent.click(await screen.findByRole("tab", { name: "Congelador" }));
    fireEvent.click(screen.getByRole("link", { name: /Escanear/ }));
    searchEan(EAN);
    expect(await screen.findByRole("button", { name: "Añadir a Congelador" })).toBeInTheDocument();
  });

  it("test_flow_customProductSavedInFreezer_appearsInTheFreezerTab", async () => {
    const backend = installFakeBackend();
    renderApp(["/custom-entry"]);
    fireEvent.click(await screen.findByRole("button", { name: "Crear nuevo" }));
    fireEvent.change(screen.getByLabelText("nombre"), { target: { value: "Albóndigas" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("tab", { name: "Congelador", selected: true })).toBeInTheDocument();
    expect(await screen.findByText("Albóndigas")).toBeInTheDocument();
    expect(backend.received.inventoryPosts[0]).toMatchObject({ location: "freezer", frozen_at: localIsoDate() });
  });
});

describe("Flow — managing stock from the dashboard", () => {
  it("test_flow_alertOpened_updatedAndBackOnTheDashboard", async () => {
    const backend = installFakeBackend({
      products: [productFixture({ name: "Aceite" })],
      rows: [{ id: 1, ean: EAN, quantity: 1, threshold: 3, unit: "units", location: "pantry" }],
    });
    renderApp(["/"]);
    fireEvent.click(await screen.findByText("Aceite"));
    fireEvent.click((await screen.findAllByRole("button", { name: "＋" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar cantidad" }));
    expect(await screen.findByText("Alertas de Stock")).toBeInTheDocument();
    expect(backend.rows[0].quantity).toBe(2);
  });

  it("test_flow_stockRaisedAboveThreshold_leavesTheAlertsList", async () => {
    installFakeBackend({
      products: [productFixture({ name: "Aceite" })],
      rows: [{ id: 1, ean: EAN, quantity: 1, threshold: 2, unit: "units", location: "pantry" }],
    });
    renderApp(["/"]);
    fireEvent.click(await screen.findByText("Aceite"));
    fireEvent.click((await screen.findAllByRole("button", { name: "＋" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar cantidad" }));
    expect(await screen.findByText(/Sin alertas de stock/)).toBeInTheDocument();
  });
});
