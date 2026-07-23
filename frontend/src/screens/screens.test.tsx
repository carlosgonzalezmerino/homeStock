import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import type { ReactNode } from "react";

// Hoisted mocks — must be before any screen imports
vi.mock("@/hooks/useScanner", () => ({
  useScanner: (_onDetect: (ean: string) => void) => ({
    ref: { current: null },
    error: "Camera not available in test",
  }),
}));

vi.mock("@/theme", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { Dashboard } from "@/screens/Dashboard";
import { Pantry } from "@/screens/Pantry";
import { ProductDetail } from "@/screens/ProductDetail";
import { Scan } from "@/screens/Scan";
import { ManualEntry } from "@/screens/ManualEntry";
import { Settings } from "@/screens/Settings";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrap(ui: React.ReactElement, { path = "/", initialEntries = ["/"] } = {}) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const inventoryFull = [
  {
    inventory: { id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units" },
    product: { ean: "1234567890123", name: "Leche Entera", brand: "Hacendado", category: "Lácteos", source: "off" },
    low: false,
  },
];

const inventoryLow = [
  {
    inventory: { id: 2, ean: "9999999999999", quantity: 1, threshold: 2, unit: "units" },
    product: { ean: "9999999999999", name: "Aceite Oliva", brand: "Carbonell", category: "Aceites", source: "off" },
    low: true,
  },
];

const inventoryMixed = [...inventoryFull, ...inventoryLow];

// ─── Dashboard ──────────────────────────────────────────────────────────────

describe("Dashboard", () => {
  it("shows low-stock carousel items", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Dashboard />);
    await screen.findByText("Alertas de Stock");
    expect(screen.getByText("Aceite Oliva")).toBeInTheDocument();
    expect(screen.queryByText("Leche Entera")).not.toBeInTheDocument();
  });

  it("shows EmptyState when no low-stock items", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull))
    );
    wrap(<Dashboard />);
    await screen.findByText(/sin alertas/i);
  });

  it("shows Spinner while loading", () => {
    server.use(
      http.get("/api/inventory", async () => {
        await new Promise(() => {}); // never resolves
      })
    );
    wrap(<Dashboard />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ─── Pantry ─────────────────────────────────────────────────────────────────

describe("Pantry", () => {
  it("renders inventory items", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Pantry />);
    await screen.findByText("Leche Entera");
    expect(screen.getByText("Aceite Oliva")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Pantry />);
    await screen.findByText("Leche Entera");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Aceite" } });
    expect(screen.getByText("Aceite Oliva")).toBeInTheDocument();
    expect(screen.queryByText("Leche Entera")).not.toBeInTheDocument();
  });

  it("filters by category chip", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Pantry />);
    await screen.findByRole("button", { name: "Lácteos" });
    fireEvent.click(screen.getByRole("button", { name: "Lácteos" }));
    expect(screen.getByText("Leche Entera")).toBeInTheDocument();
    expect(screen.queryByText("Aceite Oliva")).not.toBeInTheDocument();
  });

  it("shows EmptyState when pantry is empty", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json([]))
    );
    wrap(<Pantry />);
    await screen.findByText(/despensa está vacía/i);
  });

  it("clicking a row navigates to /despensa/:ean", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/despensa"]}>
          <Routes>
            <Route path="/despensa" element={<Pantry />} />
            <Route path="/despensa/:ean" element={<div>ProductDetail</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const row = await screen.findByRole("button", { name: /leche entera/i });
    fireEvent.click(row);
    await screen.findByText("ProductDetail");
  });
});

// ─── ProductDetail ──────────────────────────────────────────────────────────

describe("ProductDetail", () => {
  const ean = "1234567890123";

  it("pre-fills stepper with current quantity for tracked item", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Actualizar cantidad")).toBeInTheDocument();
  });

  it("starts stepper at 1 for untracked item", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json([]))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Añadir a mi despensa")).toBeInTheDocument();
  });

  it("PATCH when tracked item reaches 0", async () => {
    let patchCalled = false;
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull)),
      http.patch(`/api/inventory/${ean}`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        if (body.quantity === 0) patchCalled = true;
        return HttpResponse.json({ id: 1, ean, quantity: 0, threshold: 2, unit: "units" });
      }),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    // Target the quantity card's − button (first stepper)
    const qtyCard = screen.getByText("Cantidad actual").closest("div")!;
    const minus = qtyCard.querySelector("button[aria-label='−']") as HTMLElement;
    for (let i = 0; i < 5; i++) fireEvent.click(minus);
    expect(screen.getByText("0")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Actualizar cantidad"));
    await waitFor(() => expect(patchCalled).toBe(true));
  });

  it("shows macros when product has nutrition data", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({
          ean, name: "Leche Entera", source: "off",
          kcal_per_100g: 65, proteins_per_100g: 3.2, carbs_per_100g: 4.8,
          fat_per_100g: 3.6, sugars_per_100g: 4.7,
        })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.getByText("Calorías")).toBeInTheDocument();
    expect(screen.getByText("65.0 kcal")).toBeInTheDocument();
    expect(screen.getByText("Proteínas")).toBeInTheDocument();
    expect(screen.getByText("3.2 g")).toBeInTheDocument();
  });

  it("hides macros section when product has no nutrition data", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.queryByText("Calorías")).not.toBeInTheDocument();
    expect(screen.queryByText(/nutricional/i)).not.toBeInTheDocument();
  });

  it("shows threshold card for tracked item and PATCHes on save", async () => {
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull)),
      http.patch(`/api/inventory/${ean}`, async ({ request }) => {
        patchBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ean, quantity: 5, threshold: patchBody.threshold as number, unit: "units" });
      }),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Umbral de alerta");
    // Guardar disabled until changed
    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    expect(saveBtn).toBeDisabled();
    // Increment threshold — find the ＋ button inside the threshold card section
    const thresholdSection = screen.getByText("Umbral de alerta").closest("div")!;
    const plus = thresholdSection.querySelector("button[aria-label='＋']") as HTMLElement;
    fireEvent.click(plus);
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    await waitFor(() => expect(patchBody).toMatchObject({ threshold: 3 }));
  });

  it("hides threshold card for untracked item", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json([]))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.queryByText("Umbral de alerta")).not.toBeInTheDocument();
  });

  it("DELETE when 'Quitar de la despensa' is clicked", async () => {
    let deleteCalled = false;
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull)),
      http.delete(`/api/inventory/${ean}`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Quitar de la despensa");
    fireEvent.click(screen.getByText("Quitar de la despensa"));
    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});

// ─── Scan ───────────────────────────────────────────────────────────────────

describe("Scan", () => {
  it("shows manual input when scanner errors", () => {
    wrap(<Scan />, { path: "/scan", initialEntries: ["/scan"] });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("navigates to /scan/:ean on 200 from resolve", async () => {
    const ean = "5000112637922";
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Pasta Fusilli", source: "off" })
      )
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/scan"]}>
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/:ean" element={<div>ProductDetail</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: ean } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("ProductDetail");
  });

  it("navigates to /scan/:ean/manual on 404 from resolve", async () => {
    const ean = "0000000000000";
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean }, { status: 404 })
      )
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/scan"]}>
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/:ean/manual" element={<div>ManualEntry</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: ean } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("ManualEntry");
  });
});

// ─── ManualEntry ─────────────────────────────────────────────────────────────

describe("ManualEntry", () => {
  it("pre-fills ean from URL param", () => {
    const ean = "1111111111111";
    wrap(<ManualEntry />, {
      path: "/scan/:ean/manual",
      initialEntries: [`/scan/${ean}/manual`],
    });
    expect(screen.getByDisplayValue(ean)).toBeInTheDocument();
  });

  it("calls POST /products then POST /inventory on submit", async () => {
    const ean = "2222222222222";
    let productsCalled = false;
    let inventoryCalled = false;
    server.use(
      http.post("/api/products", async () => {
        productsCalled = true;
        return HttpResponse.json({ ean, name: "Producto Manual", source: "manual" }, { status: 201 });
      }),
      http.post("/api/inventory", async () => {
        inventoryCalled = true;
        return HttpResponse.json({ id: 99, ean, quantity: 1, threshold: 1, unit: "units" }, { status: 201 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={[`/scan/${ean}/manual`]}>
          <Routes>
            <Route path="/scan/:ean/manual" element={<ManualEntry />} />
            <Route path="/despensa" element={<div>Pantry</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Producto Manual" } });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(productsCalled).toBe(true));
    await waitFor(() => expect(inventoryCalled).toBe(true));
    await screen.findByText("Pantry");
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

describe("Settings", () => {
  it("renders theme toggle button", () => {
    wrap(<Settings />);
    expect(screen.getByRole("button", { name: /tema/i })).toBeInTheDocument();
  });
});
