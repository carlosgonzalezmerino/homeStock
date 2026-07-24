import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import type { ReactNode } from "react";

// Hoisted mocks — must be before any screen imports
vi.mock("@/hooks/useScanner", () => ({
  useScanner: () => ({
    ref: { current: null },
    state: "error" as const,
    error: "Camera not available in test",
    hasBarcodeDetector: false,
    debugInfo: [],
    start: vi.fn(),
    stop: vi.fn(),
    detect: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/theme", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import { Dashboard } from "@/screens/Dashboard";
import { Pantry } from "@/screens/Pantry";
import { ProductDetail } from "@/screens/ProductDetail";
import { Scan, extractEan } from "@/screens/Scan";
import { ManualEntry } from "@/screens/ManualEntry";
import { Settings } from "@/screens/Settings";
import { CustomEntry } from "@/screens/CustomEntry";

describe("extractEan", () => {
  it("extracts EAN-13 from a real Mercadona GS1 QR URL", () => {
    const url = "https://qrtrack.mercadona.es/01/08402001005220/10/561969AR?17=260721&16=260718";
    expect(extractEan(url)).toBe("8402001005220");
  });

  it("returns a plain EAN string unchanged", () => {
    expect(extractEan("8410376003139")).toBe("8410376003139");
  });

  it("returns an unrecognised URL unchanged", () => {
    expect(extractEan("https://example.com/product/123")).toBe("https://example.com/product/123");
  });

  it("strips leading 0 from GTIN-14 to get EAN-13", () => {
    const url = "https://qrtrack.mercadona.es/01/08410376003139/10/ABC";
    expect(extractEan(url)).toBe("8410376003139");
  });
});

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
    // Two buttons match /leche entera/i: thumbnail and identity. Click the first.
    const rows = await screen.findAllByRole("button", { name: /leche entera/i });
    fireEvent.click(rows[0]);
    await screen.findByText("ProductDetail");
  });

  it("shows product thumbnail when image_url is present", async () => {
    server.use(
      http.get("/api/inventory", () =>
        HttpResponse.json([{
          inventory: { id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units" },
          product: { ean: "1234567890123", name: "Leche Entera", brand: "Hacendado", image_url: "https://example.com/leche.jpg" },
          low: false,
        }])
      )
    );
    wrap(<Pantry />);
    const img = await screen.findByRole("img", { name: /leche entera/i });
    expect(img).toHaveAttribute("src", "https://example.com/leche.jpg");
  });

  it("shows placeholder when image_url is missing", async () => {
    server.use(
      http.get("/api/inventory", () =>
        HttpResponse.json([{
          inventory: { id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units" },
          product: { ean: "1234567890123", name: "Leche Entera", brand: "Hacendado" },
          low: false,
        }])
      )
    );
    wrap(<Pantry />);
    await screen.findByText("Leche Entera");
    expect(screen.queryByRole("img", { name: /leche entera/i })).not.toBeInTheDocument();
    // placeholder icon rendered
    expect(document.querySelector("[data-testid='img-placeholder']")).toBeInTheDocument();
  });

  it("inline stepper PATCHes quantity optimistically", async () => {
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.get("/api/inventory", () =>
        HttpResponse.json([{
          inventory: { id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units" },
          product: { ean: "1234567890123", name: "Leche Entera", brand: "Hacendado" },
          low: false,
        }])
      ),
      http.patch("/api/inventory/1234567890123", async ({ request }) => {
        patchBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ean: "1234567890123", quantity: 6, threshold: 2, unit: "units" });
      }),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    wrap(<Pantry />);
    await screen.findByText("Leche Entera");
    // El stepper lg muestra "5" — pulsar ＋
    const plusButtons = screen.getAllByRole("button", { name: "＋" });
    fireEvent.click(plusButtons[0]);
    // Optimistic: valor local sube a 6 inmediatamente
    await screen.findByText("6");
    // PATCH enviado al servidor
    await waitFor(() => expect(patchBody).toMatchObject({ quantity: 6 }));
  });

  it("stepper click does not navigate to ProductDetail", async () => {
    server.use(
      http.get("/api/inventory", () =>
        HttpResponse.json([{
          inventory: { id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units" },
          product: { ean: "1234567890123", name: "Leche Entera" },
          low: false,
        }])
      )
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
    await screen.findByText("Leche Entera");
    const plusButtons = screen.getAllByRole("button", { name: "＋" });
    fireEvent.click(plusButtons[0]);
    expect(screen.queryByText("ProductDetail")).not.toBeInTheDocument();
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

  it("navigates to /scan with added state after adding untracked item", async () => {
    const ean = "1234567890123";
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.post("/api/inventory", () =>
        HttpResponse.json({ id: 1, ean, quantity: 1, threshold: 2, unit: "units" }, { status: 201 })
      ),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={[`/scan/${ean}`]}>
          <Routes>
            <Route path="/scan/:ean" element={<ProductDetail />} />
            <Route path="/scan" element={<div>ScanScreen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await screen.findByText("Añadir a mi despensa");
    fireEvent.click(screen.getByText("Añadir a mi despensa"));
    await screen.findByText("ScanScreen");
  });

  it("navigates to /scan with added state after updating tracked item", async () => {
    const ean = "1234567890123";
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull)),
      http.patch(`/api/inventory/${ean}`, () =>
        HttpResponse.json({ id: 1, ean, quantity: 5, threshold: 2, unit: "units" })
      ),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={[`/scan/${ean}`]}>
          <Routes>
            <Route path="/scan/:ean" element={<ProductDetail />} />
            <Route path="/scan" element={<div>ScanScreen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await screen.findByText("Actualizar cantidad");
    fireEvent.click(screen.getByText("Actualizar cantidad"));
    await screen.findByText("ScanScreen");
  });
});

// ─── ProductDetail — location ────────────────────────────────────────────────

describe("ProductDetail — location", () => {
  const ean = "1234567890123";

  it("shows location selector for tracked item", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () =>
        HttpResponse.json([{
          inventory: { id: 1, ean, quantity: 5, threshold: 2, unit: "units", location: "pantry" },
          product: { ean, name: "Leche Entera", source: "off" },
          low: false,
        }])
      )
    );
    wrap(<ProductDetail />, { path: "/despensa/:ean", initialEntries: [`/despensa/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.getByRole("radio", { name: /despensa/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /congelador/i })).toBeInTheDocument();
  });

  it("PATCHes location when selector changes", async () => {
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () =>
        HttpResponse.json([{
          inventory: { id: 1, ean, quantity: 5, threshold: 2, unit: "units", location: "pantry" },
          product: { ean, name: "Leche Entera", source: "off" },
          low: false,
        }])
      ),
      http.patch(`/api/inventory/${ean}`, async ({ request }) => {
        patchBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 1, ean, quantity: 5, threshold: 2, unit: "units", location: "freezer" });
      }),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    wrap(<ProductDetail />, { path: "/despensa/:ean", initialEntries: [`/despensa/${ean}`] });
    await screen.findByText("Leche Entera");
    fireEvent.click(screen.getByRole("radio", { name: /congelador/i }));
    await waitFor(() => expect(patchBody).toMatchObject({ location: "freezer" }));
  });

  it("does not show location selector for untracked item", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json([]))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.queryByRole("radio", { name: /despensa/i })).not.toBeInTheDocument();
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

  it("shows success toast when location.state.added is true", async () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={[{ pathname: "/scan", state: { added: true } }]}>
          <Routes>
            <Route path="/scan" element={<Scan />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByText("✓ Producto añadido")).toBeInTheDocument();
  });

  it("does not show success toast when location.state.added is absent", () => {
    wrap(<Scan />, { path: "/scan", initialEntries: ["/scan"] });
    expect(screen.queryByText("✓ Producto añadido")).not.toBeInTheDocument();
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
            <Route path="/scan" element={<div>ScanScreen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Producto Manual" } });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(productsCalled).toBe(true));
    await waitFor(() => expect(inventoryCalled).toBe(true));
    await screen.findByText("ScanScreen");
  });
});

// ─── Pantry — location tabs ──────────────────────────────────────────────────

describe("Pantry — location tabs", () => {
  const inventoryPantry = [
    {
      inventory: { id: 1, ean: "111", quantity: 3, threshold: 1, unit: "units", location: null },
      product: { ean: "111", name: "Leche", source: "manual" },
      low: false,
    },
  ];
  const inventoryFreezer = [
    {
      inventory: { id: 2, ean: "222", quantity: 2, threshold: 1, unit: "units", location: "freezer" },
      product: { ean: "222", name: "Pollo Congelado", source: "manual" },
      low: false,
    },
  ];
  const inventoryBoth = [...inventoryPantry, ...inventoryFreezer];

  it("shows Despensa tab active by default and filters pantry items", async () => {
    server.use(http.get("/api/inventory", () => HttpResponse.json(inventoryBoth)));
    wrap(<Pantry />);
    await screen.findByText("Leche");
    expect(screen.queryByText("Pollo Congelado")).not.toBeInTheDocument();
  });

  it("switching to Congelador tab shows freezer items only", async () => {
    server.use(http.get("/api/inventory", () => HttpResponse.json(inventoryBoth)));
    wrap(<Pantry />);
    await screen.findByText("Leche");
    fireEvent.click(screen.getByRole("tab", { name: /congelador/i }));
    await screen.findByText("Pollo Congelado");
    expect(screen.queryByText("Leche")).not.toBeInTheDocument();
  });

  it("shows freezer empty state when no freezer items", async () => {
    server.use(http.get("/api/inventory", () => HttpResponse.json(inventoryPantry)));
    wrap(<Pantry />);
    await screen.findByText("Leche");
    fireEvent.click(screen.getByRole("tab", { name: /congelador/i }));
    await screen.findByText(/congelador está vacío/i);
  });

  it("treats location=pantry same as location=null (despensa tab)", async () => {
    const explicit = [{
      inventory: { id: 3, ean: "333", quantity: 1, threshold: 1, unit: "units", location: "pantry" },
      product: { ean: "333", name: "Yogur", source: "manual" },
      low: false,
    }];
    server.use(http.get("/api/inventory", () => HttpResponse.json(explicit)));
    wrap(<Pantry />);
    await screen.findByText("Yogur");
    expect(screen.queryByText("Yogur")).toBeInTheDocument();
  });
});

describe("ManualEntry — location", () => {
  it("includes location=pantry in inventory POST by default", async () => {
    const ean = "3333333333333";
    let inventoryBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/products", async () =>
        HttpResponse.json({ ean, name: "Prod", source: "manual" }, { status: 201 })
      ),
      http.post("/api/inventory", async ({ request }) => {
        inventoryBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 10, ean, quantity: 1, threshold: 2, unit: "units" }, { status: 201 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={[`/scan/${ean}/manual`]}>
          <Routes>
            <Route path="/scan/:ean/manual" element={<ManualEntry />} />
            <Route path="/scan" element={<div>ScanScreen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Prod" } });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(inventoryBody).toMatchObject({ location: "pantry" }));
  });

  it("sends location=freezer when Congelador is selected", async () => {
    const ean = "4444444444444";
    let inventoryBody: Record<string, unknown> | null = null;
    server.use(
      http.post("/api/products", async () =>
        HttpResponse.json({ ean, name: "Prod", source: "manual" }, { status: 201 })
      ),
      http.post("/api/inventory", async ({ request }) => {
        inventoryBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 11, ean, quantity: 1, threshold: 2, unit: "units" }, { status: 201 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={[`/scan/${ean}/manual`]}>
          <Routes>
            <Route path="/scan/:ean/manual" element={<ManualEntry />} />
            <Route path="/scan" element={<div>ScanScreen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Prod" } });
    fireEvent.click(screen.getByRole("radio", { name: /congelador/i }));
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(inventoryBody).toMatchObject({ location: "freezer" }));
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

describe("Settings", () => {
  it("renders theme toggle button", () => {
    wrap(<Settings />);
    expect(screen.getByRole("button", { name: /tema/i })).toBeInTheDocument();
  });
});

// ─── Scan — custom entry button ─────────────────────────────────────────────

describe("Scan — custom entry button", () => {
  it("renders 'Añadir sin código' button", () => {
    wrap(<Scan />, { path: "/scan", initialEntries: ["/scan"] });
    expect(screen.getByRole("button", { name: /añadir sin código/i })).toBeInTheDocument();
  });

  it("navigates to /custom-entry on button click", async () => {
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/scan"]}>
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/custom-entry" element={<div>CustomEntry</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /añadir sin código/i }));
    await screen.findByText("CustomEntry");
  });
});

// ─── CustomEntry ─────────────────────────────────────────────────────────────

describe("CustomEntry", () => {
  it("renders search input on step 1", () => {
    wrap(<CustomEntry />, { path: "/custom-entry", initialEntries: ["/custom-entry"] });
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("shows search results from /api/products", async () => {
    server.use(
      http.get("/api/products", ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") ?? "";
        if (q === "po") {
          return HttpResponse.json([
            { ean: "111", name: "Pollo Asado", source: "manual" },
          ]);
        }
        return HttpResponse.json([]);
      })
    );
    wrap(<CustomEntry />, { path: "/custom-entry", initialEntries: ["/custom-entry"] });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "po" } });
    await screen.findByText("Pollo Asado");
  });

  it("selecting an existing product advances to step 2", async () => {
    server.use(
      http.get("/api/products", () =>
        HttpResponse.json([{ ean: "111", name: "Pollo Asado", source: "manual" }])
      )
    );
    wrap(<CustomEntry />, { path: "/custom-entry", initialEntries: ["/custom-entry"] });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "po" } });
    await screen.findByText("Pollo Asado");
    fireEvent.click(screen.getByText("Pollo Asado"));
    await screen.findByText(/cantidad/i);
  });

  it("'Crear nuevo' advances to step 2 with name field", () => {
    wrap(<CustomEntry />, { path: "/custom-entry", initialEntries: ["/custom-entry"] });
    fireEvent.click(screen.getByRole("button", { name: /crear nuevo/i }));
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("step 2 defaults to Congelador location", () => {
    wrap(<CustomEntry />, { path: "/custom-entry", initialEntries: ["/custom-entry"] });
    fireEvent.click(screen.getByRole("button", { name: /crear nuevo/i }));
    expect(screen.getByRole("radio", { name: /congelador/i })).toBeChecked();
  });

  it("submitting existing product POSTs to /api/inventory with location", async () => {
    let inventoryBody: Record<string, unknown> | null = null;
    server.use(
      http.get("/api/products", () =>
        HttpResponse.json([{ ean: "111", name: "Pollo Asado", source: "manual" }])
      ),
      http.post("/api/inventory", async ({ request }) => {
        inventoryBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ id: 5, ean: "111", quantity: 1, threshold: 1, unit: "units" }, { status: 201 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/custom-entry"]}>
          <Routes>
            <Route path="/custom-entry" element={<CustomEntry />} />
            <Route path="/despensa" element={<div>Pantry</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "po" } });
    await screen.findByText("Pollo Asado");
    fireEvent.click(screen.getByText("Pollo Asado"));
    await screen.findByText(/cantidad/i);
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(inventoryBody).toMatchObject({ ean: "111", location: "freezer" }));
  });

  it("submitting new product POSTs to /api/products then /api/inventory", async () => {
    let productsCalled = false;
    let inventoryCalled = false;
    server.use(
      http.post("/api/products", async () => {
        productsCalled = true;
        return HttpResponse.json({ ean: "CUSTOM-XXXXXXXX", name: "Albóndigas", source: "manual" }, { status: 201 });
      }),
      http.post("/api/inventory", async () => {
        inventoryCalled = true;
        return HttpResponse.json({ id: 6, ean: "CUSTOM-XXXXXXXX", quantity: 2, threshold: 1, unit: "tuppers" }, { status: 201 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([]))
    );
    render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter initialEntries={["/custom-entry"]}>
          <Routes>
            <Route path="/custom-entry" element={<CustomEntry />} />
            <Route path="/despensa" element={<div>Pantry</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /crear nuevo/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Albóndigas" } });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(productsCalled).toBe(true));
    await waitFor(() => expect(inventoryCalled).toBe(true));
  });
});
