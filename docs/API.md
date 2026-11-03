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

Changes the fields that are sent. `quantity`, `threshold` and `unit` can be changed but never set
to `null`. `drawer`, `frozen_at` and `notes` can be set to `null` to clear them.

Side effects on the freezer fields:

- Moving to `freezer` without a `frozen_at` sets it to today.
- Moving to `pantry` clears `drawer` and `frozen_at`.
- Changing only the quantity leaves them as they are.

`404` when the product is not tracked.

### `DELETE /api/inventory/{ean}`

Stops tracking the product. Its catalogue entry stays. `204`, or `404`.

## Shopping list

### `GET /api/shopping-list`

The tracked items that are low on stock, as `[{ean, name, quantity, threshold, unit, image_url}]`.
It is a query, not a stored list, so there is nothing to keep in sync.
