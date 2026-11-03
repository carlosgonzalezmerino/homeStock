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
import { Scan } from "@/screens/Scan";
import { extractEan } from "@/utils/ean";
import { Settings } from "@/screens/Settings";

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

  it("test_pantryStepper_plusClick_savesTheQuantityWithoutOpeningTheDetail", async () => {
    let saved: Record<string, unknown> | undefined;
    server.use(
      http.patch("/api/inventory/1234567890123", async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({});
      }),
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
    await waitFor(() => expect(saved).toEqual({ quantity: 6 }));
    expect(screen.queryByText("ProductDetail")).not.toBeInTheDocument();
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

