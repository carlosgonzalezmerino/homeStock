# Spec 02 · Flujos de alta y ubicación

**Cubre:** F-01, F-02, F-05, F-09, F-10
**Estado:** implementada. Decisión D2 aplicada como propuesta.
**Depende de:** Spec 01 (campos decimales) y Spec 03 (quitar el arranque automático de la cámara)

## Objetivo

Que añadir un producto funcione igual en todos los flujos: siempre se elige la ubicación, siempre se sabe si el producto ya estaba, y al guardar se vuelve a un sitio predecible.

## Situación actual

Estos cinco puntos tienen tres causas comunes.

**1. El selector de ubicación solo aparece si el producto ya está en el inventario.**
`ProductDetail.tsx:80` muestra `TrackedControls` solo con `tracked`, y `useProductEditor.ts:54` añade sin `location`. Esto explica **F-05 y F-09**: gazpacho ofrece ubicación porque ya está en el inventario, mientras que el pepperoni y el queso rallado no. Es coherente con la copia local de la base de datos, donde el gazpacho está en el inventario (6 unidades). Falta confirmarlo con esos dos productos en la app.

**2. La app no recuerda en qué ubicación estás.**
La pestaña es un `useState` local (`Pantry.tsx:65`), que se pierde al salir de la pantalla. Por eso, al volver de un detalle en Congelador, la lista vuelve a Despensa. Y como no hay botón de añadir en la lista, el acceso es la barra inferior, que no lleva ningún contexto. Esto explica **F-10** y parte de **F-01**.

**3. Todos los guardados van a `/scan`.**
`returnToScanWithConfirmation` (`useProductEditor.ts:12`) se usa también en `/despensa/:ean`. Editar una cantidad desde la lista te lleva al escáner y enciende la cámara. `ManualEntry.tsx:112` hace lo mismo, y `CustomEntry.tsx:215` va siempre a `/despensa`.

**Otros problemas relacionados**

- `ProductDetail.tsx:28` no espera a `useInventory`. Mientras carga, un producto del inventario parece nuevo y el POST devuelve 409.
- El stepper en un producto existente es un valor absoluto, así que hoy no hay nada que "sumar" como pide F-02.
- `POST /api/products` con un EAN existente da 500 (`IntegrityError`, `repositories/products.py:33`). Si el producto se crea pero falla el inventario, reintentar falla siempre. El comentario de `CustomEntry.tsx:191` dice que el reintento funciona, pero también vuelve a hacer el POST.
- En "Añadir sin código", elegir un producto que ya está en el inventario acaba en 409 con un error genérico.

## Comportamiento

### Ubicación activa

La app recuerda una **ubicación activa** (`pantry` o `freezer`):

- La cambia la pestaña de la lista, y también guardar un alta.
- Es el valor preseleccionado en todo alta. Sobrevive a la navegación y a recargar.
- Se elige así, y no con parámetros en la URL, porque el acceso principal al escáner es la barra inferior, que no los llevaría.
- Si vienes del inicio con Congelador como última ubicación, se preselecciona Congelador. Es aceptable porque el selector está siempre visible al añadir.

"Añadir sin código" sigue preseleccionando Congelador al crear un producto, como en su spec original.

### Pantalla de producto según el caso

La ruta distingue la intención: `/scan/:ean` es **registrar compra** y `/despensa/:ean` es **gestionar stock**.

| Caso | Aviso | Cantidad | Ubicación | Botón |
|---|---|---|---|---|
| `/scan`, no está en el inventario | "Producto nuevo" | A añadir, empieza en 1 | Selector, con la ubicación activa | "Añadir a {ubicación}" |
| `/scan`, ya está en el inventario | "Ya existe: X {unidad} en {ubicación}. Se sumarán N" | A sumar, empieza en 1 | Selector, con la ubicación actual | "Sumar N" |
| `/despensa`, ya está en el inventario | Ninguno | Absoluta, como hoy | Selector, con la ubicación actual | "Actualizar cantidad" |
| `/despensa`, no está (por ejemplo, recién quitado) | "Producto nuevo" | A añadir | Selector | "Añadir a {ubicación}" |

Además:

- Todas las altas muestran también el umbral, porque F-04 no se cumple si el 0 solo se puede poner después.
- Sumar sigue usando `PATCH` con el total calculado (`X + N`). Con un solo hogar no compensa un endpoint nuevo.
- Mientras cargan el producto o el inventario se muestra un spinner. Si falla el inventario se muestra `ErrorState`, nunca el formulario de "nuevo".

**Producto ya en otra ubicación:** escanear un producto que está en Congelador con Despensa como ubicación activa **no lo mueve solo**. Se preselecciona Congelador y, bajo el selector, se avisa: "Cambiar la ubicación mueve todas las unidades". Es la limitación de una fila por producto, que se mantiene porque F-08 queda fuera de esta iteración.

### Después de guardar (decisión D2)

| Flujo | Destino | Cámara | Aviso |
|---|---|---|---|
| Escaneado reconocido (`/scan/:ean`) | Escáner | Apagada, un toque para volver a activarla | "✓ Producto añadido" |
| Producto manual (`/scan/:ean/manual`) | Lista, en la ubicación elegida | Apagada | "✓ Producto añadido" |
| Sin código (`/custom-entry`) | Lista, en la ubicación elegida | Apagada | "✓ Producto añadido" |
| Edición desde la lista o una alerta (`/despensa/:ean`) | Pantalla anterior; `/despensa` si no hay historial | Apagada | Ninguno |

El escaneado sigue volviendo al escáner para no romper el flujo de la compra, que se diseñó a propósito en `2026-07-23-scan-return-flow-design.md`. F-01 solo se queja del alta manual. Esa spec queda sustituida en un punto: la cámara ya no arranca sola.

### "Añadir sin código"

Elegir un producto del buscador abre `/scan/:ean`, la misma pantalla que un escaneo. Así se resuelve el 409 y desaparece la rama "existing" de `CustomEntry`, que queda solo para crear productos nuevos.

## Cambios

### Backend

- `app/api/products.py`: `POST` con EAN existente devuelve **409** `{"ean": ...}` en lugar de 500.

### Frontend

- `location/ActiveLocationProvider.tsx` (nuevo): contexto más `localStorage`, igual que `ThemeProvider`. Expone `useActiveLocation()`.
- `Pantry.tsx`: la pestaña usa `useActiveLocation` y muestra el aviso de alta.
- `components/StatusToast.tsx` y `hooks/useAddedToast.ts` (nuevos): se extraen de `Scan.tsx` para usarlos también en `Pantry`.
- `components/StockFields.tsx` (nuevo): ubicación, cantidad, umbral y unidad, usado por `ManualEntry`, `CustomEntry` y `ProductDetail`. Hoy hay dos versiones de esos campos, y la Spec 05 añade más.
- `hooks/useProductEditor.ts`:
  - Recibe `mode: "scan" | "manage"`, deducido de la ruta.
  - Sustituye `returnToScanWithConfirmation` por el destino de la tabla.
  - Añade `location` y `threshold` al alta.
  - Añade `sumQuantity`.
- `ProductDetail.tsx`: espera a ambas consultas y muestra aviso, cantidad y selector según la tabla.
- `ManualEntry.tsx`: omite el `POST /products` en un reintento si ya tuvo éxito, y navega a la lista.
- `CustomEntry.tsx`: elimina la rama de producto existente y corrige el reintento igual.
- `Scan.tsx`: el aviso ya no arranca la cámara. Ese cambio es el de la Spec 03.

## Errores

| Caso | Respuesta |
|---|---|
| 409 en `POST /inventory` (otra sesión lo añadió) | Refresca el inventario y muestra "Este producto ya estaba en el inventario. Revisa la cantidad" sin perder lo escrito |
| 409 en `POST /products` durante un alta manual | Continúa con el `POST /inventory`, porque el producto ya existe |
| Falla el guardado | Mensaje en pantalla, conservando lo escrito |
| `localStorage` no disponible | Usa `pantry` y registra un aviso, como `ThemeProvider` |

## Tests

**Backend**

- `test_create_product_existing_ean_returns_409`

**Frontend**

- `useActiveLocation`: valor por defecto, persiste, valor guardado inválido.
- `ProductDetail`:
  - En `/scan`, no está en el inventario: muestra "Producto nuevo" y selector; el POST lleva `location` y `threshold`.
  - En `/scan`, ya está: muestra "Ya existe" y el PATCH lleva `X + N`.
  - En `/despensa`, ya está: la cantidad es absoluta y el PATCH lleva el valor exacto.
  - No muestra el formulario de nuevo mientras carga el inventario, ni si ha fallado.
- Destinos: un test por cada fila de la tabla "Después de guardar".
- `ManualEntry`: el reintento tras fallar el inventario no repite `POST /products`.
- `CustomEntry`: elegir un producto navega a `/scan/:ean`.
- `Pantry`: conserva la pestaña al volver del detalle.

Los tests actuales de `screens.test.tsx` que comprueban la navegación a `/scan` y la cámara automática cambian con esta spec (líneas 408-460 y 580 en adelante).

## Criterios de aceptación

- [ ] **F-01:** Tras guardar un producto manual o sin código, estoy en la lista de la ubicación elegida, con aviso y sin cámara.
- [ ] **F-01:** Editar una cantidad desde la lista me devuelve a la lista, no al escáner.
- [ ] **F-02:** Antes de guardar veo "Producto nuevo" o "Ya existe: X en {ubicación}. Se sumarán N".
- [ ] **F-02:** Sumar 2 a un producto con 3 unidades deja 5.
- [ ] **F-05:** Pepperoni y queso rallado ofrecen elegir ubicación.
- [ ] **F-09:** Tras escanear puedo elegir Despensa o Congelador antes de añadir.
- [ ] **F-10:** Si estaba en la pestaña Congelador, los altas por escaneo y manual lo preseleccionan.
- [ ] Al volver de un detalle, la lista sigue en la misma pestaña.
- [ ] Reintentar tras un fallo de guardado funciona.

## Fuera de alcance

- Un producto en dos ubicaciones a la vez (F-08, fuera de esta iteración).
- Botón de añadir dentro de la lista.
- Ubicaciones nuevas como frigorífico.

## Verificación (2026-11-02)

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| F-01: alta manual o sin código termina en la lista de la ubicación, con aviso y sin cámara | ✔ | `ManualEntry.test.tsx`, `CustomEntry.test.tsx`, `AppRoutes.flow.test.tsx` |
| F-01: editar desde la lista vuelve a la lista | ✔ | `ProductDetail.test.tsx` (con y sin pantalla anterior), flujo del dashboard |
| F-02: «Producto nuevo» o «Ya existe: X en Y. Se sumarán N» | ✔ | `ProductDetail.test.tsx` |
| F-02: sumar N al existente deja la suma | ✔ | `ProductDetail.test.tsx` (5+2), `AppRoutes.flow.test.tsx` (2+1) |
| F-05 y F-09: se puede elegir ubicación al añadir tras escanear | ✔ | `ProductDetail.test.tsx` |
| F-10: la pestaña Congelador se preselecciona en los altas | ✔ | `AppRoutes.flow.test.tsx`, `ManualEntry.test.tsx` |
| Al volver de un detalle la lista sigue en la misma pestaña | ✔ | `ActiveLocationProvider.test.tsx`, `Pantry.test.tsx` |
| Reintentar tras un fallo funciona | ✔ | `ManualEntry.test.tsx`, `CustomEntry.test.tsx` (el producto no se vuelve a crear) |
| `POST /api/products` con EAN existente da 409 | ✔ | `test_products_duplicates.py` |
| El detalle no muestra «nuevo» mientras carga el inventario | ✔ | `ProductDetail.test.tsx` |

≠ La spec proponía un componente `StockFields` compartido por los tres formularios. **No se hizo**: cada
formulario conserva sus campos y el alta del detalle tiene los suyos (`AddStockFields`). Es duplicación
conocida; extraerla es una mejora, no un requisito.

≠ La causa de F-05 (pepperoni y queso rallado) se dedujo del código, no se reprodujo con esos productos:
no están en la base local.
