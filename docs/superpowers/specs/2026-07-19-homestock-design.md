# homeStock — Design Spec

**Date:** 2026-07-19
**Status:** Approved design, pending implementation plan

## Context

We want a system to scan groceries by barcode (EAN) and maintain a household
inventory, so we know when something needs restocking. Products are added by
scanning a barcode; the system resolves the EAN to product info through a
prioritized lookup chain and stores the EAN→product link locally. The user
sets a per-product minimum threshold; when on-hand quantity drops to or below
it, the item appears on a shopping list.

This is a greenfield project (empty directory, no git history). Target usage:
a phone-first web app used on the home LAN, with the backend running on a home
server.

## Goals

- Scan an EAN with a phone camera and resolve it to product info.
- Resolution order: local DB → Mercadona API (best-effort) → local
  OpenFoodFacts (OFF) subset → manual entry.
- Maintain accurate on-hand quantities with a manual per-product restock
  threshold.
- Show an inventory view and a shopping list (items at/under threshold).
- Store product catalog data (incl. nutrition per 100 g) locally as the single
  source of truth and cache.

## Non-Goals (YAGNI)

- No multi-user accounts or authentication (single household, no login; LAN
  only).
- No consumption-rate prediction — thresholds are manual.
- No separate shopping-list table — it is derived by query.
- No cloud hosting in scope (LAN home server only).

## Architecture

### Overall stack (Approach A — Lean)

- **Backend:** FastAPI + SQLModel (SQLAlchemy) over **SQLite** — single
  process, single-file DB. Suits a single household.
- **Frontend:** React + Vite **PWA** (installable to home screen), TypeScript in
  strict mode, calling the FastAPI JSON API. Barcode scanning via `html5-qrcode`
  (wraps ZXing) using the phone camera.
- **OFF data:** one-time import script loads a filtered subset of the OFF bulk
  export into a `off_products` table in the same SQLite DB.
- **TLS:** `mkcert`-generated local cert trusted on the phone (required for
  browser camera access — see constraint below).

### EAN resolution pipeline (the core)

Tried in strict order with graceful fallback:

```
scan EAN
   │
   ▼
1. Local products table (SQLite)  ──found──▶ return product
   │ miss
   ▼
2. Mercadona API (best-effort)    ──found──▶ write back to local, return
   │ miss / error / timeout
   ▼
3. Local off_products table       ──found──▶ write back to local, return
   │ miss
   ▼
4. Not found → manual entry form  ──save──▶ local product created
```

**Key principle:** the local `products` table is the single source of truth
**and** cache. Every successful external lookup writes back to it, so each EAN
hits the network at most once. Steps 2 and 3 are wrapped so any failure
(timeout, non-200, unexpected JSON, no internet) silently falls through — the
pipeline never crashes on a bad external response.

Two conceptually distinct data layers, joined on EAN:
- **Product catalog** — what a product *is* (name, brand, image, nutrition).
- **Inventory** — what *you have* (quantity, threshold, location).

### Backend components

- `product_resolver` — orchestrates the 4-step pipeline. Single entry point:
  `resolve(ean) -> Product | None`.
- `sources/mercadona.py` — best-effort client, isolated so its quirks don't
  leak. For Hacendado products, Mercadona's internal REST id is derived from
  the EAN; treat this as unreliable — on any failure, fall through to OFF.
- `sources/openfoodfacts.py` — queries the local `off_products` table by EAN.
- `off_import.py` — standalone one-time (re-runnable) script to load the OFF
  subset into SQLite.
- `inventory` — CRUD for stock quantities & thresholds; shopping-list query.
- `api` — FastAPI routers exposing everything as JSON.

## Data Model

SQLite. EAN is the natural key throughout.

### `products` — catalog / cache (one row per known EAN)

| column | type | notes |
|---|---|---|
| `ean` | TEXT PK | the barcode, as scanned |
| `name` | TEXT | product name |
| `brand` | TEXT nullable | e.g. "Hacendado" |
| `description` | TEXT nullable | |
| `image_url` | TEXT nullable | remote URL from source |
| `category` | TEXT nullable | |
| `quantity_desc` | TEXT nullable | pack size text, e.g. "1 L", "500 g" |
| `kcal_per_100g` | REAL nullable | energy per 100 g |
| `fat_per_100g` | REAL nullable | |
| `saturated_fat_per_100g` | REAL nullable | |
| `carbs_per_100g` | REAL nullable | |
| `sugars_per_100g` | REAL nullable | |
| `fiber_per_100g` | REAL nullable | |
| `proteins_per_100g` | REAL nullable | |
| `salt_per_100g` | REAL nullable | |
| `source` | TEXT | `manual` \| `mercadona` \| `openfoodfacts` — provenance |
| `created_at` / `updated_at` | TIMESTAMP | |

### `inventory_items` — on-hand stock (one row per tracked product)

| column | type | notes |
|---|---|---|
| `id` | INTEGER PK | |
| `ean` | TEXT FK → products.ean, UNIQUE | |
| `quantity` | REAL | current on-hand count |
| `threshold` | REAL | restock trigger: `quantity ≤ threshold` ⇒ needs buying |
| `unit` | TEXT | default `units` (e.g. units/L/kg) |
| `location` | TEXT nullable | optional: pantry/fridge/freezer |
| `created_at` / `updated_at` | TIMESTAMP | |

### `off_products` — imported OpenFoodFacts subset (queried only in step 3)

Same useful columns as `products`: `ean` (PK, indexed), `name`, `brand`,
`image_url`, `category`, `quantity_desc`, and the 8 nutrition `*_per_100g`
fields. **Separate table** so re-importing/refreshing the OFF dump never
touches curated `products` or inventory.

### Deliberate choices

- **`REAL` quantities** allow "1.5 kg" / half-units; default UX treats them as
  integers.
- **Nutrition = flat columns** (standard EU label set of 8), all nullable,
  populated best-effort per source. Purely informational (display only) — does
  not feed restock logic.
- **Shopping list is a query, not a table:**
  `SELECT ... FROM inventory_items WHERE quantity <= threshold`. No list to keep
  in sync.
- **`source` field** distinguishes auto-imported vs. hand-curated entries.

## API Surface (FastAPI JSON)

### Scanning / resolution
- `GET /api/resolve/{ean}` — runs the 4-step pipeline. Returns the product
  (written back to local) or `404 {"ean": ...}` to signal manual entry.

### Products (catalog)
- `POST /api/products` — create/enrich a product manually (manual-entry form;
  also used to name a placeholder).
- `GET /api/products/{ean}` — fetch one.
- `PATCH /api/products/{ean}` — edit fields (name, nutrition, etc).

### Inventory
- `GET /api/inventory` — list tracked items with joined product info; optional
  `?low=true` returns only items needing restock.
- `POST /api/inventory` — start tracking an EAN (initial quantity, threshold,
  unit).
- `PATCH /api/inventory/{ean}` — the scan edit screen posts here (adjust
  quantity, threshold, location).
- `DELETE /api/inventory/{ean}` — stop tracking.

### Shopping list
- `GET /api/shopping-list` — the `quantity ≤ threshold` query as a ready-to-shop
  list (name, current qty, threshold, image).

### Scan → edit flow

`GET /api/resolve/{ean}` → if found, open edit screen pre-filled with product +
existing inventory row (or defaults if new) → user adjusts → `PATCH`/`POST`
`/api/inventory`. If `resolve` 404s → manual-entry form → `POST /api/products`
then into the inventory edit screen.

## Frontend (React PWA)

Phone-first installable PWA, bottom-nav, four screens:

1. **Scan** (landing) — live camera via `html5-qrcode`. On decode, calls
   `/api/resolve/{ean}` and routes to edit screen or manual-entry form. Includes
   a manual "type EAN" fallback.
2. **Product edit screen** — post-scan destination. Shows product info (name,
   brand, image, nutrition table) + inventory controls (quantity stepper,
   threshold, unit, location) + save. Handles both "adding groceries" and
   "adjusting stock".
3. **Inventory** — searchable list; each row shows name, image, current qty, and
   a "low" badge when `qty ≤ threshold`. Tap → edit screen.
4. **Shopping list** — filtered view of items needing restock, formatted for the
   store.

**Tech:** React + Vite, `@tanstack/react-query` for server state (caching,
refetch after mutations). PWA manifest + service worker for home-screen install
and offline app-shell (data still needs the LAN server).

## Constraints & Deployment

- **Browser camera requires a secure context (HTTPS).** A phone browser will
  not grant camera access to a plain `http://192.168.x.x` address (only
  `localhost` is exempt). Deployment serves the frontend and proxies the API
  over TLS using a `mkcert` local cert trusted on the phone. This is a required
  setup step, documented in the repo.

## OFF Import (`off_import.py`)

Standalone, run once and re-runnable to refresh:
- Streams/chunks the OFF bulk export (CSV/Parquet) — the full dump is millions
  of rows, so never load it fully into memory.
- Maps/filters to needed columns: `code`→`ean`, `product_name`→`name`,
  `brands`, `image_url`, `categories`, `quantity`→`quantity_desc`, and the 8
  nutrition `*_100g` fields (`energy-kcal_100g`, `fat_100g`,
  `saturated-fat_100g`, `carbohydrates_100g`, `sugars_100g`, `fiber_100g`,
  `proteins_100g`, `salt_100g`).
- Skips rows with no EAN or no name. Upserts into `off_products` (indexed on
  `ean`).
- Idempotent: re-running rebuilds `off_products` without touching `products` /
  `inventory`.

## Error Handling

- **External sources are best-effort.** Mercadona (and any future OFF-remote)
  calls use timeouts; any exception, non-200, or unparseable body ⇒ log and fall
  through to the next step. Never 500 on a bad external response.
- **`resolve` returns a clean 404** (not an error) when nothing is found — a
  normal signal to show manual entry.
- **Validation** via Pydantic on all write endpoints; bad input ⇒ 422 with
  field detail.

## Code Quality & Conventions

Clean-code practices are a first-class requirement, not an afterthought.

### Development discipline
- **TDD (red-green-refactor):** write a failing test first, make it pass, then
  refactor. Especially for the resolver pipeline and shopping-list logic. Follow
  the Superpowers `test-driven-development` skill.

### Backend architecture — layered
- **Routers → Services → Repositories.**
  - *Routers* (`api/`): HTTP concerns only — request/response models, status
    codes, wiring. No business logic.
  - *Services*: business logic (e.g. `product_resolver`, inventory rules,
    shopping-list derivation). Depend on repositories and source clients via
    their interfaces, not on FastAPI or SQL directly.
  - *Repositories*: all DB access (SQLModel queries). The only layer that
    touches the database.
- **Sources behind an interface:** `mercadona` and `openfoodfacts` implement a
  common `ProductSource` protocol (`lookup(ean) -> ProductData | None`) so the
  resolver depends on the abstraction and sources are swappable/mockable.
- **Dependency injection** via FastAPI `Depends` for DB sessions and services,
  so tests can substitute fakes.

### Style & typing
- **Full type hints everywhere** (functions, methods, models) as a coding
  discipline. Pydantic models at every I/O boundary; strict, explicit schemas.
- **Ruff** for linting + formatting (replaces black/isort/flake8). No mypy /
  pre-commit enforcement for now (type hints are written comprehensively but not
  machine-checked; mypy can be added later).
- **Frontend:** TypeScript in **strict** mode; ESLint + Prettier.

### General clean-code principles (applied throughout)
- Small, single-purpose functions and modules; clear names; no dead code.
- Each unit understandable and testable in isolation with well-defined
  interfaces (per the isolation-and-clarity design principle).
- Keep files focused — split when a module starts doing too much.
- Follow the emerging project conventions consistently once established.

## Testing

- Unit tests for the resolver pipeline with **mocked sources**: verify order,
  write-back, and each failure mode falling through correctly.
- Shopping-list query test (threshold boundary: `≤` includes equality).
- API tests via FastAPI `TestClient` against a temp SQLite DB.
- OFF-import test over a tiny fixture file.

## Open Implementation Notes

- Exact Mercadona endpoint shape and OFF export column names could not be
  live-verified in the planning environment (region-locked web access). Because
  both sources are best-effort with graceful fallback, exact response shapes are
  adapted at build time and are not a design risk. Verify the Mercadona product
  endpoint and the current OFF export schema during implementation.
