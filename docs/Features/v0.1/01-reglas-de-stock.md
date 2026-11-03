# Spec 01 · Reglas de stock y cantidades

**Cubre:** F-03 (decimales), F-04 (umbral 0)
**Estado:** implementada. Tests de backend y frontend. Decisión D1 aplicada como propuesta.
**Depende de:** nada. Es la primera spec porque las demás usan sus reglas y su formato de cantidades.

## Objetivo

Que cantidades y umbrales acepten decimales y 0, y que backend y frontend usen **una sola definición** de "stock bajo".

## Situación actual

| Hecho | Dónde | Consecuencia |
|---|---|---|
| El backend marca bajo con `quantity < threshold` | `app/api/inventory.py:30`, `app/repositories/inventory.py:24` | Decisión deliberada del commit `8eb5f71` |
| El frontend marca bajo con `quantity <= threshold` | `frontend/src/utils/stock.ts:14` | Se quedó sin cambiar. Con cantidad 2 y umbral 2 la tarjeta sale en amarillo, pero no hay alerta |
| Con umbral 0, `0 < 0` es falso | Backend | Un producto con umbral 0 **nunca** avisaría, justo lo contrario de lo que pide F-04 |
| `max = threshold * 2` da 0 con umbral 0 | `Dashboard.tsx:133`, `LevelBar.tsx:15` | `0/0` produce `width: NaN%` |
| `parseWholeNumber` trunca: `"0,5"` → 0 | `ManualEntry.tsx:87`, `CustomEntry.tsx:250` | Se guarda un valor distinto sin avisar |
| `min: 1` también en la cantidad | `ManualEntry.tsx:218` | Rechaza 0,5 aunque se cambie el parser |
| `parseFloat("12,5")` → 12 | `utils/parse.ts:12` | Mismo problema en los valores nutricionales |
| El − solo se desactiva en `value === 0` | `QuantityStepper.tsx:49` | Desde 0,5 el − da **-0,5** |
| `InventoryCreate` y `InventoryPatch` no validan rangos | `app/schemas.py:47-60` | La API acepta cantidades negativas. Un `null` explícito en `quantity` acaba en error 500 |

## Reglas

### R1. Stock bajo (decisión D1)

```
bajo = quantity == 0  OR  quantity < threshold
```

| Cantidad | Umbral | Estado | ¿Alerta y lista de la compra? |
|---|---|---|---|
| 0 | 0 | agotado | sí |
| 0,5 | 0 | ok | no |
| 2 | 2 | ok | no |
| 1 | 2 | bajo | sí |
| 0,5 | 1 | bajo | sí |

Mantiene la decisión de `8eb5f71`: estar justo en el umbral no es estar bajo. Y cumple F-04: con umbral 0 solo avisa cuando se agota.

Con unidades enteras, los umbrales 0 y 1 se comportan igual. Solo se diferencian con decimales.

### R2. Formato de números

- **Entrada:** se aceptan `0,5` y `0.5`, hasta 2 decimales y nunca negativos.
- **Inválido:** muestra un error y no guarda. Se elimina el valor de respaldo silencioso.
- **Vacío:** cantidad y umbral son obligatorios. Los valores nutricionales pueden quedar vacíos.
- **Salida:** coma decimal y sin ceros sobrantes (`0,5`, `2`, `1,25`), con `Intl.NumberFormat("es-ES")`.
- **Campos:** `type="text"` con `inputMode="decimal"`. `type="number"` no es fiable con la coma en Safari de iOS.

### R3. Stepper

- `+` suma 1 y `−` resta 1, con mínimo 0: desde 0,5, el − da 0.
- El resultado se redondea a 2 decimales para evitar errores como `0.30000000000000004`.
- En la pantalla de detalle, el valor central se puede editar para escribir `0,5`. En las filas de la lista sigue siendo solo texto, porque tocar el producto ya abre el detalle.

## Cambios

### Backend

- `app/models.py`: propiedad `InventoryItem.is_low`, con la regla R1 en Python.
- `app/repositories/inventory.py`: `list_low` usa `or_(quantity == 0, quantity < threshold)`.
- `app/api/inventory.py:30`: usa `item.is_low`.
- `app/schemas.py`:
  - `quantity` y `threshold` con `Field(ge=0, allow_inf_nan=False)`.
  - `location` validada como `Literal["pantry", "freezer"] | None`. La columna sigue siendo texto, así que añadir otra ubicación solo cambiará el esquema.
  - `InventoryPatch` rechaza `null` explícito en `quantity`, `threshold` y `unit` con 422.

### Frontend

- `utils/stock.ts`: `computeStockStatus` aplica R1 y su docstring se corrige.
- `utils/parse.ts`: nueva `parseDecimal(raw): number | null`. `parseOptionalDecimal` se apoya en ella y se elimina `parseWholeNumber`.
- `utils/format.ts` (nuevo): `formatQuantity(value): string`.
- `QuantityStepper`: limita a 0, redondea, muestra con `formatQuantity` y añade la prop `editable`.
- `LevelBar`: `computeFillPercentage` devuelve 0 cuando `max <= 0`.
- `Dashboard.tsx`: el badge usa `computeStockStatus`, porque ahora una cantidad 0 sale siempre como `low`. La cantidad usa `formatQuantity`.
- `ManualEntry` y `CustomEntry`: umbral con mínimo 0 y cantidad con mínimo 0.
- `ProductDetail.tsx:221`: el texto pasa a "Recibirás alerta cuando baje de este valor o se agote".

## Errores

| Caso | Respuesta |
|---|---|
| Texto no numérico en el formulario | "Introduce un número mayor o igual que 0, por ejemplo 0,5" |
| Más de 2 decimales | Mismo mensaje, indicando "hasta 2 decimales" |
| Valor negativo o `null` directo a la API | 422 con el campo afectado |

## Tests

**Backend**

- `test_is_low_at_threshold_returns_false`
- `test_is_low_zero_quantity_zero_threshold_returns_true`
- `test_list_low_zero_threshold_only_returns_empty_items`
- Una tabla con los casos de R1 que compruebe que `is_low` y `list_low` dan el mismo resultado.
- `test_create_inventory_negative_quantity_returns_422`
- `test_patch_inventory_null_quantity_returns_422`
- `test_shopping_list_excludes_item_at_threshold` se conserva.

**Frontend**

- `parseDecimal`: `"0,5"`, `"0.5"`, `"0"`, `""`, `"abc"`, `"-1"`, `"1,234"`.
- `formatQuantity`: `0.5` → `"0,5"`, `2` → `"2"`.
- `computeStockStatus`: los mismos casos de R1.
- `QuantityStepper`: − desde 0,5 da 0; + desde 0,5 da 1,5.
- `computeFillPercentage(0, 0)` devuelve 0.

## Criterios de aceptación

- [ ] Puedo guardar 0,5 y 0.5 como cantidad y como umbral, y se muestran como `0,5`.
- [ ] Un valor inválido muestra un error y no guarda nada.
- [ ] Con umbral 0 el producto solo aparece en alertas y en la lista de la compra cuando la cantidad es 0.
- [ ] Con cantidad igual al umbral, ni la lista ni las alertas lo marcan como bajo.
- [ ] Una alerta con umbral 0 no rompe la barra de nivel.
- [ ] El − nunca produce una cantidad negativa.
- [ ] La API rechaza negativos con 422.

## Fuera de alcance

- Traducir la unidad `units` que hoy se muestra en inglés.
- Pasos de stepper distintos de 1.

## Verificación (2026-11-02)

Leyenda: ✔ demostrado por un test · ⚠ no verificado · ≠ desviación de la spec.

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| Guardar 0,5 y 0.5, mostrar `0,5` | ✔ | `parse.test.ts`, `format.test.ts`, `ManualEntry.test.tsx` (cantidad 0,5), `Pantry.test.tsx` (se muestra «0,5») |
| Valor inválido: error y no guarda | ✔ | `ManualEntry.test.tsx` (negativo, 3 decimales, vacío, nutrición), `CustomEntry.test.tsx` |
| Umbral 0: alerta solo con cantidad 0 | ✔ | `test_models.py` (tabla de casos), `test_inventory_validation.py`, `Dashboard.test.tsx` |
| Cantidad igual al umbral no es baja | ✔ | `test_models.py`, `test_inventory.py` (repositorio), `test_shopping_list.py`, `utils.test.ts` |
| Alerta con umbral 0 no rompe la barra | ✔ | `Dashboard.test.tsx` (ancho `0%`), `utils.test.ts` (`computeFillPercentage(0, 0)`) |
| El − nunca da una cantidad negativa | ✔ | `QuantityStepper.test.tsx`, `Pantry.test.tsx`, `ProductDetail.test.tsx` |
| La API rechaza negativos con 422 | ✔ | `test_inventory_validation.py` |

Las dos definiciones de «bajo» del servidor (propiedad Python y condición SQL) se comprueban contra la
misma tabla de casos, y el frontend usa los mismos casos en `computeStockStatus`.

**Añadido durante la verificación:** `formatQuantity` agrupaba los miles (`12345` se mostraba `12.345`) y el
propio campo editable rechazaba ese texto al releerlo. Ahora no agrupa; lo cubre un test de ida y vuelta.
