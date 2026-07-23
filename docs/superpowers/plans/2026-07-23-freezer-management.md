# Freezer Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend homeStock so products can be tracked in the freezer (congelador) alongside the pantry, supporting both barcode-scanned products and custom items without a barcode.

**Architecture:** No schema changes — `InventoryItem.location` already exists. Convention: `null`/`"pantry"` = despensa, `"freezer"` = congelador. One new backend endpoint (`GET /api/products?q=`) for product search. Frontend gains: Pantry tabs, location selector in add/edit flows, and a new two-step `CustomEntry` screen for barcode-free items.

**Tech Stack:** FastAPI + SQLModel (backend), React 18 + Vite + TypeScript + TanStack Query v5 + React Router v6 + Tailwind CSS (frontend), Vitest + RTL + MSW (tests).

## Global Constraints

- `InventoryItem.location` stays `str | None` — no enum, no migration.
- `null` and `"pantry"` are both treated as despensa everywhere.
- Custom EANs generated in the frontend as `CUSTOM-` + 8 random alphanumeric chars (e.g., `CUSTOM-A3F7B2C1`).
- Backend: do not change any existing endpoint or model.
- Frontend: UI copy in Spanish. Code identifiers in English.
- Every `git add` MUST name files explicitly — never `git add -A` or `git add .` from repo root.
- Run backend tests with `uv run pytest -x` from repo root.
- Run frontend tests with `npm test -- --run` from `frontend/`.

---

## File Map

**Backend (new/modified):**
- Modify: `app/repositories/products.py` — add `search(q, limit)` method
- Modify: `app/api/products.py` — add `GET /api/products?q=` endpoint

**Frontend (new/modified):**
- Modify: `frontend/src/types.ts` — add `Location` type
- Modify: `frontend/src/api/products.ts` — add `searchProducts(q)`
- Modify: `frontend/src/hooks/queryKeys.ts` — add `products` key
- Modify: `frontend/src/hooks/useInventory.ts` → no change needed (already used)
- Create: `frontend/src/hooks/useSearchProducts.ts` — TanStack Query wrapper
- Modify: `frontend/src/hooks/index.ts` — export new hook
- Modify: `frontend/src/screens/Pantry.tsx` — add location tabs
- Modify: `frontend/src/screens/ManualEntry.tsx` — add location selector
- Modify: `frontend/src/screens/ProductDetail.tsx` — add location selector
- Modify: `frontend/src/screens/Scan.tsx` — add "Añadir sin código" button
- Create: `frontend/src/screens/CustomEntry.tsx` — two-step custom item flow
- Modify: `frontend/src/screens/index.ts` — export CustomEntry
- Modify: `frontend/src/App.tsx` — add `/custom-entry` route

**Tests:**
- Modify: `tests/test_products_search.py` (new file) — backend search endpoint tests
- Modify: `frontend/src/screens/screens.test.tsx` — extend existing tests + new CustomEntry tests

---

## Task 1: Backend — `ProductRepository.search`

**Files:**
- Modify: `app/repositories/products.py`
- Create: `tests/test_products_search.py`

**Interfaces:**
- Produces: `ProductRepository.search(q: str, limit: int = 20) -> list[Product]` — used by Task 2

- [ ] **Step 1: Create test file**

```python
# tests/test_products_search.py
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_products(client: TestClient, seed_product):
    seed_product(ean="111", name="Leche Entera", source="manual")
    seed_product(ean="222", name="Aceite de Oliva", source="manual")
    seed_product(ean="333", name="Pollo Fresco", source="manual")
    return client


def test_search_returns_matching_products(client_with_products):
    resp = client_with_products.get("/api/products?q=leche")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Leche Entera"


def test_search_is_case_insensitive(client_with_products):
    resp = client_with_products.get("/api/products?q=LECHE")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_search_partial_match(client_with_products):
    resp = client_with_products.get("/api/products?q=ace")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "Aceite de Oliva"


def test_search_empty_q_returns_empty(client_with_products):
    resp = client_with_products.get("/api/products?q=")
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_no_match_returns_empty(client_with_products):
    resp = client_with_products.get("/api/products?q=zzznomatch")
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_limit_respected(client, seed_product):
    for i in range(25):
        seed_product(ean=str(i).zfill(13), name=f"Producto {i}", source="manual")
    resp = client.get("/api/products?q=producto")
    assert resp.status_code == 200
    assert len(resp.json()) <= 20
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
uv run pytest tests/test_products_search.py -v
```
Expected: FAIL — endpoint does not exist yet.

- [ ] **Step 3: Add `search` method to `ProductRepository`**

In `app/repositories/products.py`, add after the `update_fields` method:

```python
def search(self, q: str, limit: int = 20) -> list[Product]:
    if not q:
        return []
    pattern = f"%{q}%"
    return list(
        self._session.exec(
            select(Product).where(
                (col(Product.name).ilike(pattern))
                | (col(Product.brand).ilike(pattern))
            ).limit(limit)
        ).all()
    )
```

Also add `col` to the sqlmodel import at the top:

```python
from sqlmodel import Session, col, select
```

- [ ] **Step 4: Add `GET /api/products` endpoint**

In `app/api/products.py`, add before the `/{ean}` routes:

```python
@router.get("", response_model=list[ProductOut])
def search_products(
    q: str = Query(default="", max_length=100),
    repo: ProductRepository = Depends(get_product_repo),
) -> list[Product]:
    return repo.search(q)
```

Also add `Query` to the fastapi import:

```python
from fastapi import APIRouter, Depends, HTTPException, Query
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
uv run pytest tests/test_products_search.py -v
```
Expected: all 6 tests PASS.

- [ ] **Step 6: Run full backend test suite**

```bash
uv run pytest -x
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/repositories/products.py app/api/products.py tests/test_products_search.py
git commit -m "feat: add GET /api/products?q= search endpoint"
```

---

## Task 2: Frontend types + API layer

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/products.ts`
- Modify: `frontend/src/hooks/queryKeys.ts`
- Create: `frontend/src/hooks/useSearchProducts.ts`
- Modify: `frontend/src/hooks/index.ts`

**Interfaces:**
- Produces: `type Location = "pantry" | "freezer"` — used by Tasks 3, 4, 5, 6
- Produces: `searchProducts(q: string): Promise<ProductOut[]>` — used by Task 6
- Produces: `useSearchProducts(q: string)` hook — used by Task 6

- [ ] **Step 1: Add `Location` type to `types.ts`**

Add at the bottom of `frontend/src/types.ts`:

```typescript
export type Location = "pantry" | "freezer";
```

- [ ] **Step 2: Add `searchProducts` to `api/products.ts`**

Replace the entire content of `frontend/src/api/products.ts`:

```typescript
import { get, post } from "@/api/client";
import type { ProductCreate, ProductOut } from "@/types";

export function createProduct(data: ProductCreate): Promise<ProductOut> {
  return post<ProductOut>("/products", data);
}

export function searchProducts(q: string): Promise<ProductOut[]> {
  return get<ProductOut[]>(`/products?q=${encodeURIComponent(q)}`);
}
```

- [ ] **Step 3: Add `products` query key to `queryKeys.ts`**

Replace content of `frontend/src/hooks/queryKeys.ts`:

```typescript
export const queryKeys = {
  inventory: (low?: boolean) => ["inventory", { low }] as const,
  shoppingList: () => ["shopping-list"] as const,
  products: (q: string) => ["products", { q }] as const,
};
```

- [ ] **Step 4: Create `useSearchProducts.ts`**

Create `frontend/src/hooks/useSearchProducts.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "@/api/products";
import { queryKeys } from "./queryKeys";

export function useSearchProducts(q: string) {
  return useQuery({
    queryKey: queryKeys.products(q),
    queryFn: () => searchProducts(q),
    enabled: q.length >= 2,
  });
}
```

- [ ] **Step 5: Export from `hooks/index.ts`**

Add to `frontend/src/hooks/index.ts`:

```typescript
export { useSearchProducts } from "./useSearchProducts";
```

- [ ] **Step 6: Run frontend tests — verify nothing broken**

```bash
cd frontend && npm test -- --run
```
Expected: all existing tests PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/products.ts frontend/src/hooks/queryKeys.ts frontend/src/hooks/useSearchProducts.ts frontend/src/hooks/index.ts
git commit -m "feat: add Location type, searchProducts API, useSearchProducts hook"
```

---

## Task 3: Pantry tabs (Despensa / Congelador)

**Files:**
- Modify: `frontend/src/screens/Pantry.tsx`
- Modify: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Consumes: `type Location = "pantry" | "freezer"` from `@/types` (Task 2)
- Consumes: `InventoryWithProductOut.inventory.location` — already in API response

- [ ] **Step 1: Write failing tests**

Add a new `describe("Pantry — location tabs")` block in `screens.test.tsx`. Add it after the existing `describe("Pantry", ...)` block:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test -- --run --reporter=verbose 2>&1 | grep -E "FAIL|PASS|✓|×" | head -30
```
Expected: new tab tests FAIL.

- [ ] **Step 3: Update `Pantry.tsx` with location tabs**

Replace the entire content of `frontend/src/screens/Pantry.tsx`:

```typescript
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory, usePatchInventory } from "@/hooks";
import { Card, StatusBadge, QuantityStepper, Spinner, ErrorState, EmptyState } from "@/components";
import type { InventoryWithProductOut, Location } from "@/types";

function isPantry(location: string | null | undefined): boolean {
  return location == null || location === "pantry";
}

export function Pantry() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInventory();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Location>("pantry");

  const tabFiltered = useMemo(() => {
    return (data ?? []).filter((i) =>
      activeTab === "pantry"
        ? isPantry(i.inventory.location)
        : i.inventory.location === "freezer"
    );
  }, [data, activeTab]);

  const filtered = useMemo(() => {
    return tabFiltered.filter((i) =>
      !search ||
      i.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.product.brand ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }, [tabFiltered, search]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  const emptyMessage =
    activeTab === "pantry"
      ? "Tu despensa está vacía. Escanea tu primer producto"
      : "Tu congelador está vacío. Añade productos con 'Añadir sin código'";

  return (
    <div className="space-y-stack-md pt-stack-md">
      {/* Location tabs */}
      <div role="tablist" className="flex gap-1 rounded-lg bg-surface-container p-1">
        {(["pantry", "freezer"] as Location[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md py-2 text-label-lg font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant"
            }`}
          >
            {tab === "pantry" ? "Despensa" : "Congelador"}
          </button>
        ))}
      </div>

      <input
        role="searchbox"
        type="search"
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {filtered.length === 0 && tabFiltered.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : filtered.length === 0 ? (
        <EmptyState message="Sin resultados" />
      ) : (
        <div className="space-y-stack-sm">
          {filtered.map((item) => (
            <PantryItem
              key={item.inventory.ean}
              item={item}
              onNavigate={() => navigate(`/despensa/${item.inventory.ean}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PantryItem({
  item,
  onNavigate,
}: {
  item: InventoryWithProductOut;
  onNavigate: () => void;
}) {
  const { product, inventory } = item;
  const [localQty, setLocalQty] = useState(inventory.quantity);
  const patch = usePatchInventory();

  function handleQtyChange(newQty: number) {
    setLocalQty(newQty);
    patch.mutate(
      { ean: inventory.ean, body: { quantity: newQty } },
      {
        onError: () => setLocalQty(inventory.quantity),
      }
    );
  }

  const status = localQty === 0 ? "empty" : localQty <= inventory.threshold ? "low" : "ok";

  return (
    <Card>
      <div className="flex items-start gap-3">
        <button
          onClick={onNavigate}
          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
          aria-label={product.name}
          type="button"
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-14 w-14 rounded-md object-contain bg-surface-container-low"
            />
          ) : (
            <span
              data-testid="img-placeholder"
              className="material-symbols-outlined flex h-14 w-14 items-center justify-center rounded-md bg-surface-container-low text-on-surface-variant text-3xl"
            >
              {inventory.location === "freezer" ? "ac_unit" : "grocery"}
            </span>
          )}
        </button>

        <button
          onClick={onNavigate}
          className="min-w-0 flex-1 text-left focus:outline-none"
          type="button"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-body-lg font-medium text-on-surface truncate">{product.name}</p>
              {product.brand && (
                <p className="text-body-sm text-on-surface-variant truncate">{product.brand}</p>
              )}
            </div>
            <StatusBadge status={status} />
          </div>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-body-sm text-on-surface-variant">{inventory.unit}</span>
        <QuantityStepper value={localQty} onChange={handleQtyChange} size="lg" />
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd frontend && npm test -- --run
```
Expected: all tests PASS including new tab tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/Pantry.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: add Despensa/Congelador tabs to Pantry screen"
```

---

## Task 4: Location selector in `ManualEntry`

**Files:**
- Modify: `frontend/src/screens/ManualEntry.tsx`
- Modify: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Consumes: `type Location = "pantry" | "freezer"` from `@/types` (Task 2)
- Consumes: `InventoryCreate.location` — already accepted by `POST /api/inventory`

- [ ] **Step 1: Write failing test**

Add a new `describe("ManualEntry — location")` block in `screens.test.tsx` after the existing `describe("ManualEntry", ...)`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test -- --run --reporter=verbose 2>&1 | grep -E "ManualEntry.*location|FAIL" | head -10
```
Expected: new location tests FAIL.

- [ ] **Step 3: Update `ManualEntry.tsx`**

Replace the entire content of `frontend/src/screens/ManualEntry.tsx`:

```typescript
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useCreateProduct, useAddInventory } from "@/hooks";
import { Button } from "@/components";
import type { ProductCreate, Location } from "@/types";

interface FormValues {
  ean: string;
  name: string;
  brand: string;
  quantity: string;
  threshold: string;
  unit: string;
  location: Location;
  kcal_per_100g: string;
  proteins_per_100g: string;
  carbs_per_100g: string;
  fat_per_100g: string;
}

export function ManualEntry() {
  const { ean: paramEan = "" } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const addInventory = useAddInventory();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      ean: paramEan,
      quantity: "1",
      threshold: "2",
      unit: "units",
      location: "pantry",
      kcal_per_100g: "",
      proteins_per_100g: "",
      carbs_per_100g: "",
      fat_per_100g: "",
    },
  });

  async function onSubmit(values: FormValues) {
    const parseOptional = (v: string) => v !== "" ? parseFloat(v) : undefined;
    const productData: ProductCreate = {
      ean: values.ean,
      name: values.name,
      ...(values.brand ? { brand: values.brand } : {}),
      kcal_per_100g: parseOptional(values.kcal_per_100g),
      proteins_per_100g: parseOptional(values.proteins_per_100g),
      carbs_per_100g: parseOptional(values.carbs_per_100g),
      fat_per_100g: parseOptional(values.fat_per_100g),
    };

    await createProduct.mutateAsync(productData);
    await addInventory.mutateAsync({
      ean: values.ean,
      quantity: parseInt(values.quantity, 10),
      threshold: parseInt(values.threshold, 10),
      unit: values.unit || "units",
      location: values.location,
    });
    navigate("/scan", { state: { added: true }, replace: true });
  }

  const isPending = createProduct.isPending || addInventory.isPending;

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Nuevo producto</h1>
      <p className="text-body-sm text-on-surface-variant">
        EAN no reconocido. Rellena los datos del producto.
      </p>

      <form role="form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="EAN" error={errors.ean?.message}>
          <input
            {...register("ean", { required: "Requerido" })}
            readOnly
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Nombre" error={errors.name?.message}>
          <input
            {...register("name", { required: "Requerido" })}
            aria-label="nombre"
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Marca (opcional)">
          <input
            {...register("brand")}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Ubicación">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-body-lg text-on-surface">
              <input
                {...register("location")}
                type="radio"
                value="pantry"
                aria-label="Despensa"
                className="accent-primary"
              />
              Despensa
            </label>
            <label className="flex items-center gap-2 text-body-lg text-on-surface">
              <input
                {...register("location")}
                type="radio"
                value="freezer"
                aria-label="Congelador"
                className="accent-primary"
              />
              Congelador
            </label>
          </div>
        </Field>

        <Field label="Cantidad inicial">
          <input
            {...register("quantity", { required: true, min: 1 })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Umbral mínimo">
          <input
            {...register("threshold", { required: true, min: 1 })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Unidad">
          <input
            {...register("unit")}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <p className="text-body-lg text-on-surface-variant pt-2">Información nutricional (por 100 g, opcional)</p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calorías (kcal)">
            <input
              {...register("kcal_per_100g", { min: 0 })}
              type="number"
              min={0}
              step="any"
              placeholder="—"
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label="Proteínas (g)">
            <input
              {...register("proteins_per_100g", { min: 0 })}
              type="number"
              min={0}
              step="any"
              placeholder="—"
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label="Carbohidratos (g)">
            <input
              {...register("carbs_per_100g", { min: 0 })}
              type="number"
              min={0}
              step="any"
              placeholder="—"
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
          <Field label="Grasas (g)">
            <input
              {...register("fat_per_100g", { min: 0 })}
              type="number"
              min={0}
              step="any"
              placeholder="—"
              className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>
        </div>

        {(createProduct.isError || addInventory.isError) && (
          <p className="text-body-sm text-error">
            Error al guardar. Inténtalo de nuevo.
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar producto"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      {children}
      {error && <p className="text-label-md text-error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd frontend && npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/ManualEntry.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: add location selector to ManualEntry form"
```

---

## Task 5: Location selector in `ProductDetail`

**Files:**
- Modify: `frontend/src/screens/ProductDetail.tsx`
- Modify: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Consumes: `type Location = "pantry" | "freezer"` from `@/types` (Task 2)
- Consumes: `usePatchInventory` — already exported from `@/hooks`
- Consumes: `InventoryWithProductOut.inventory.location`

- [ ] **Step 1: Write failing test**

Add a new `describe("ProductDetail — location")` block in `screens.test.tsx` after the existing `describe("ProductDetail", ...)`:

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test -- --run --reporter=verbose 2>&1 | grep -E "ProductDetail.*location|FAIL" | head -10
```
Expected: new location tests FAIL.

- [ ] **Step 3: Update `ProductDetail.tsx` — add location selector card**

Add the location selector card inside the `{tracked && (...)}` block, just after the threshold card. Find the section:

```typescript
      <MacrosCard product={product} />

      {tracked && (
        <Button variant="ghost" onClick={handleDelete} disabled={remove.isPending}>
          Quitar de la despensa
        </Button>
      )}
```

Replace with:

```typescript
      <MacrosCard product={product} />

      {tracked && (
        <Card>
          <p className="text-body-lg text-on-surface-variant mb-stack-sm">Ubicación</p>
          <div className="flex gap-6">
            {(["pantry", "freezer"] as const).map((loc) => (
              <label key={loc} className="flex items-center gap-2 text-body-lg text-on-surface cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value={loc}
                  aria-label={loc === "pantry" ? "Despensa" : "Congelador"}
                  checked={
                    loc === "freezer"
                      ? tracked.inventory.location === "freezer"
                      : tracked.inventory.location !== "freezer"
                  }
                  onChange={() =>
                    patch.mutate({ ean, body: { location: loc } })
                  }
                  className="accent-primary"
                />
                {loc === "pantry" ? "Despensa" : "Congelador"}
              </label>
            ))}
          </div>
        </Card>
      )}

      {tracked && (
        <Button variant="ghost" onClick={handleDelete} disabled={remove.isPending}>
          Quitar de la despensa
        </Button>
      )}
```

Also add `Location` to the types import at the top of `ProductDetail.tsx`:

```typescript
import type { ProductOut, Location } from "@/types";
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd frontend && npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/ProductDetail.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: add location selector to ProductDetail"
```

---

## Task 6: `CustomEntry` screen + Scan button

**Files:**
- Modify: `frontend/src/screens/Scan.tsx`
- Create: `frontend/src/screens/CustomEntry.tsx`
- Modify: `frontend/src/screens/index.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Consumes: `useSearchProducts(q: string)` from `@/hooks` (Task 2)
- Consumes: `useCreateProduct`, `useAddInventory` from `@/hooks`
- Consumes: `type Location = "pantry" | "freezer"` from `@/types` (Task 2)

- [ ] **Step 1: Write failing tests**

Add a new `describe("Scan — custom entry button")` and `describe("CustomEntry")` block in `screens.test.tsx`:

```typescript
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
```

Also add `CustomEntry` to the import block at the top of the test file:

```typescript
import { CustomEntry } from "@/screens/CustomEntry";
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd frontend && npm test -- --run --reporter=verbose 2>&1 | grep -E "CustomEntry|Scan.*custom|FAIL" | head -20
```
Expected: new tests FAIL — `CustomEntry` does not exist yet.

- [ ] **Step 3: Create `CustomEntry.tsx`**

Create `frontend/src/screens/CustomEntry.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchProducts, useCreateProduct, useAddInventory } from "@/hooks";
import { Button, Card, Spinner } from "@/components";
import type { ProductOut, Location } from "@/types";

function generateCustomEan(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "CUSTOM-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type Step = "search" | "create" | "quantity";

interface QuantityFormValues {
  quantity: string;
  threshold: string;
  unit: string;
  location: Location;
  name: string;
  brand: string;
}

export function CustomEntry() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOut | null>(null);
  const [formValues, setFormValues] = useState<QuantityFormValues>({
    quantity: "1",
    threshold: "1",
    unit: "units",
    location: "freezer",
    name: "",
    brand: "",
  });

  const createProduct = useCreateProduct();
  const addInventory = useAddInventory();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: searchResults = [], isLoading: isSearching } = useSearchProducts(debouncedQuery);

  function handleSelectProduct(product: ProductOut) {
    setSelectedProduct(product);
    setStep("quantity");
  }

  function handleCreateNew() {
    setSelectedProduct(null);
    setStep("create");
  }

  async function handleQuantitySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let ean: string;

    if (step === "create") {
      const customEan = generateCustomEan();
      await createProduct.mutateAsync({
        ean: customEan,
        name: formValues.name,
        ...(formValues.brand ? { brand: formValues.brand } : {}),
      });
      ean = customEan;
    } else {
      ean = selectedProduct!.ean;
    }

    await addInventory.mutateAsync({
      ean,
      quantity: parseInt(formValues.quantity, 10),
      threshold: parseInt(formValues.threshold, 10),
      unit: formValues.unit || "units",
      location: formValues.location,
    });

    navigate("/despensa");
  }

  const isPending = createProduct.isPending || addInventory.isPending;

  if (step === "search") {
    return (
      <div className="flex flex-col gap-stack-md pt-stack-md">
        <h1 className="text-headline-md text-on-surface">Añadir sin código</h1>

        <input
          role="searchbox"
          type="search"
          placeholder="Buscar producto existente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {isSearching && <Spinner />}

        {searchResults.length > 0 && (
          <div className="space-y-stack-sm">
            {searchResults.map((product) => (
              <button
                key={product.ean}
                onClick={() => handleSelectProduct(product)}
                className="w-full text-left"
                type="button"
              >
                <Card>
                  <p className="text-body-lg font-medium text-on-surface">{product.name}</p>
                  {product.brand && (
                    <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
                  )}
                </Card>
              </button>
            ))}
          </div>
        )}

        <Button variant="ghost" onClick={handleCreateNew} type="button">
          Crear nuevo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <button
        onClick={() => setStep("search")}
        className="flex items-center gap-1 text-body-md text-primary self-start"
        type="button"
      >
        ← Volver
      </button>

      <h1 className="text-headline-md text-on-surface">
        {selectedProduct ? selectedProduct.name : "Nuevo producto"}
      </h1>

      <form role="form" onSubmit={handleQuantitySubmit} className="flex flex-col gap-4">
        {step === "create" && (
          <>
            <Field label="Nombre">
              <input
                aria-label="nombre"
                value={formValues.name}
                onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                required
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Field label="Marca (opcional)">
              <input
                value={formValues.brand}
                onChange={(e) => setFormValues({ ...formValues, brand: e.target.value })}
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
          </>
        )}

        <Field label="Ubicación">
          <div className="flex gap-4">
            {(["pantry", "freezer"] as Location[]).map((loc) => (
              <label key={loc} className="flex items-center gap-2 text-body-lg text-on-surface cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value={loc}
                  aria-label={loc === "pantry" ? "Despensa" : "Congelador"}
                  checked={formValues.location === loc}
                  onChange={() => setFormValues({ ...formValues, location: loc })}
                  className="accent-primary"
                />
                {loc === "pantry" ? "Despensa" : "Congelador"}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Cantidad inicial">
          <input
            type="number"
            min={1}
            value={formValues.quantity}
            onChange={(e) => setFormValues({ ...formValues, quantity: e.target.value })}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Umbral mínimo">
          <input
            type="number"
            min={0}
            value={formValues.threshold}
            onChange={(e) => setFormValues({ ...formValues, threshold: e.target.value })}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Unidad">
          <input
            value={formValues.unit}
            onChange={(e) => setFormValues({ ...formValues, unit: e.target.value })}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        {(createProduct.isError || addInventory.isError) && (
          <p className="text-body-sm text-error">Error al guardar. Inténtalo de nuevo.</p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Export `CustomEntry` from `screens/index.ts`**

Add to `frontend/src/screens/index.ts`:

```typescript
export { CustomEntry } from "./CustomEntry";
```

- [ ] **Step 5: Add route in `App.tsx`**

In `frontend/src/App.tsx`, update the import and add the route:

```typescript
import { Dashboard, Pantry, Scan, ProductDetail, ManualEntry, Settings, CustomEntry } from "@/screens";
```

Add inside `<Route element={<AppShell />}>`:

```typescript
<Route path="custom-entry" element={<CustomEntry />} />
```

- [ ] **Step 6: Add "Añadir sin código" button to `Scan.tsx`**

In `frontend/src/screens/Scan.tsx`, add the button after the `</form>` closing tag (before the end of the outer `<div>`):

```typescript
      {/* Add without barcode */}
      <button
        onClick={() => navigate("/custom-entry")}
        className="text-label-lg text-primary underline"
        type="button"
      >
        Añadir sin código
      </button>
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
cd frontend && npm test -- --run
```
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/screens/CustomEntry.tsx frontend/src/screens/index.ts frontend/src/screens/Scan.tsx frontend/src/App.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: add CustomEntry screen and Añadir sin código button"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `GET /api/products?q=` — Task 1
- ✅ `Location` type + `searchProducts` + `useSearchProducts` — Task 2
- ✅ Pantry tabs Despensa/Congelador — Task 3
- ✅ Location selector in ManualEntry — Task 4
- ✅ Location selector in ProductDetail — Task 5
- ✅ CustomEntry two-step flow (search + create + quantity/location) — Task 6
- ✅ `CUSTOM-xxxxxxxx` EAN generation — Task 6
- ✅ "Añadir sin código" button in Scan — Task 6
- ✅ `/custom-entry` route in App.tsx — Task 6
- ✅ Default location in CustomEntry = freezer — Task 6 step 2 form defaults
- ✅ Default location in ManualEntry = pantry — Task 4

**Type consistency:**
- `Location = "pantry" | "freezer"` — defined Task 2, used Tasks 3, 4, 5, 6 ✅
- `useSearchProducts(q: string)` — defined Task 2, used Task 6 ✅
- `searchProducts(q: string): Promise<ProductOut[]>` — defined Task 2 ✅
- `ProductRepository.search(q, limit)` — defined Task 1, used by endpoint in Task 1 ✅

**No placeholders:** confirmed — all steps have complete code. ✅
