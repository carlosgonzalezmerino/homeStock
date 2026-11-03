import { describe, it, expect } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { ThemeProvider } from "@/theme";
import { renderInApp } from "@/test/helpers";
import { installFakeBackend } from "@/test/fakeBackend";
import { EAN, productFixture } from "@/test/fixtures";
import { AppRoutes } from "./AppRoutes";

/**
 * Renders the app at a path with a fake backend that knows one tracked product.
 *
 * @param path - The path to open.
 */
function renderAt(path: string) {
  installFakeBackend({
    products: [productFixture()],
    rows: [{ id: 1, ean: EAN, quantity: 2, threshold: 1, unit: "units", location: "freezer", drawer: 1, frozen_at: "2026-10-01" }],
  });
  renderInApp(
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>,
    [path],
  );
}

/** Checks that every text field on screen can be found by a screen reader. */
function expectEveryFieldToHaveAName() {
  const fields = [...screen.queryAllByRole("textbox"), ...screen.queryAllByRole("searchbox")];
  expect(fields.length).toBeGreaterThan(0);
  fields.forEach((field) => expect(field).toHaveAccessibleName());
}

describe("Form accessibility — every field has an accessible name", () => {
  it("test_a11y_manualEntryForm_everyTextFieldHasAName", async () => {
    renderAt("/scan/5000112637922/manual");
    await screen.findByRole("form", { name: "Nuevo producto" });
    expectEveryFieldToHaveAName();
  });

  it("test_a11y_customEntryForm_everyTextFieldHasAName", async () => {
    renderAt("/custom-entry");
    fireEvent.click(await screen.findByRole("button", { name: "Crear nuevo" }));
    await screen.findByRole("form");
    expectEveryFieldToHaveAName();
  });

  it("test_a11y_manageDetail_everyTextFieldHasAName", async () => {
    renderAt(`/despensa/${EAN}`);
    await screen.findByRole("button", { name: "Actualizar cantidad" });
    expectEveryFieldToHaveAName();
    expect(screen.getByLabelText("Fecha de congelación")).toBeInTheDocument();
  });

  it("test_a11y_scanScreen_manualEanFieldHasAName", async () => {
    renderAt("/scan");
    expect(await screen.findByLabelText("Código EAN")).toBeInTheDocument();
    expectEveryFieldToHaveAName();
  });

  it("test_a11y_iconOnlyControls_haveAnAccessibleName", async () => {
    renderAt(`/despensa/${EAN}`);
    await screen.findByRole("button", { name: "Actualizar cantidad" });
    screen.getAllByRole("button", { name: "−" }).forEach((button) => expect(button).toHaveAccessibleName());
    expect(screen.getAllByRole("button", { name: "＋" }).length).toBeGreaterThan(0);
  });
});
