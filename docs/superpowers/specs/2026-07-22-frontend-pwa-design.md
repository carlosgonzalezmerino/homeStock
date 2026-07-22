# homeStock — Frontend PWA Design Spec

**Date:** 2026-07-22
**Status:** Approved (brainstorming complete)
**Scope:** React + Vite PWA frontend for the existing homeStock FastAPI backend.

## Goal

Build a mobile-first Progressive Web App that lets a user scan grocery barcodes,
resolve them to products, and manage household stock levels. The backend
(SDD Tasks 1–11) is complete and **must not change** for this work. The frontend
consumes the existing API as-is.

## Key Locked Decisions

1. **Stock-only, no backend changes.** The backend has no expiry-date concept.
   The designs' "Alertas de Caducidad" is reinterpreted as **"Alertas de Stock"**:
   an item is low/out when `low === true` (backend computes `low = quantity <= threshold`).
   The mockups' "Fecha de Vencimiento" field is dropped for v1.
2. **v1 scope:** three designed screens + scan flow — Dashboard/Home, Mi Despensa,
   Product Detail (scan result / EAN resolution), plus a Manual-Entry fallback.
   Bottom nav: Home / Despensa / Scanner / Settings. Settings hosts only the theme toggle for now.
3. **Single `/resolve` call on scan.** `GET /api/resolve/{ean}` already does
   local-products → OFF → 404 internally, so the frontend makes ONE call. The
   returned `source` field drives the "Reconocido" label. On 404 → Manual-Entry.
4. **Theme:** light (Alimenda) + dark (Dark Slate) with a toggle.
5. **Dev setup:** separate `frontend/` folder, Vite dev server proxies `/api` to
   FastAPI, served over HTTPS via mkcert (already documented in README) so the
   camera works (secure-context requirement).
6. **Architecture (Approach A):** TanStack Query (server state) + React Router
   (URL-driven nav) + a thin typed `api.ts` client. Theme is the only client state
   (React context + localStorage). Components never call `fetch` directly.

## Backend API (consumed, unchanged)

- `GET /api/health`
- `GET /api/resolve/{ean}` → `ProductOut`; `404 {"ean": ean}` if unknown.
- `GET /api/inventory?low=<bool>` → `InventoryWithProductOut[]` (`low = quantity <= threshold`).
- `POST /api/inventory` → `201`; `404` ProductNotFoundError, `409` AlreadyTrackedError.
- `PATCH /api/inventory/{ean}` → `InventoryOut`.
- `DELETE /api/inventory/{ean}` → `204`.
- `POST /api/products` → `ProductOut` (backend sets `source="manual"`).
- `GET /api/products/{ean}`, `PATCH /api/products/{ean}`.
- `GET /api/shopping-list` → `ShoppingListItemOut[]` (derived from low inventory).

Schema shapes: `ProductOut` (ean, name, brand?, description?, image_url?, category?,
quantity_desc?, source, + per-100g nutrition). `InventoryOut` (id, ean, quantity,
threshold, unit, location?). `InventoryWithProductOut` (inventory, product, low).
`InventoryCreate` (ean, quantity, threshold, unit="units", location?). `InventoryPatch`
(all optional). `ProductCreate` (no source). `ShoppingListItemOut` (ean, name, quantity,
threshold, unit, image_url?).

## Architecture & Project Structure

New `frontend/` directory at repo root (sibling to `app/`). Backend tree untouched.

Stack: React 18 + Vite + TypeScript, Tailwind CSS, React Router, TanStack Query,
html5-qrcode, `vite-plugin-pwa`.

```
frontend/
├── index.html
├── vite.config.ts          # dev proxy /api → FastAPI; mkcert HTTPS
├── tailwind.config.ts      # both themes as one token set (darkMode: "class")
├── package.json
├── src/
│   ├── main.tsx            # QueryClientProvider + ThemeProvider + Router
│   ├── App.tsx             # routes + bottom-nav layout (AppShell)
│   ├── api/
│   │   ├── client.ts       # fetch wrapper (base URL, JSON, ApiError mapping)
│   │   ├── inventory.ts    # list/create/patch/delete
│   │   ├── resolve.ts      # GET /api/resolve/{ean}
│   │   ├── products.ts     # POST /api/products (manual entry)
│   │   └── shoppingList.ts # GET /api/shopping-list
│   ├── hooks/              # TanStack Query hooks (useInventory, useResolve, …)
│   ├── theme/              # ThemeProvider + toggle (context + localStorage)
│   ├── components/         # presentational: Card, StatusBadge, BottomNav, …
│   └── screens/
│       ├── Dashboard.tsx
│       ├── Pantry.tsx        # Mi Despensa
│       ├── Scan.tsx          # camera + resolve flow
│       ├── ProductDetail.tsx # "Reconocido" / add-or-edit stock
│       ├── ManualEntry.tsx   # 404 fallback → POST /api/products
│       └── Settings.tsx      # theme toggle
```

**Layering / isolation:** `screens` render UI and call `hooks`; `hooks` wrap
TanStack Query and call the typed `api/*` modules; only `api/*` touches `fetch`.
Presentational `components` take props, no data fetching. Each unit is
independently testable.

**Routing:** `/` Dashboard, `/despensa` Pantry, `/scan` Scan, `/settings` Settings.
Scan result renders `ProductDetail` (`/scan/:ean`); a row in Pantry can also open
Detail. A 404 from resolve routes to `ManualEntry`.

## Theming & Components

**Theme system.** One Tailwind config (`darkMode: "class"`). Both DESIGN.md files
share identical Material-3 token *names* (`surface`, `on-surface`, `primary`,
`primary-container`, `tertiary`, `error`, `outline-variant`, …), so tokens are
expressed as CSS custom properties: `:root { --primary: …; }` (Alimenda light) and
`.dark { --primary: …; }` (Dark Slate). Tailwind colors map to `rgb(var(--…))`.
Components use one class (`bg-primary`) and get the correct value per theme — no
per-element `dark:` duplication.

- `ThemeProvider` (React context): reads `localStorage.theme`, falls back to
  `prefers-color-scheme`, toggles `.dark` on `<html>`; exposes `{ theme, toggle }`.
  Settings renders the only toggle.
- Fonts: Inter + Material Symbols Outlined via `<link>` in `index.html`.
- Type + spacing scale ported into config: 8px base, `container-padding` 20px,
  `stack-sm` 12px, `stack-md` 24px, `gutter` 16px; radii sm/DEFAULT/md/lg/xl/full;
  Inter type scale (headline-lg 32/700 … label-md 12/600 uppercase).

**Light palette (Alimenda):** surface `#f7f9fb`, primary `#006e2f`,
primary-container `#22c55e`, secondary `#545f73`, tertiary `#9d4300`, error `#ba1a1a`,
surface-container-lowest `#ffffff`, outline-variant `#bccbb9`.
**Dark palette (Dark Slate):** background/surface `#0e150e`, primary `#4be277`,
primary-container `#22c55e`, on-primary `#003915`, secondary `#b9c7e0`,
tertiary `#ffb5ab`, error `#ffb4ab`, surface-container `#1a221a`, on-surface `#dce5d9`,
outline `#869585`.

**Shared presentational components:**

| Component | Purpose |
|---|---|
| `AppShell` | sticky header + `<Outlet/>` + `BottomNav`, `pb-32` for nav clearance |
| `BottomNav` | 4 `NavLink`s; active = `primary-container` pill, driven by route match |
| `Card` | `surface-container-lowest`, 16px radius, soft border; optional `accent` → 4px left border (`error`/`tertiary`) for low stock |
| `StatusBadge` | stock state → label + color: `EN BUEN ESTADO` (primary) / `STOCK BAJO` (tertiary/error) |
| `LevelBar` | thin rounded quantity bar (`quantity` vs display max) |
| `Button` | pill, ≥56px, `primary-container` bg |
| `QuantityStepper` | −/＋ around an absolute quantity |
| `EmptyState` / `Spinner` / `ErrorState` | shared loading/empty/error visuals |

**Stock-only reinterpretation:** Dashboard "Alertas de Caducidad" → **"Alertas de
Stock"**; alert cards render items where `low === true`; accent border `error`/`tertiary`
by severity. No "days left" text — show `quantity` + `unit` (e.g. "1 ud restante").

## Data Flow & API Layer

**`api/client.ts`** is the only place `fetch` lives: base URL `/api`, JSON headers,
parses body, maps non-2xx into a typed `ApiError { status, body }` so callers branch
on `status`. Exposes `get/post/patch/del`.

**Endpoint modules** mirror backend schemas: `resolve.ts` (`GET /resolve/{ean}` →
`ProductOut`, surfaces 404 as `ApiError`), `inventory.ts` (list/create/patch/delete),
`products.ts` (`POST /products`), `shoppingList.ts` (`GET /shopping-list`).

**TanStack Query hooks** own caching/invalidation:
- `useInventory(low?)` → key `["inventory", { low }]`.
- `useShoppingList()` → `["shopping-list"]`.
- `useResolve(ean)` → enabled-gated, `retry: false` (404 is a real answer).
- Mutations `useAddInventory`, `usePatchInventory`, `useDeleteInventory`,
  `useCreateProduct` — each invalidates `["inventory"]` **and** `["shopping-list"]`
  on success.

**Screen → data mapping:**
- **Dashboard** (`/`): `useInventory()` for fill summary + low items for the
  "Alertas de Stock" carousel; categories grouped client-side from `product.category`.
- **Pantry** (`/despensa`): `useInventory()`; search + category chips filter
  client-side; each row → `Card` + `StatusBadge` + `LevelBar`.
- **Detail** (`/scan/:ean` or opened from a row): `useResolve(ean)` for product;
  `useInventory()` (already cached) to find whether the EAN is tracked and its
  current quantity.

**Scan data flow (single-call):**

```
Scan.tsx (html5-qrcode) → ean
      │
      ▼
GET /api/resolve/{ean}          # resolver already does local products → OFF internally
   ├── 200 → navigate to Detail; source ("manual"|"off") → "Reconocido" badge
   │          └── find ean in useInventory():
   │                ├── tracked  → stepper = current qty; PATCH (update) / DELETE (remove)
   │                └── untracked → stepper = 1;          POST (add)
   └── 404 → navigate to ManualEntry(ean)
                 → POST /api/products {ean,name,…}  (backend sets source="manual")
                 → POST /api/inventory {ean,quantity,threshold,unit}
                 → invalidate inventory + shopping-list → back to Pantry
```

## Quantity Semantics (Detail screen)

The `QuantityStepper` represents the **absolute quantity on hand**, not an "add N"
delta. − means consumed one, ＋ means bought/added one. Both directions are
first-class (consuming stock is as normal as restocking).

- **Tracked item** → stepper pre-filled with current `quantity`. Adjust up or down,
  then "Actualizar" → `PATCH /inventory/{ean}` with the new absolute quantity.
- **Untracked item** → stepper starts at 1; "Añadir a mi despensa" → `POST /inventory`.
- **Minimum is 0.** Reaching 0 → `PATCH /inventory/{ean}` with `quantity: 0`
  (the row **persists** at 0, flagged low/out-of-stock and on the shopping list).
  0 does **not** auto-delete.
- **Removing** an item is a separate explicit action ("Quitar de la despensa" →
  `DELETE /inventory/{ean}`).

Because a PATCH can drop an item to/below threshold (or a DELETE removes it), both
mutations invalidate `["inventory"]` and `["shopping-list"]` so consuming stock
immediately surfaces in "Alertas de Stock" and the shopping list.

## Error, Loading & Edge Cases

**Query states:** every query renders `Spinner` (pending), `ErrorState` + retry
(error), or content. Empty sets render `EmptyState` (e.g. empty Pantry → "Tu
despensa está vacía. Escanea tu primer producto").

**`ApiError` branching:**
- **404 on `/resolve`** — not an error; route to `ManualEntry(ean)`. `useResolve`
  uses `retry: false`.
- **409 on `POST /inventory`** (AlreadyTracked) — defensive: catch, invalidate
  `["inventory"]`, switch to PATCH. No user-facing error.
- **404 on `POST /inventory`** (ProductNotFound) — in manual flow the `POST /products`
  step runs first; the flow guarantees ordering.
- **5xx / network** — `ErrorState` with "Reintentar"; mutations show inline/toast
  message and keep the user's input.

**Scanner edge cases:**
- Camera permission denied / no camera → fallback manual EAN text input feeding the
  same `/resolve` flow (also covers desktop dev).
- Secure-context requirement met via mkcert HTTPS in dev and prod.
- Scanner keeps scanning until a valid EAN decodes; manual-entry link always visible.

**Manual entry validation:** `ean` + `name` required (matches `ProductCreate`);
numeric nutrition optional. Submit: `POST /products` → `POST /inventory` → invalidate
→ navigate to Pantry.

## Testing

**Tooling:** Vitest + React Testing Library + MSW (stubs `/api` at the network
boundary so tests exercise real `api/client.ts` + Query code paths). Playwright
available for one thin e2e smoke test, not required per-screen.

| Layer | Tests |
|---|---|
| `api/client.ts` | correct URL/method/body; 2xx → parsed body; non-2xx → `ApiError{status,body}` |
| endpoint modules | right paths; `resolve` surfaces 404 as `ApiError` (no retry) |
| Query hooks | `useInventory(low)` keys/refetch; mutations invalidate `["inventory"]`+`["shopping-list"]`; `useResolve` `retry:false` |
| Components | `StatusBadge`/`Card` accent map; `QuantityStepper` clamps at 0, − and ＋ work; `BottomNav` active follows route |
| Screens (MSW) | Dashboard low-stock carousel; Pantry filter + empty state; Detail pre-fills stepper (tracked→PATCH, untracked→POST, 0→PATCH); Scan 200→Detail / 404→ManualEntry |

**Key scenarios (locked decisions):** single `/resolve` call; 200 shows "Reconocido"
from `source`; 404 → ManualEntry; stepper = absolute qty; decrement issues PATCH with
lower qty; 0 → PATCH (row persists, not delete); "Quitar" → DELETE; manual entry
`POST /products` then `POST /inventory` both invalidate caches; camera-denied fallback
feeds the same flow.

**Not tested (YAGNI):** pixel styling, Tailwind class output, html5-qrcode internals
(wrapped behind a thin `useScanner` hook mocked in screen tests).

## Out of Scope (v1)

- Expiry/caducidad dates and any backend change.
- Auth / multi-user (backend is single-user).
- Categories management UI beyond client-side grouping.
- Offline write queue (PWA install + shell caching only; API calls require network).
- Mercadona source (intentionally omitted in backend; preserved for later).
