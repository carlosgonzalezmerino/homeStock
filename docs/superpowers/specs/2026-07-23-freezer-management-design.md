# Freezer Management — Design Spec

**Date:** 2026-07-23  
**Status:** Approved

## Overview

Extend homeStock to track products in the freezer alongside the pantry. The freezer supports both barcode-scanned products and custom items without a barcode (e.g., tupperware of meatballs, butcher chicken). The same scan/add flow is used for both locations; the user simply selects where an item lives.

---

## Data Model

**No schema changes required.** `InventoryItem.location: str | None` already exists.

Convention:
- `null` or `"pantry"` → pantry (despensa)
- `"freezer"` → freezer (congelador)

The backend accepts `location` in both `InventoryCreate` and `InventoryPatch` — no backend model changes needed.

**Custom items (no barcode):** The frontend generates a synthetic EAN `CUSTOM-` + 8 random alphanumeric chars before calling `POST /api/products`. The product is created with `source="manual"`. The user never sees the generated ID.

---

## Backend Changes

**One new endpoint:** `GET /api/products?q=<text>`

- Searches the `products` table by name and brand (case-insensitive, partial match).
- Returns `list[ProductOut]`.
- Used by the product search step in the custom-item flow.
- Limit results to 20 to keep responses light.

No other backend changes. All other endpoints are consumed as-is.

---

## Frontend Changes

### `Pantry.tsx`
- Add tabs "Despensa / Congelador" at the top of the screen (local state, not URL).
- Filter `data` by `inventory.location`: tab "Despensa" shows items where `location` is `null` or `"pantry"`; tab "Congelador" shows items where `location === "freezer"`.
- Empty state message adapts to active tab.

### `Scan.tsx`
- Add a secondary button "Añadir sin código" below the scanner. Navigates to the new `CustomEntry` screen.

### New screen: `CustomEntry.tsx`
Two-step flow:

**Step 1 — Search or create:**
- Text input that calls `GET /api/products?q=` with debounce (300 ms).
- Results list: tapping a result selects it and advances to step 2.
- "Crear nuevo" button (always visible below results, or when results are empty) navigates to step 2 with no pre-selected product — user fills in name, brand, optional nutrition.
- If creating new: frontend generates `CUSTOM-xxxxxxxx` EAN, calls `POST /api/products`, then proceeds.

**Step 2 — Quantity and location:**
- Selector: Despensa / Congelador (default: Congelador, since this flow is accessed from the freezer context).
- Quantity (initial stock) and threshold inputs.
- Unit input.
- Submit calls `POST /api/inventory` with the selected/created EAN and chosen location.
- On success, navigate back to Pantry with the active tab set to the chosen location.

### `ManualEntry.tsx`
- Add a location selector (Despensa / Congelador, default: Despensa) to the existing form.
- Pass `location` to `POST /api/inventory` on submit.

### `ProductDetail.tsx`
- Add a location selector in the inventory details section.
- Changing the value immediately calls `PATCH /api/inventory/{ean}` with `{ location }`.

### `api/products.ts`
- Add `searchProducts(q: string): Promise<ProductOut[]>` calling `GET /api/products?q=`.

### `hooks/`
- Add `useSearchProducts(q: string)` using TanStack Query with `enabled: q.length >= 2`.

### `types.ts`
- Add `export type Location = "pantry" | "freezer"` as a frontend-only convention.

### `App.tsx`
- Add route `/custom-entry` → `<CustomEntry />`.

---

## Navigation Flow

```
Scan screen
├── [scan barcode] → ProductDetail (existing flow) → location selector added
├── [EAN not found] → ManualEntry (existing) → location selector added
└── [Añadir sin código] → CustomEntry
    ├── [select existing product] → step 2 (qty + location)
    └── [crear nuevo] → fill name/brand → step 2 (qty + location)
                                          └── success → Pantry (tab = chosen location)
```

---

## Out of Scope

- Expiry / caducidad dates — not part of this feature.
- Freezer-specific fields (freeze date, portions) — can be added later.
- Multiple locations beyond pantry/freezer — future work; location field stays as string for extensibility.
- Shopping list integration for freezer items — existing shopping list logic unchanged.
