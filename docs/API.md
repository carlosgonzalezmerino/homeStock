# API reference

All endpoints live under `/api` and speak JSON. There is no authentication.

The machine-readable description is [openapi.json](openapi.json). It is generated with
`uv run python -m scripts.export_openapi`, and a test fails when it is out of date. When the
server runs, the interactive version is at `/docs`.

## Errors

| Status | When | Body |
|---|---|---|
| `404` | The product or stock row does not exist | `{"detail": {"ean": "..."}}` |
| `409` | The product exists already, or the product is already tracked | `{"detail": {"ean": "..."}}` |
| `422` | The body or a parameter is invalid | FastAPI's list of problems, with the field and the reason |
| `422` | A drawer or a frozen date is sent for an item outside the freezer | `{"detail": {"message": "El cajón y la fecha de congelación solo se aplican a productos del congelador"}}` |
| `422` | `X-HomeStock-Source` carries a value a client may not send | `{"detail": {"message": "Unknown X-HomeStock-Source: ..."}}` |
| `409` | A movement cannot be undone | `{"detail": {"id": 7, "reason": "already_undone" \| "not_tracked" \| "nothing_to_undo"}}` |

`GET /api/resolve/{ean}` is the exception: its `404` body is `{"ean": "..."}`, because a miss is
a normal answer that tells the client to ask for the data.

## Health

### `GET /api/health`

`200` `{"status": "ok"}`

## Resolve a barcode

### `GET /api/resolve/{ean}`

Finds a product by its barcode: the catalogue first, then the imported OpenFoodFacts table.
A product found outside the catalogue is stored in it.

| Status | Body |
|---|---|
| `200` | A [product](#product) |
| `404` | `{"ean": "..."}` |

## Products

### `GET /api/products?q=text`

Searches by name or brand, ignoring case. At most 20 results. An empty `q` returns `[]`.
`q` can have up to 100 characters.

### `POST /api/products`

Creates a product by hand. Its `source` is `manual`.

```json
{ "ean": "8410376003139", "name": "Leche entera", "brand": "Hacendado", "kcal_per_100g": 47 }
```

`ean` and `name` are required. The other fields are optional: `brand`, `description`,
`image_url`, `category`, `quantity_desc` and the eight nutrition values. `201` with the product,
or `409` when the EAN exists.

### `GET /api/products/{ean}` and `PATCH /api/products/{ean}`

Read one product, or edit it. `PATCH` changes only the fields that are sent. `404` when the
product is not in the catalogue.

### Product

| Field | Type | Notes |
|---|---|---|
| `ean` | string | The barcode, or `CUSTOM-XXXXXXXX` for products without one |
| `name` | string | |
| `brand`, `description`, `image_url`, `category`, `quantity_desc` | string or null | |
| `kcal_per_100g`, `fat_per_100g`, `saturated_fat_per_100g`, `carbs_per_100g`, `sugars_per_100g`, `fiber_per_100g`, `proteins_per_100g`, `salt_per_100g` | number or null | |
| `source` | string | `manual`, `openfoodfacts` or `mercadona` |

## Where a change comes from

Every write that changes a quantity leaves a row in the [diary of stock changes](#movements).
Two things tell the diary what it needs to know:

- **`reason`** in the body of `PATCH /api/inventory/{ean}`: `purchase`, `consume`, `waste` or
  `adjust`. It is not a column of the stock row. Left out, a quantity change is an `adjust`. The
  server decides `initial` (first time a product is tracked) and `removed` (a product with stock
  is taken out of the pantry) by itself, so a client cannot send them.
- **`X-HomeStock-Source`** header on `POST`, `PATCH` and `DELETE`: `app`, `scan`,
  `shopping_list`, `device`, `ticket` or `review`. Left out, it is `app`. The server writes
  `migration` and `undo` itself.

## Inventory

### `GET /api/inventory?low=true`

Lists the tracked items, each with its product. With `low=true` only the items that need
restocking are returned.

```json
[
  {
    "inventory": {
      "id": 1, "ean": "8410376003139", "quantity": 0.5, "threshold": 0, "unit": "units",
      "location": "freezer", "drawer": 3, "frozen_at": "2026-11-02", "notes": "Hay 5 muslitos"
    },
    "product": { "ean": "8410376003139", "name": "Pollo", "source": "manual" },
    "low": false
  }
]
```

`low` is true when `quantity == 0` or `quantity < threshold`.

### `POST /api/inventory`

Starts tracking a product that is in the catalogue.

```json
{ "ean": "8410376003139", "quantity": 0.5, "threshold": 0, "unit": "units",
  "location": "freezer", "drawer": 3, "frozen_at": "2026-11-02", "notes": "Hay 5 muslitos" }
```

| Field | Required | Rules |
|---|---|---|
| `ean` | yes | Must exist in the catalogue, or `404` |
| `quantity`, `threshold` | yes | `>= 0`, at most 2 decimals |
| `unit` | no | Defaults to `units` |
| `location` | no | `pantry`, `freezer` or `null` (the pantry) |
| `drawer` | no | 1 to 4. Only for the freezer |
| `frozen_at` | no | Date `YYYY-MM-DD`. Only for the freezer. Defaults to the server's today |
| `notes` | no | At most 500 characters after trimming. Empty becomes `null` |

`201` with the stored row, `404` unknown product, `409` already tracked, `422` invalid.

### `PATCH /api/inventory/{ean}`

Changes the fields that are sent. Also accepts `reason` (see [Where a change comes from](#where-a-change-comes-from)). `quantity`, `threshold` and `unit` can be changed but never set
to `null`. `drawer`, `frozen_at` and `notes` can be set to `null` to clear them.

Side effects on the freezer fields:

- Moving to `freezer` without a `frozen_at` sets it to today.
- Moving to `pantry` clears `drawer` and `frozen_at`.
- Changing only the quantity leaves them as they are.

`404` when the product is not tracked.

### `DELETE /api/inventory/{ean}`

Stops tracking the product. Its catalogue entry **and its history** stay. If there was stock, a
`removed` movement is written first. `204`, or `404`.

## Scan

### `POST /api/scan`

Applies one code read by a scanner: one unit in or one unit out. It is the endpoint of the burst
scan modes of the app, and the one a wall-mounted device would call.

```json
{ "ean": "8410376003139", "mode": "purchase", "location": "freezer" }
```

| Field | Required | Rules |
|---|---|---|
| `ean` | yes | 1 to 64 characters |
| `mode` | yes | `purchase` adds 1, `consume` takes 1 out |
| `location` | no | `pantry` or `freezer`. Only used when a product is created |

The default source is `scan`; the `X-HomeStock-Source` header overrides it (a device sends `device`).

Every outcome is a **`200`**, including an unknown code, so a client never has to handle an
exception to queue it:

| `status` | When | Stock changes |
|---|---|---|
| `applied` | The product was tracked and the stock changed | yes |
| `created` | `purchase` of a catalogue product that was not tracked. It starts with quantity 1, the default threshold (2) and the default unit | yes |
| `already_empty` | `consume` of a product at 0 | no |
| `not_tracked` | `consume` of a known product that is not in the pantry. **It is never created** | no |
| `unknown` | Nobody knows the code: not the catalogue, not OpenFoodFacts | no |

`consume` takes 1, or what is left if it is less than 1; the stock never goes below 0.

```json
{ "status": "applied", "mode": "consume", "ean": "8410376003139", "name": "Leche",
  "image_url": null, "quantity_before": 3, "quantity_after": 2, "unit": "units",
  "movement_id": 41, "low": false }
```

`movement_id` is what [undo](#post-apimovementsidundo) needs. A product that reaches 0 is on the
[shopping list](#shopping-list) by itself.

## Movements

The diary of stock changes. It is insert-only: rows are never edited or deleted.

### `GET /api/movements`

Newest first. Query: `ean`, `reason`, `limit` (1 to 200, default 50), `offset`.

```json
[{ "id": 41, "ean": "8410376003139", "delta": -1, "quantity_after": 2, "reason": "consume",
   "source": "scan", "price": null, "undoes_id": null, "undone": false,
   "created_at": "2026-11-03T18:20:11" }]
```

`undone` says whether another movement has reverted this one. A movement's `delta` is never 0.

### `GET /api/movements/last`

The most recent movement, or `null` when the diary is empty.

### `POST /api/movements/{id}/undo`

Reverts a movement by **writing a compensating one** (`reason` `adjust`, `source` `undo`,
`undoes_id` pointing at the original). Nothing is deleted, so undoing an undo works.

- The stock never goes below 0: if the stock already fell, the compensating `delta` is the real
  one.
- Undoing an `initial` movement that leaves the product at 0 **stops tracking it**, so a mistaken
  first scan does not leave an empty product on the shopping list.
- `404` unknown id. `409` with `reason`: `already_undone`; `not_tracked` (the product was taken
  out of the pantry); `nothing_to_undo` (the stock would not change).

## Weekly review

### `GET /api/review`

Up to 10 products worth asking about, in the order to ask: first those that, at the user's own
pace, should have run out; then those untouched for a long time. See the
[spec](Features/v0.3/04-repaso-semanal.md) for the exact rules.

```json
[{ "ean": "8410376003139", "name": "Leche", "brand": "Hacendado", "image_url": null,
   "quantity": 2, "unit": "units", "reason": "overdue",
   "estimated_empty_on": "2026-10-30", "days_since_activity": 20 }]
```

`reason` is `overdue` or `stale`. `estimated_empty_on` is only set for `overdue`. The list is empty
while there is not enough history, which is normal on a database that was just migrated.

### `POST /api/review/{ean}/confirm`

Records that the stock of a product was checked and is real (`checked_at`), so it is not asked
again right away. **Writes no movement**: nothing changed. `204`, or `404` when not tracked.

Correcting a quantity during the review is a plain `PATCH /api/inventory/{ean}` with
`reason` `consume` or `purchase` and `X-HomeStock-Source: review`.

## Shopping list

### `GET /api/shopping-list`

The tracked items that are low on stock, as `[{ean, name, quantity, threshold, unit, image_url}]`.
It is a query, not a stored list, so there is nothing to keep in sync.
