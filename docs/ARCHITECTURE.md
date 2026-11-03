# Architecture

homeStock is a single-household inventory. There is no login: the app runs on the home LAN and
trusts whoever can reach it.

```text
 phone (PWA)                         home server
┌────────────────┐   HTTPS    ┌───────────────────────────────┐
│ React + Vite   │ ─────────▶ │ Traefik (TLS)                 │
│ camera scanner │            │   └─ FastAPI (uvicorn :8100)  │
│ service worker │ ◀───────── │        ├─ routers  ─ services │
└────────────────┘            │        └─ repositories        │
                              │              │                │
                              │         MariaDB  (SQLite in dev)
                              └───────────────────────────────┘
```

## Backend

The backend has three layers. Each one only talks to the next one down.

| Layer | Folder | Responsibility |
|---|---|---|
| Routers | `app/api/` | HTTP only: parse the request, call a service, map errors to status codes. No business rules. |
| Services | `app/services/` | Business rules: product resolution, stock rules, freezer rules, the diary of stock changes, scanning, the weekly review, the shopping list. |
| Repositories | `app/repositories/` | Database access. The only layer that builds queries. |

Dependencies are wired with FastAPI `Depends` in `app/api/deps.py`, which is also where the active
product sources are chosen.

### Product resolution

`GET /api/resolve/{ean}` asks, in order:

1. the local `products` table, which is the source of truth and the cache;
2. each configured source in `get_resolver`: today only the imported OpenFoodFacts table
   (`off_products`);
3. nobody: it answers `404`, which means "ask the user for the data".

A product found by a source is written to `products`, so each EAN reaches the sources at most
once. The Mercadona client (`app/sources/mercadona.py`) follows the same `ProductSource`
protocol but is **not enabled**, because its id derivation is unreliable. It never raises: any
network, status or body problem is logged and reported as "not found".

### Stock rules

These rules live in `InventoryItem.is_low`, `InventoryRepository.list_low` and
`InventoryService`. The low-stock rule is written twice on the server (a Python property and an
SQL condition), and a test checks that both give the same answer for the same cases. The
frontend mirrors it in `computeStockStatus`, which colours the dot of each pantry row; its tests
use the same cases. The `low` flag of the API is what the dashboard shows.

| Rule | Detail |
|---|---|
| Low stock | `quantity == 0` or `quantity < threshold`. Exactly at the threshold is **not** low. |
| Numbers | Quantity and threshold are `>= 0`, with at most 2 decimals. `null` is rejected on edits. |
| Freezer fields | `drawer` (1 to 4) and `frozen_at` only exist for freezer items. Sending them for a pantry item is a `422` with an explanation. |
| Moving into the freezer | Sets `frozen_at` to today unless the client sends a date. |
| Moving out of the freezer | Clears `drawer` and `frozen_at`. |
| Changing quantity | Never touches `frozen_at`. |
| Notes | Trimmed. An empty note is stored as `null`. At most 500 characters. |
| Location | `pantry` or `freezer`. A missing location means the pantry. |

Everything the client can send is validated in `app/schemas.py` with Pydantic. SQL is built with
SQLAlchemy expressions, never by concatenating strings.

### Error handling

| Status | Meaning | Body |
|---|---|---|
| `404` | Unknown product or stock row | `{"detail": {"ean": "..."}}` (resolve answers `{"ean": "..."}`) |
| `409` | Already exists: product with that EAN, or product already tracked | `{"detail": {"ean": "..."}}` |
| `422` | Invalid input | FastAPI validation list, or `{"detail": {"message": "..."}}` for freezer fields |

External sources never break a request. The service layer raises specific exceptions
(`ProductNotFoundError`, `AlreadyTrackedError`, `FreezerFieldsError`) and the routers turn them
into the statuses above.

### The diary of stock changes

`InventoryService` is the **only** place that changes a quantity, and every change leaves one row
in `stock_movements` (see [DATABASE.md](DATABASE.md)). That is a rule of the project: a new feature
that changes stock goes through `InventoryService.update`, `adjust`, `start_tracking` or
`stop_tracking`, never straight to the repository, or the history silently loses it.

```text
router ──► InventoryService ──► InventoryRepository   (the stock row, the truth)
                 │
                 └──────────► MovementRepository      (its diary, insert-only)

ScanService ──► ProductResolver + InventoryService    (POST /api/scan: one unit in or out)
MovementService ──► MovementRepository + InventoryService   (list, undo)
ReviewService ──► the three repositories, read only   (what the weekly review asks about)
```

- **`atomic(session)`** (`app/db.py`) groups writes so they succeed or fail together. Repositories call
  `commit_unless_atomic` instead of `session.commit()`, so inside the block they only flush and an
  error rolls back the stock, the diary and the list as one. `ShoppingListService.purchase` uses it.
- `MovementContext(reason, source, undoes_id)` travels with a change. The router takes `reason`
  out of the `PATCH` body before the fields reach the repository, because it is not a column.
- **Undo writes a compensating movement** and never deletes. Undoing the `initial` movement of a
  product that ends at 0 stops tracking it.
- The ORM hands back the *same object* it then updates, so a value needed from before a change
  (such as the previous quantity) must be read **before** calling the service. A test caught this.
- The weekly review needs `inventory_items.checked_at` for "it is still there", which is not a
  movement because a movement's `delta` is never 0.

## Data model

See [DATABASE.md](DATABASE.md) for every column and the migration history.

```text
products 1 ──── 0..1 inventory_items        off_products   (imported, rebuilt by a script)
 (catalogue)          (stock, unique ean)     (read only, step 2 of the resolution)
     1
     └──── 0..n stock_movements               (the diary; survives removing the stock row)
```

There is **one stock row per product**. Having the same product in two locations is a known
limitation that would require changing the unique constraint on `inventory_items.ean`.

## Frontend

React 18 with TypeScript in strict mode, Tailwind 3.4, TanStack Query for server state and
React Router 6. The full structure is in [`frontend/README.md`](../frontend/README.md).

### Screens and routes

| Path | Screen | Purpose |
|---|---|---|
| `/` | Dashboard | Totals and the products that are low on stock. Each alert opens its product. |
| `/despensa` | Pantry | Pantry and freezer tabs, search, inline quantity buttons. The freezer tab shows how long ago each item was frozen and can sort by that age. |
| `/despensa/:ean` | Product detail, `manage` mode | Edit a product that is in the pantry. |
| `/lista` | Shopping list | What the user put on it, from the catalogue search. Amount to buy, how much is at home, a mark for what is picked up, and one button to register the batch. |
| `/scan` | Scan | Camera, mode selector (**Detalle**, **Compra**, **Gastar**), typed code, link to "Añadir sin código". See [the scan modes](#the-scan-modes). |
| `/scan/revisar` | Review purchase | What a shopping session added, what is new, and the codes nobody knew. |
| `/repaso` | Weekly review | One card at a time: is the registered stock still true? Opened from a card on the dashboard. |
| `/scan/:ean` | Product detail, `scan` mode | Register a purchase after a scan. |
| `/scan/:ean/manual` | Manual entry | Product the catalogue does not know. |
| `/custom-entry` | Custom entry | Product without a barcode. |
| `/settings` | Settings | Theme and scanner diagnostics. |

### One detail screen, two modes

| Mode | Product not in the pantry | Product in the pantry | After saving |
|---|---|---|---|
| `scan` | "Producto nuevo", add it to a location | "Ya existe: X en Y. Se sumarán N", adds N | Back to the scanner with a confirmation, camera off |
| `manage` | "Producto nuevo", add it to a location | Absolute quantity, location, freezer fields, threshold, notes, removal | Back to the previous screen, or the pantry if there is none |

The screen waits for both the product and the inventory before it shows anything, so a product
that is already tracked is never shown as new.

### Where the user goes after an add

| Flow | Destination |
|---|---|
| Scan, then add or sum | The scanner, with "✓ Producto añadido" and the camera off |
| Manual entry | The pantry list of the chosen location, with the confirmation |
| Custom entry | The pantry list of the chosen location, with the confirmation |
| Edit from the list or an alert | The previous screen |

### State

| State | Where | Persisted |
|---|---|---|
| Inventory, products, resolution, shopping list | TanStack Query | No. Stock writes invalidate `["inventory"]`, `["shopping-list"]` and `["review"]`. |
| Active location (pantry or freezer) | `ActiveLocationProvider` | `localStorage["activeLocation"]`. Selects the tab and preselects the location when adding. |
| Theme | `ThemeProvider` | `localStorage["theme"]` |
| Scanner diagnostics | `utils/diagnostics.ts` | `localStorage["scannerDiagnostics"]` |
| Shopping list, including what is picked up | the server (`shopping_list_items`) | Yes, in the database, so two phones agree. Marking and changing an amount are **optimistic**: they show at once and are undone, with a message, if the server refuses |

Every `localStorage` access is wrapped: if storage is blocked the app keeps working in memory and
logs a warning.

### Numbers in the interface

Quantities are typed as text and parsed with `parseDecimal`, which accepts `0,5` and `0.5` and
rejects negatives and more than two decimals. They are shown with `formatQuantity`, which uses a
decimal comma and no thousands separator, so what the user sees can always be typed back.

### The scan modes

The scan screen has three modes. **Detalle** is the original flow: a code opens the product and
the camera stops. In **Compra** and **Gastar** the camera stays on and each code calls
`POST /api/scan` (one unit in or out), answers with a beep, a vibration and a sheet with **Deshacer**.

- `BarcodeCameraScanner` has a continuous mode, chosen per reading through `isContinuous`, so
  changing mode never restarts the camera. The same code seen again within 1.5 s of its last
  sighting is ignored; every sighting renews the window.
- **`consume` is never remembered** between visits (`utils/scanMode.ts`), is shown in the warning
  colour instead of the action green, and has a permanent banner. Taking units out by mistake is
  worse than adding them.
- The shopping session (`hooks/usePurchaseSession.ts`) persists to `localStorage` **synchronously**,
  not from an effect: "Terminar" clears it and leaves the screen in the same click.
- The weekly review freezes its list on load, because each answer refreshes the stock queries and
  the list would otherwise shrink while the user walks through it.

### The scanner

`BarcodeCameraScanner` is a plain class, wrapped by the `useScanner` hook.

- It uses the browser's native `BarcodeDetector` when it exists, and ZXing otherwise (Safari on
  iOS). ZXing decodes one canvas frame at most every 100 ms.
- Each `stop()` invalidates the current start-up. If the user leaves while the camera is still
  opening, the stream that arrives late is released instead of staying on.
- The hook stops the camera when the screen unmounts, when the app goes to the background
  (`visibilitychange`) and on `pagehide`. It never restarts by itself.
- Codes are checked before use: only EAN-8, 12 to 14 digits, or a Mercadona GS1 QR (`/01/<GTIN-14>`)
  are opened. Anything else is shown to the user instead of navigating to a broken route.

### Style

The visual system comes from `.claude/style.md`: dark canvas, one green accent for actions and
live data, 56 px pill buttons, 20 px cards. Tokens are CSS variables in `src/index.css`, exposed to
Tailwind in `tailwind.config.ts`. Radii: `sm` 10 px, `lg` 20 px, `pill` 56 px, `xl` 60 px.

### PWA

`vite-plugin-pwa` generates the manifest and a service worker that precaches the app shell and
serves `/api` with a network-first strategy. The icons come from `scripts/make_pwa_icons.py`.

## Deployment

One image holds the backend and the compiled frontend: `docker/serve_static.py` mounts `dist/`
on the FastAPI app and falls back to `index.html` for client routes. The container runs
`alembic upgrade head` and then uvicorn on port 8100. Traefik terminates TLS. MariaDB runs as a
separate service.

## Decisions worth remembering

| Decision | Why |
|---|---|
| Migrations with Alembic, and no `create_all` on start-up | A schema change must be a reviewed file that can be rehearsed on a copy of the data. |
| The server decides what is "low" | The dashboard uses the API's `low` flag. The pantry dot repeats the rule in `computeStockStatus`, so the two must be changed together: their tests share the cases. |
| One stock row per product | Simplicity for a single household. Lots with their own dates would change this. |
| `422` with a message for freezer fields on a pantry item | The client learns what went wrong instead of the server silently dropping data. |
| The OpenAPI file is committed | A backend test and a frontend test compare it with the application and the TypeScript types, so the two halves cannot drift unnoticed. |
