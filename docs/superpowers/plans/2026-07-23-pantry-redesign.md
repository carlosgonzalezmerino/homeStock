# Pantry Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la pantalla Despensa para que actualizar cantidades sea rápido (stepper inline) y cada producto sea identificable de un vistazo (thumbnail + cantidad grande + badge de color).

**Architecture:** Se modifican tres componentes existentes (`StatusBadge`, `QuantityStepper`, `Pantry`) de forma incremental. El stepper inline en la tarjeta usa `usePatchInventory` con mutación optimista: actualiza el estado local inmediatamente y hace el PATCH en background, revirtiendo en caso de error. El `Dashboard` usa `StatusBadge` con la prop antigua — se actualiza en la misma tarea que el componente para evitar romper los tests.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (tokens Material You), TanStack Query v5, Testing Library + Vitest, MSW para mocks de red.

## Global Constraints

- Touch target mínimo 44×44px en todos los botones interactivos.
- Cantidad mínima del stepper: 0. No hay máximo.
- `StatusBadge` cambia de `low: boolean` a `status: "ok" | "low" | "empty"` — breaking change interno. Solo se usa en `Pantry.tsx` y `Dashboard.tsx`; ambos se actualizan en Task 1.
- Thumbnail: 56×56px, `rounded-md`, `object-contain`, fondo `bg-surface-container-low`. Placeholder si no hay `image_url`.
- Tap en el área de nombre/imagen navega a `/despensa/:ean`. El stepper detiene la propagación del click.
- Colores del badge: verde = `bg-primary` (ok), amarillo = `bg-tertiary` (low), rojo = `bg-error` (empty).
- Todos los tests existentes deben pasar al final.

---

## Task 1: Refactorizar StatusBadge a círculo de color

**Files:**
- Modify: `frontend/src/components/StatusBadge.tsx`
- Modify: `frontend/src/screens/Dashboard.tsx` (actualizar llamada a StatusBadge)
- Modify: `frontend/src/components/components.test.tsx` (actualizar tests de StatusBadge)

**Interfaces:**
- Produces: `StatusBadge({ status: "ok" | "low" | "empty" }): JSX.Element`

- [ ] **Step 1: Actualizar los tests de StatusBadge**

Reemplazar los dos tests existentes de `StatusBadge` en `frontend/src/components/components.test.tsx` (líneas 16-26) por:

```tsx
describe("StatusBadge", () => {
  it("renders a circle with aria-label 'Stock OK' when status is ok", () => {
    const { container } = render(<StatusBadge status="ok" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-label", "Stock OK");
    expect(dot).toHaveClass("bg-primary");
  });

  it("renders a circle with aria-label 'Stock bajo' when status is low", () => {
    const { container } = render(<StatusBadge status="low" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-label", "Stock bajo");
    expect(dot).toHaveClass("bg-tertiary");
  });

  it("renders a circle with aria-label 'Agotado' when status is empty", () => {
    const { container } = render(<StatusBadge status="empty" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-label", "Agotado");
    expect(dot).toHaveClass("bg-error");
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

```bash
cd frontend && npx vitest run src/components/components.test.tsx --reporter=verbose 2>&1 | grep -E "FAIL|PASS|StatusBadge"
```

Esperado: los tres tests de StatusBadge fallan con "expected element to have class".

- [ ] **Step 3: Implementar el nuevo StatusBadge**

Reemplazar el contenido completo de `frontend/src/components/StatusBadge.tsx`:

```tsx
type StatusBadgeProps = { status: "ok" | "low" | "empty" };

const CONFIG = {
  ok:    { color: "bg-primary",  label: "Stock OK"   },
  low:   { color: "bg-tertiary", label: "Stock bajo"  },
  empty: { color: "bg-error",    label: "Agotado"     },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { color, label } = CONFIG[status];
  return (
    <span
      aria-label={label}
      className={`inline-block h-3 w-3 rounded-full ${color} shrink-0`}
    />
  );
}
```

- [ ] **Step 4: Actualizar Dashboard.tsx para usar la nueva prop**

En `frontend/src/screens/Dashboard.tsx`, línea 65, cambiar:

```tsx
// antes
<StatusBadge low />
// después
<StatusBadge status="low" />
```

- [ ] **Step 5: Ejecutar todos los tests para verificar que pasan**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```

Esperado: todos los tests pasan. Si alguno falla por la prop `low` en otro sitio, buscarlo con `grep -r "StatusBadge" src/` y actualizar.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/StatusBadge.tsx frontend/src/screens/Dashboard.tsx frontend/src/components/components.test.tsx
git commit -m "refactor: StatusBadge now shows a color dot (ok/low/empty) instead of text"
```

---

## Task 2: Añadir prop `size` a QuantityStepper

**Files:**
- Modify: `frontend/src/components/QuantityStepper.tsx`
- Modify: `frontend/src/components/components.test.tsx` (añadir test de size lg)

**Interfaces:**
- Consumes: interface actual `{ value: number; onChange: (n: number) => void }`
- Produces: `QuantityStepper({ value, onChange, size? }: QuantityStepperProps): JSX.Element` donde `size?: "sm" | "lg"`, default `"sm"`. En `"lg"`: botones 48×48px (`h-12 w-12`), cantidad en `text-headline-lg`.

- [ ] **Step 1: Añadir test para size="lg"**

Añadir al bloque `describe("QuantityStepper", ...)` en `frontend/src/components/components.test.tsx`, después del último test existente:

```tsx
it("applies lg size classes when size='lg'", () => {
  const { container } = render(<QuantityStepper value={3} onChange={vi.fn()} size="lg" />);
  const buttons = container.querySelectorAll("button");
  expect(buttons[0]).toHaveClass("h-12");
  expect(buttons[1]).toHaveClass("h-12");
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

```bash
cd frontend && npx vitest run src/components/components.test.tsx --reporter=verbose 2>&1 | grep -E "FAIL|PASS|size"
```

Esperado: FAIL — "expected element to have class h-12".

- [ ] **Step 3: Implementar la prop size en QuantityStepper**

Reemplazar el contenido completo de `frontend/src/components/QuantityStepper.tsx`:

```tsx
interface QuantityStepperProps {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "lg";
}

export function QuantityStepper({ value, onChange, size = "sm" }: QuantityStepperProps) {
  const isLg = size === "lg";
  const btnClass = isLg
    ? "flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface text-2xl"
    : "flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface text-xl";
  const valueClass = isLg
    ? "min-w-[3ch] text-center text-headline-lg font-bold text-on-surface"
    : "min-w-[2ch] text-center text-headline-md";

  return (
    <div className="flex items-center gap-4">
      <button
        aria-label="−"
        onClick={() => { if (value > 0) onChange(value - 1); }}
        className={btnClass}
        type="button"
        disabled={value === 0}
      >
        −
      </button>
      <span className={valueClass}>{value}</span>
      <button
        aria-label="＋"
        onClick={() => onChange(value + 1)}
        className={isLg ? btnClass.replace("bg-surface-container-high text-on-surface", "bg-primary-container text-on-primary-container") : "flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-xl"}
        type="button"
      >
        ＋
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Ejecutar todos los tests**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```

Esperado: todos los tests pasan. Los tests existentes de QuantityStepper siguen funcionando porque `size` tiene default `"sm"`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/QuantityStepper.tsx frontend/src/components/components.test.tsx
git commit -m "feat: QuantityStepper accepts size='lg' for inline pantry use"
```

---

## Task 3: Rediseñar Pantry con PantryItem (thumbnail + stepper inline)

**Files:**
- Modify: `frontend/src/screens/Pantry.tsx`
- Modify: `frontend/src/screens/screens.test.tsx` (añadir tests del stepper inline y del thumbnail)

**Interfaces:**
- Consumes:
  - `StatusBadge({ status: "ok" | "low" | "empty" })` — de Task 1
  - `QuantityStepper({ value, onChange, size?: "sm" | "lg" })` — de Task 2
  - `usePatchInventory()` — de `@/hooks`, retorna `UseMutationResult` de TanStack Query v5
  - `InventoryWithProductOut` — de `@/types`: `{ inventory: { ean, quantity, threshold, unit }, product: { name, brand?, image_url? }, low: boolean }`
- Produces: componente `PantryItem` (interno al archivo) con stepper optimista

- [ ] **Step 1: Añadir tests del stepper inline y thumbnail en Pantry**

Añadir al bloque `describe("Pantry", ...)` en `frontend/src/screens/screens.test.tsx`, después del último test existente de Pantry (`it("clicking a row navigates...")`):

```tsx
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
```

- [ ] **Step 2: Ejecutar los tests nuevos para verificar que fallan**

```bash
cd frontend && npx vitest run src/screens/screens.test.tsx --reporter=verbose 2>&1 | grep -E "FAIL|PASS|thumbnail|stepper|placeholder"
```

Esperado: los 4 tests nuevos de Pantry fallan.

- [ ] **Step 3: Implementar el nuevo Pantry.tsx con PantryItem**

Reemplazar el contenido completo de `frontend/src/screens/Pantry.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory, usePatchInventory } from "@/hooks";
import { Card, StatusBadge, QuantityStepper, Spinner, ErrorState, EmptyState } from "@/components";
import type { InventoryWithProductOut } from "@/types";

export function Pantry() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInventory();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return (data ?? []).filter((i) =>
      !search ||
      i.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.product.brand ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  return (
    <div className="space-y-stack-md pt-stack-md">
      <input
        role="searchbox"
        type="search"
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {filtered.length === 0 && (data?.length ?? 0) === 0 ? (
        <EmptyState message="Tu despensa está vacía. Escanea tu primer producto" />
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

function statusFor(item: InventoryWithProductOut): "ok" | "low" | "empty" {
  if (item.inventory.quantity === 0) return "empty";
  if (item.low) return "low";
  return "ok";
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
        {/* Thumbnail */}
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
              grocery
            </span>
          )}
        </button>

        {/* Identity + badge */}
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

      {/* Stepper inline — bottom right, does not trigger navigation */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-body-sm text-on-surface-variant">{inventory.unit}</span>
        <QuantityStepper value={localQty} onChange={handleQtyChange} size="lg" />
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Ejecutar todos los tests**

```bash
cd frontend && npx vitest run 2>&1 | tail -30
```

Esperado: todos los tests pasan. Si falla el test `"clicking a row navigates to /despensa/:ean"`, es porque ahora el elemento clickable es un `<button>` con el nombre del producto — el selector `screen.getByRole("button", { name: /leche entera/i })` sigue funcionando.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/Pantry.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: pantry redesign — thumbnail, inline stepper, color badge"
```

---

## Self-Review

**Spec coverage:**

| Requisito del spec | Tarea |
|---|---|
| Thumbnail 56×56px con placeholder | Task 3 |
| Badge círculo de color sin texto (ok/low/empty) | Task 1 |
| Stepper inline abajo derecha, size lg | Task 2 + Task 3 |
| Mutación optimista con revert en error | Task 3 (`onError: () => setLocalQty`) |
| Tap fuera del stepper navega al detalle | Task 3 (`stopPropagation` implícito por botones separados) |
| Mínimo 0, botón − deshabilitado en 0 | Task 2 (`disabled={value === 0}`) |
| Tests existentes siguen pasando | Verificado en cada tarea |
| Breaking change `StatusBadge` resuelto en Dashboard | Task 1 |

**Placeholder scan:** Ningún TBD, TODO ni paso sin código. Todos los comandos tienen salida esperada.

**Type consistency:**
- `StatusBadge` usa `status: "ok" | "low" | "empty"` consistentemente en Task 1 y Task 3.
- `QuantityStepper` usa `size?: "sm" | "lg"` en Task 2 y Task 3 llama con `size="lg"`.
- `usePatchInventory` llamado con `{ ean: string, body: InventoryPatch }` — coincide con la firma en `useMutations.ts`.
