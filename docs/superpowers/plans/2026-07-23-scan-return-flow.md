# Scan Return Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After adding or updating a product, navigate back to `/scan` with a 1-second success toast and the camera auto-activating.

**Architecture:** Three files change. `ProductDetail` and `ManualEntry` replace their post-save `navigate('/despensa')` with `navigate('/scan', { state: { added: true }, replace: true })`. `Scan` reads `location.state.added` on mount, auto-starts the camera, shows a toast, and clears the state after 1 second.

**Tech Stack:** React 18, React Router v6, Vitest + Testing Library, TypeScript

## Global Constraints

- Spanish UI copy — all user-facing strings in Spanish
- Existing design tokens only (`bg-secondary-container`, `text-on-secondary-container`, etc.)
- No new dependencies
- `replace: true` on all navigations to `/scan` to keep the history stack clean
- Delete navigation (`handleDelete` in `ProductDetail`) remains `navigate('/despensa')` — unchanged

---

### Task 1: Update `ProductDetail` post-save navigation

**Files:**
- Modify: `frontend/src/screens/ProductDetail.tsx:85-97`
- Test: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Produces: after `handleUpdate` succeeds, `navigate('/scan', { state: { added: true }, replace: true })` is called

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe("ProductDetail", ...)` block in `screens.test.tsx`, after the existing tests:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run --reporter=verbose src/screens/screens.test.tsx 2>&1 | grep -A 5 "navigates to /scan with added state after adding"
```

Expected: FAIL — test lands on `/despensa` (no `ScanScreen` route), never finds `ScanScreen`.

- [ ] **Step 3: Update `handleUpdate` in `ProductDetail.tsx`**

Replace the two `navigate(backPath)` calls inside `handleUpdate` (lines ~89 and ~94) with `navigate('/scan', { state: { added: true }, replace: true })`. Leave `handleDelete` unchanged.

Before:
```ts
function handleUpdate() {
  if (tracked) {
    patch.mutate(
      { ean, body: { quantity: currentQty } },
      { onSuccess: () => navigate(backPath) }
    );
  } else {
    add.mutate(
      { ean, quantity: currentQty, threshold: 2, unit: "units" },
      { onSuccess: () => navigate(backPath) }
    );
  }
}
```

After:
```ts
function handleUpdate() {
  if (tracked) {
    patch.mutate(
      { ean, body: { quantity: currentQty } },
      { onSuccess: () => navigate("/scan", { state: { added: true }, replace: true }) }
    );
  } else {
    add.mutate(
      { ean, quantity: currentQty, threshold: 2, unit: "units" },
      { onSuccess: () => navigate("/scan", { state: { added: true }, replace: true }) }
    );
  }
}
```

Also remove the now-unused `backPath` and `fromDespensa` variables (lines ~55-56):

```ts
// Remove these two lines:
const fromDespensa = location.pathname.startsWith("/despensa");
const backPath = fromDespensa ? "/despensa" : "/despensa";
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run --reporter=verbose src/screens/screens.test.tsx 2>&1 | grep -E "PASS|FAIL|navigates to /scan with added"
```

Expected: PASS

- [ ] **Step 5: Confirm existing `handleDelete` test still passes**

```bash
cd frontend && npx vitest run --reporter=verbose src/screens/screens.test.tsx 2>&1 | grep -E "PASS|FAIL|DELETE"
```

Expected: PASS — delete still navigates to `/despensa`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/ProductDetail.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: navigate to /scan after product add/update in ProductDetail"
```

---

### Task 2: Update `ManualEntry` post-save navigation

**Files:**
- Modify: `frontend/src/screens/ManualEntry.tsx:40`
- Test: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Produces: after `onSubmit` succeeds, `navigate('/scan', { state: { added: true }, replace: true })` is called

- [ ] **Step 1: Update the existing ManualEntry navigation test**

In `screens.test.tsx`, find the `describe("ManualEntry", ...)` block, test `"calls POST /products then POST /inventory on submit"`. It currently:
1. Declares a `/despensa` route stub (`<div>Pantry</div>`)
2. Ends with `await screen.findByText("Pantry")`

Update it to expect `/scan` instead:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run --reporter=verbose src/screens/screens.test.tsx 2>&1 | grep -A 5 "calls POST /products"
```

Expected: FAIL — lands on the old `/despensa` which has no route, never finds `ScanScreen`.

- [ ] **Step 3: Update `onSubmit` in `ManualEntry.tsx`**

Replace line ~40:

Before:
```ts
navigate("/despensa");
```

After:
```ts
navigate("/scan", { state: { added: true }, replace: true });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run --reporter=verbose src/screens/screens.test.tsx 2>&1 | grep -E "PASS|FAIL|calls POST /products"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/ManualEntry.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: navigate to /scan after manual product save"
```

---

### Task 3: Auto-start camera and show toast in `Scan` on return

**Files:**
- Modify: `frontend/src/screens/Scan.tsx`
- Test: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Consumes: `location.state.added` (boolean | undefined) from React Router `useLocation`
- `scanner.start()` from `useScanner` hook (already available in the component)

- [ ] **Step 1: Write the failing tests**

Add these two tests inside `describe("Scan", ...)` in `screens.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run --reporter=verbose src/screens/screens.test.tsx 2>&1 | grep -E "PASS|FAIL|toast|success toast"
```

Expected: both FAIL — toast element does not exist yet.

- [ ] **Step 3: Update `Scan.tsx`**

Replace the entire `Scan.tsx` with the following (all existing functionality preserved):

```tsx
import { useRef, useState, useCallback, useEffect, type RefObject } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useScanner } from "@/hooks";
import { get, ApiError } from "@/api/client";
import type { ProductOut } from "@/types";

export function Scan() {
  const navigate = useNavigate();
  const location = useLocation();
  const [manualEan, setManualEan] = useState("");
  const [showAddedToast, setShowAddedToast] = useState(false);
  const resolving = useRef(false);

  const handleDetect = useCallback(
    async (ean: string) => {
      if (resolving.current) return;
      resolving.current = true;
      scanner.stop();
      await resolveAndNavigate(ean, navigate);
      resolving.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate]
  );

  const scanner = useScanner(handleDetect);

  // Auto-start camera and show toast when returning from a successful add
  useEffect(() => {
    if (location.state?.added) {
      setShowAddedToast(true);
      scanner.start();
      // Clear the state so the toast doesn't reappear on back navigation
      navigate(".", { state: {}, replace: true });
      const timer = setTimeout(() => setShowAddedToast(false), 1000);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop camera on unmount
  useEffect(() => () => scanner.stop(), []);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ean = manualEan.trim();
    if (!ean) return;
    scanner.stop();
    await resolveAndNavigate(ean, navigate);
  }

  const isScanning = scanner.state === "scanning";
  const isStarting = scanner.state === "starting";
  const hasError = scanner.state === "error" || !!scanner.error;

  return (
    <div className="flex flex-col items-center gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Escanear producto</h1>

      {/* Success toast */}
      {showAddedToast && (
        <div
          role="status"
          className="w-full max-w-sm rounded-lg bg-secondary-container px-4 py-3 text-body-md text-on-secondary-container text-center"
        >
          ✓ Producto añadido
        </div>
      )}

      {/* Camera viewfinder */}
      <div className="relative w-full max-w-sm">
        <video
          ref={scanner.ref as RefObject<HTMLVideoElement>}
          muted
          playsInline
          className={`w-full rounded-lg bg-surface-container transition-opacity ${isScanning ? "opacity-100" : "opacity-0 h-0"}`}
        />

        {/* Aim overlay */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-64 rounded-md border-2 border-primary opacity-70" />
          </div>
        )}
      </div>

      {/* State messages */}
      {!isScanning && !hasError && (
        <p className="text-body-sm text-on-surface-variant text-center">
          {isStarting ? "Iniciando cámara…" : "Pulsa el botón para activar la cámara"}
        </p>
      )}
      {isScanning && (
        <p className="text-body-sm text-on-surface-variant text-center">
          Apunta al código de barras
        </p>
      )}
      {hasError && (
        <p className="text-body-sm text-error text-center">
          {scanner.error ?? "Cámara no disponible"}
        </p>
      )}

      {/* Primary action button */}
      {!isScanning && !isStarting && (
        <button
          onClick={() => scanner.start()}
          className="rounded-full bg-primary px-8 py-4 text-label-lg font-semibold text-on-primary"
        >
          Activar cámara
        </button>
      )}

      {/* Debug panel — remove once scanner works reliably */}
      {scanner.debugInfo.length > 0 && (
        <div className="w-full max-w-sm rounded-lg bg-surface-container p-3 font-mono text-xs text-on-surface-variant space-y-0.5">
          {scanner.debugInfo.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="flex w-full max-w-sm items-center gap-3">
        <hr className="flex-1 border-outline-variant" />
        <span className="text-label-md text-on-surface-variant">o introduce manualmente</span>
        <hr className="flex-1 border-outline-variant" />
      </div>

      {/* Manual input */}
      <form
        role="form"
        onSubmit={handleManualSubmit}
        className="flex w-full max-w-sm gap-2"
        aria-label="Introduir EAN manual"
      >
        <input
          type="text"
          value={manualEan}
          onChange={(e) => setManualEan(e.target.value)}
          placeholder="Código EAN"
          className="flex-1 rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="rounded-full bg-primary-container px-6 py-3 text-label-md text-on-primary-container"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}

async function resolveAndNavigate(ean: string, navigate: ReturnType<typeof useNavigate>) {
  try {
    await get<ProductOut>(`/resolve/${ean}`);
    navigate(`/scan/${ean}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      navigate(`/scan/${ean}/manual`);
    }
  }
}
```

- [ ] **Step 4: Run all Scan tests to verify they pass**

```bash
cd frontend && npx vitest run --reporter=verbose src/screens/screens.test.tsx 2>&1 | grep -A 2 "Scan"
```

Expected: all 4 Scan tests PASS (2 existing + 2 new).

- [ ] **Step 5: Run the full test suite**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/Scan.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: auto-start camera and show success toast on return to Scan"
```
