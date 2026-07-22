# OFF Import — Filtro Mercadona + dedupe por EAN

**Fecha:** 2026-07-22
**Ámbito:** `scripts/off_import.py` y sus tests.

## Objetivo

Modificar el importador de OpenFoodFacts para que, en vez de cargar todo el CSV
en la tabla `off_products`, cargue **solo** las filas de Mercadona y, dentro de
esas, **solo la primera aparición de cada EAN**.

## Definiciones

- **Producto de Mercadona:** fila cuya columna `stores` contiene la subcadena
  "mercadona" (comparación case-insensitive). Si la columna falta o está vacía,
  la fila NO es de Mercadona.
- **Duplicado:** el mismo `ean` aparece en más de una fila (ya filtrada a
  Mercadona) dentro del mismo CSV. Solo se carga la primera aparición; las
  siguientes se descartan (no se recuentan ni sobreescriben).

## Cambios

### `scripts/off_import.py`

- Nueva función pura `_is_mercadona(row: dict[str, str]) -> bool`: devuelve
  `True` si `row.get("stores")` contiene "mercadona" (case-insensitive);
  `False` si es `None`/vacío/no coincide.
- `import_off`: mantener un `seen: set[str]` de EANs cargados en esta ejecución.
  Flujo por fila:
  1. `if not _is_mercadona(row): continue`
  2. `product = parse_row(row)`; `if product is None: continue`
  3. `if product.ean in seen: continue`  (duplicado)
  4. `seen.add(product.ean)`, `session.merge(product)`, `imported += 1`
- `parse_row` no cambia (mapeo puro de campos).
- Se mantiene: drop/recreate de `off_products` al inicio, commits por chunk,
  aislamiento de `products`/`inventory_items`.

### Fixture `tests/scripts/fixtures/off_sample.csv`

Añadir columna `stores` y filas que cubran todos los casos:

- `111` — `stores=Mercadona` → se carga.
- `222` — `stores=Carrefour` → filtrada por tienda.
- `111` (repetido, `stores=Mercadona`, nombre distinto) → saltado por duplicado.
- fila sin `code` → saltada.

### Tests `tests/scripts/test_off_import.py`

- `test_import_off_loads_valid_rows_only`: espera 1 producto (`{"111"}`) y que
  conserve el nombre de la **primera** aparición.
- `test_import_off_is_idempotent_and_isolates_products`: conteo a 1.
- `test_import_off_skips_non_mercadona`: Carrefour no entra.
- `test_import_off_dedupes_by_ean`: dos filas Mercadona mismo EAN → 1 fila,
  gana la primera.
- Tests de `parse_row` intactos.

## No se hace (YAGNI)

- No se filtra por marca (Hacendado, etc.).
- No se dedupe por nombre+marca.
- No se cargan en la tabla `products` (sigue siendo `off_products`).
