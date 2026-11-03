# Spec 04 · Lista de la compra manual

**Sustituye a:** [Spec 01](01-lista-de-la-compra.md) (N-01), que queda reemplazada.
**Estado:** implementada (2026-11-03), con las propuestas L1 a L6 como decisiones. Ver [Verificación](#verificación-2026-11-03).
**Toca la BD:** **sí**. Tabla nueva, migración con Alembic.
**Depende de:** nada. Se implementó **después** de la v0.3, así que su migración es la `0005`.

## Por qué se rehace

La Spec 01 implementó una lista **derivada**: es una consulta sobre el stock, y todo lo que está en
stock bajo aparece solo. Eso no es lo que se quería. Lo que se quiere es una lista **propia**:

- La lista contiene **solo lo que tú añades**.
- Lo que añades sale **del catálogo de productos** (`products`).
- Que algo esté a cero en la despensa **no lo mete** en la lista.
- La lista es lo que hay que comprar. Punto.

El cambio de fondo es de modelo: la lista pasa de ser una consulta a ser **datos guardados**.
Por eso necesita tabla, y por eso ya no es «solo frontend».

## Punto de partida

Lo que hay hoy y qué le pasa:

| Pieza | Hoy | Con esta spec |
|---|---|---|
| `GET /api/shopping-list` | Devuelve el stock bajo (`InventoryRepository.list_low`) | Devuelve la lista guardada. **Cambia el esquema de respuesta** |
| `ShoppingListService` | Deriva de `list_low` | Gestiona la tabla nueva |
| `ShoppingListItemOut` | `ean`, `name`, `quantity`, `threshold`, `unit`, `image_url` | Ver [Esquemas](#esquemas) |
| `suggestedPurchase` (`utils/shopping.ts`) | Calcula `umbral − cantidad` | **Se elimina**. Ya no se sugiere nada |
| `useCheckedItems` + `localStorage["shoppingChecked"]` | Guarda las marcas en el navegador | **Se elimina**. La marca se guarda en el servidor |
| `screens/ShoppingList.tsx` | Lista derivada, `PATCH` por línea | Se reescribe |
| `useSearchProducts` y `GET /api/products?q=` | Existen | **Se reutilizan** para elegir del catálogo |

`computeStockStatus`, `is_low` y la regla de stock bajo **no se tocan**. Las alertas de stock bajo
de la v0.1 siguen existiendo; simplemente ya no alimentan la lista.

## Modelo de datos

### Tabla `shopping_list_items`

Una fila por producto en la lista.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | integer, clave primaria | |
| `ean` | text, requerido | Clave foránea a `products.ean`, **única**, indexada |
| `quantity` | float, requerido | Cuánto hay que comprar. `> 0`, máximo 2 decimales |
| `checked` | boolean, requerido | `false` por defecto. «Ya lo he cogido» |
| `created_at`, `updated_at` | datetime | |

Decisiones de modelo, con su motivo:

- **Una fila por EAN (`unique`).** Igual que `inventory_items`: un producto no aparece dos veces.
  Añadir uno que ya está **suma** a su cantidad (ver [L1](#decisiones)).
- **Referencia a `products`, no a `inventory_items`.** La lista admite cualquier producto del
  catálogo, esté o no en la despensa. Es lo que pediste, y además permite apuntar algo que aún no
  has comprado nunca pero ya conoces.
- **`quantity` es lo que se compra, no lo que queda.** El stock actual no se guarda aquí; se une
  al leer, solo para mostrarlo.
- **`checked` en el servidor, no en `localStorage`.** Sobrevive a recargas, a borrar datos del
  navegador y se ve igual desde el móvil y desde el ordenador (ver [L3](#decisiones)).

### Migración

Una migración nueva que **solo crea** la tabla. No modifica ni borra datos existentes.

- **Número de revisión: `0005`** (`down_revision = "0004"`). La v0.3 ya había ocupado `0003` y
  `0004`. Las recetas ([Spec 03](03-recetas.md)) pasarían a `0006`.
- Ensayo sobre una copia y copia de seguridad antes, como manda `docs/DATABASE.md`.
- `downgrade` borra la tabla; los datos de la lista se pierden. Se dice en el docstring.
- Se actualiza `docs/DATABASE.md` (tabla y fila de migraciones).

## API

Todas bajo `/api/shopping-list`. Los errores siguen el estilo del resto (`detail` con el `ean`).

| Método y ruta | Qué hace | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /api/shopping-list` | La lista, con el stock actual de cada producto | — | `200` lista de `ShoppingListItemOut` |
| `POST /api/shopping-list` | Añade un producto del catálogo | `{ ean, quantity? }` | `201` el ítem. `200` si ya estaba y se sumó. `404` si el EAN no está en `products` |
| `PATCH /api/shopping-list/{ean}` | Cambia la cantidad o la marca | `{ quantity?, checked? }` | `200` el ítem. `404` si no está en la lista |
| `DELETE /api/shopping-list/{ean}` | Quita un producto de la lista | — | `204`. `404` si no estaba |
| `POST /api/shopping-list/purchase` | Registra lo marcado como comprado | — | `200` resumen. Ver abajo |

### `POST`: añadir

- `quantity` por defecto **1**.
- Si el EAN **ya está** en la lista, no es error: se **suma** `quantity` a la existente y se
  devuelve `200` en lugar de `201`. Así «añadir» es idempotente en intención y el botón del detalle
  no necesita saber si ya estaba.
- El EAN debe existir en `products`. Si no, `404` con `{ "ean": ... }`, como `GET /products/{ean}`.

### `POST /purchase`: registrar la compra

Es la operación que reemplaza a los N `PATCH` de la Spec 01. Se hace **en el servidor, en una
transacción**, porque ahora la lista también está en el servidor.

Para cada ítem con `checked = true`:

1. Si el producto **tiene fila de inventario**: `quantity += item.quantity`.
2. Si **no la tiene**: se crea con `quantity = item.quantity`, `threshold = 0`, `unit = units`,
   `location = null` (despensa). Ver [L2](#decisiones).
3. El ítem se **borra** de la lista.

Los no marcados no se tocan. Si no hay ninguno marcado, devuelve `200` con cero y no hace nada.

La escritura de inventario pasa por `InventoryService`, nunca directa al repositorio. Es lo que
permite que el registro de movimientos de v0.3 lo recoja sin cambiar esta spec: allí ya está
previsto `reason = purchase`, `source = shopping_list`.

Respuesta: `{ "added": N, "created": M }`, con `created` los que no estaban en el inventario.
**Es todo o nada**: si falla uno, no se aplica ninguno y la lista queda como estaba. Esto elimina el
«fallo parcial» de la Spec 01.

### Esquemas

`ShoppingListItemOut` (cambia):

| Campo | Tipo | Notas |
|---|---|---|
| `ean` | string | |
| `name` | string | Del producto |
| `brand` | string, opcional | Ayuda a distinguir dos productos de nombre parecido |
| `image_url` | string, opcional | |
| `quantity` | float | **A comprar** (antes era el stock) |
| `checked` | boolean | |
| `in_stock` | float, opcional | Lo que hay ahora en la despensa. `null` si no está en inventario |
| `unit` | string | Del inventario si existe; `units` si no |

`ShoppingListItemCreate`: `ean` y `quantity` (`> 0`, 2 decimales como mucho).
`ShoppingListItemPatch`: `quantity` y `checked`, ambos opcionales, `quantity` no admite `null`.
Las validaciones reutilizan `check_max_decimals` y `reject_null` que ya existen en `schemas.py`.

> Hay que ejecutar `uv run python -m scripts.export_openapi` y actualizar `docs/API.md`. Este
> cambio **rompe** el esquema de `GET /api/shopping-list`; el frontend y `contract.test.ts` se
> actualizan en el mismo paso.

## Backend

| Archivo | Cambio |
|---|---|
| `app/models.py` | `ShoppingListItem` |
| `alembic/versions/` | Migración que crea la tabla |
| `app/repositories/shopping_list.py` | Nuevo. Acceso a la tabla: listar, obtener, crear, actualizar, borrar |
| `app/services/shopping_list.py` | Se reescribe: añadir (con suma), actualizar, quitar, `purchase` |
| `app/api/shopping_list.py` | Los cinco endpoints |
| `app/api/deps.py` | Cablear el repositorio nuevo en `get_shopping_list_service`. Sin más inyección |
| `app/schemas.py` | Los esquemas de arriba |
| `app/constants.py` | `SHOPPING_DEFAULT_QUANTITY = 1`, `SHOPPING_PURCHASE_THRESHOLD = 0` |

`InventoryRepository.list_low` **se conserva**: lo usan las alertas.

Excepciones específicas para el servicio (`ProductNotFound` ya existe; añadir
`ShoppingItemNotFound`), traducidas a `404` en el router. Nada de `except Exception`.

## Frontend

### Pantalla `/lista`

Se mantiene la ruta y la pestaña «Lista» (ya hay cinco en `BottomNav`).

De arriba a abajo:

1. **Buscador del catálogo** fijo arriba: «Añadir a la lista…». Reutiliza `useSearchProducts`.
   Los resultados salen debajo con miniatura, nombre y marca. Pulsar uno lo añade con cantidad 1 y
   cierra los resultados. El buscador se vacía.
2. **La lista.** Cada línea:
   - Casilla «cogido». Marcar tacha la línea y la baja al final (como ya hacía la Spec 01).
   - Miniatura y nombre (pulsar abre `/despensa/{ean}`; si el producto no está en inventario,
     abre el detalle de producto igualmente, ver [L5](#decisiones)).
   - **Stepper de cantidad** `− n +`. En 1, el «−» pasa a ser quitar.
   - Una línea de apoyo: `En casa: 2` o `No está en la despensa`.
   - Quitar con un gesto accesible (botón con nombre accesible, no solo deslizar).
3. **Botón fijo abajo (`sticky`, como en la Spec 01):** «Añadir al stock (N)», con N las marcadas.
   Deshabilitado con N = 0. Llama a `POST /purchase`.

### Añadir desde el resto de la aplicación

El catálogo se navega desde más sitios que la pantalla de la lista:

- **Detalle del producto** (`/despensa/:ean`): botón «Añadir a la lista». Si ya está, muestra
  «En la lista (2)» y pulsarlo suma 1.
- Resto de sitios (despensa, alertas): **fuera de esta spec**, ver [Fuera de alcance](#fuera-de-alcance).

### Estados

| Estado | Qué se ve |
|---|---|
| Cargando | `Spinner` |
| Error | `ErrorState` con reintento |
| Lista vacía | `EmptyState`: «Tu lista está vacía. Busca un producto para añadirlo» |
| Sin resultados en el buscador | «Nada en tu catálogo con ese nombre» + enlace a crear producto |
| Compra registrada | `StatusToast`: «Compra añadida» |

La **lista vacía** deja de significar «no falta nada». Ahora significa que no has apuntado nada.

### Datos y caché

- `queryKeys`: la clave `["shopping-list"]` se mantiene.
- Mutaciones nuevas en `useMutations.ts`: añadir, actualizar, quitar, comprar. Todas invalidan
  `["shopping-list"]`; `purchase` invalida además `["inventory"]`.
- **Ya no hace falta** que las escrituras de inventario invalidasen `["shopping-list"]` para
  recalcular la lista; solo la afectan para refrescar `in_stock`. Se deja tal cual: es inofensivo
  y evita un `in_stock` desfasado.
- **Actualización optimista** para marcar y para el stepper: es el gesto que más se repite en la
  tienda y no puede esperar la red. Si falla, se revierte y se avisa.

### Archivos

| Archivo | Cambio |
|---|---|
| `screens/ShoppingList.tsx` | Reescrita |
| `api/shoppingList.ts` | Añadir, actualizar, quitar, comprar |
| `hooks/useShoppingList.ts`, `hooks/useMutations.ts` | Mutaciones nuevas |
| `types.ts` | `ShoppingListItemOut` nuevo y los tipos de entrada |
| `screens/ProductDetail*.tsx` | Botón «Añadir a la lista» |
| `utils/shopping.ts` | `suggestedPurchase` fuera. `sortByChecked` se queda |
| `hooks/useCheckedItems.ts` y su test | **Se borran** |

Y los docs: `docs/ARCHITECTURE.md` (pantalla y la fila de `useCheckedItems` en estado local),
`docs/API.md`, `docs/DATABASE.md`, `README.md` si la menciona, y los estados de
[`README`](README.md) y de la Spec 01.

## Tests

Backend, con el patrón `test_<método>_<escenario>_<resultado>`:

- Añadir un producto del catálogo lo crea con cantidad 1 y `checked` falso.
- Añadir con cantidad explícita la respeta.
- Añadir uno que ya está **suma** y devuelve `200`.
- Añadir un EAN que no está en `products` devuelve `404`.
- Cantidad `0`, negativa, con tres decimales o `NaN` se rechaza.
- `PATCH` cambia la cantidad; cambia `checked`; un `quantity: null` se rechaza; EAN ausente `404`.
- `DELETE` quita; EAN ausente `404`.
- `GET` devuelve **solo** lo añadido. Un producto con stock 0 y **sin** añadir **no aparece**
  (es el test que prueba que desapareció el relleno automático).
- `GET` trae `in_stock` con el valor del inventario, y `null` si el producto no está en él.
- `purchase` suma al stock existente lo marcado y borra esas líneas de la lista.
- `purchase` crea la fila de inventario con `threshold = 0` si no existía y cuenta en `created`.
- `purchase` no toca lo no marcado.
- `purchase` sin nada marcado devuelve ceros y no escribe.
- `purchase` con un fallo a medias no aplica nada (transacción).
- La migración sube y baja sobre una copia sin perder las otras tablas.

Frontend:

- Vacía: muestra el mensaje de lista vacía, **no** «No falta nada».
- Escribir en el buscador y pulsar un resultado llama al `POST` con ese EAN.
- Marcar tacha y baja al final; la marca llama al `PATCH`.
- El stepper cambia la cantidad; en 1, «−» quita la línea.
- El botón de comprar está deshabilitado sin marcas y muestra el número cuando las hay.
- Pulsar comprar llama a `POST /purchase` y refresca lista e inventario.
- Un error de carga muestra el reintento. Un fallo del `PATCH` revierte la marca.
- Cada casilla y cada botón tiene nombre accesible con el nombre del producto.
- El botón del detalle añade, y pasa a «En la lista (n)».
- `contract.test.ts` y `endpoints.test.ts` con el esquema nuevo.

## Criterios de aceptación

- [ ] La lista empieza vacía y **solo contiene lo que yo añado**.
- [ ] Un producto con stock 0 o bajo **no** entra en la lista por sí solo.
- [ ] Puedo buscar en mi catálogo y añadir un producto en un toque.
- [ ] Puedo cambiar la cantidad a comprar y quitar un producto.
- [ ] Puedo apuntar un producto del catálogo que no está en mi despensa.
- [ ] Puedo marcar lo que voy cogiendo y la marca aguanta una recarga y se ve en otro dispositivo.
- [ ] «Añadir al stock» suma lo marcado a la despensa y lo quita de la lista, todo o nada.
- [ ] Desde el detalle de un producto puedo añadirlo a la lista.
- [ ] Cada línea muestra cuánto tengo en casa.
- [ ] Migración ensayada en una copia, con copia de seguridad, y `openapi.json` regenerado.

## Fuera de alcance

| Qué | Por qué |
|---|---|
| **Ítems sueltos** que no son del catálogo («bolsas de basura») | Es D3. Esta spec exige EAN. Se puede relajar después con `ean` opcional y `name`, pero es otra migración |
| Sugerir o rellenar desde el stock bajo | Lo contrario de lo pedido. Si algún día se quiere, sería un botón explícito «Ver lo que falta», nunca automático |
| Añadir a la lista desde la despensa, las alertas o el escáner | Es N-09 y cada punto de entrada es su propia decisión de interfaz |
| Varias listas, o listas por tienda | Una lista para una casa |
| Orden por categoría o pasillo | Es N-03 |
| «Añadir lo que falta» desde recetas | Spec 03. Esta spec lo desbloquea para productos del catálogo; los ingredientes sin EAN siguen esperando a D3 |
| Compartir en tiempo real | La aplicación no tiene usuarios, por diseño |
| Historial de compras | Lo cubre el registro de movimientos de v0.3 |

## Decisiones

Propuestas mías, para que las confirmes o cambies. Ninguna está tomada.

| # | Pregunta | Mi propuesta |
|---|---|---|
| **L1** | Añadir algo que ya está en la lista: ¿suma, o avisa de que ya está? | **Suma** `+quantity`. Es lo que esperas al pulsar «añadir» dos veces, y evita un error que no aporta nada |
| **L2** | Al registrar la compra de un producto que **no está en inventario**: ¿se crea con qué umbral? | **Se crea con umbral 0**: solo avisa de stock bajo cuando llega a 0. Es el valor menos intrusivo. El umbral se ajusta luego en el detalle. La alternativa, pedirlo en ese momento, rompe el flujo de «estoy en casa descargando la bolsa» |
| **L3** | ¿Dónde se guarda «cogido»: servidor o navegador? | **Servidor**. Lo que cambiaste respecto a la Spec 01 (`localStorage`) es que la lista ahora es compartida en datos, y tener dos móviles con marcas distintas sería un fallo. Contra: pierde la resistencia a no tener cobertura en la tienda, que la actualización optimista solo cubre a medias (ver [L6](#decisiones)) |
| **L4** | ¿Registrar la compra con un endpoint o con N `PATCH`? | **Un endpoint**, todo o nada. Antes tenía sentido porque la lista no existía en servidor |
| **L5** | Pulsar un producto de la lista que no está en inventario: ¿a dónde lleva? | **Al detalle en modo gestión**, que ya sabe mostrar un producto sin stock. Hay que comprobar que `/despensa/:ean` acepta un EAN que está en `products` pero no en `inventory_items`; si no lo hace, es un ajuste pequeño a esta spec |
| **L6** | Sin cobertura en la tienda, ¿qué pasa al marcar? | La actualización optimista mantiene la marca en pantalla y, si la petición falla, **se revierte con aviso**. Una cola sin conexión real es N-08 y se pospone. Si la tienda sin red te pasa a menudo, la alternativa es volver a `localStorage` para las marcas |
| D3 | ¿Ítems sueltos fuera del catálogo? | Sigue **pendiente** y fuera de esta spec. Esta es la mitad de lo que pedía D3 (una lista guardada); falta la otra mitad |

L3 y L6 están ligadas: elegir servidor para las marcas es elegir depender de la red al marcar. Es
la decisión que más conviene que mires.

## Verificación (2026-11-03)

**Qué se hizo.** Tabla `shopping_list_items` (migración `0005`); `ShoppingListRepository` y
`ShoppingListService` reescritos; los cinco endpoints; pantalla `/lista` nueva (buscador del catálogo,
stepper, marca, quitar, «Añadir al stock»); botón «Añadir a la lista» en el detalle; se eliminan
`useCheckedItems` y `suggestedPurchase`.

**Decisiones tomadas** (las propuestas de la spec): L1 suma al duplicar · L2 umbral 0 al crear · L3 la
marca vive en el servidor · L4 un único endpoint de compra · L5 el detalle en modo gestión · L6 la
marca es optimista y se revierte con aviso si el servidor falla.

**Cómo se comprobó.**

| Comprobación | Resultado |
|---|---|
| Backend completo | **325 tests**, verdes; cobertura **98 %**; los cuatro ficheros de la lista al 100 % |
| Frontend completo | **556 tests**, verdes; cobertura **95,5 %**; `tsc` limpio; `vite build` correcto |
| «La lista solo tiene lo que añado»: producto a 0 sin añadir **no** aparece, en servicio, API e integración | Tests verdes |
| Migración `0005` sobre una copia de tu `homestock.db` real (cadena `0002 → 0005`) | La lista nace **vacía** aunque hay 4 productos con stock bajo; `check_movements` OK |
| Recorrido real contra el servidor (copia): añadir, sumar al repetir, EAN desconocido `404`, `quantity: null` `422`, marcar, comprar | Correcto: stock 4 → 7, historial `purchase` / `shopping_list`, lista vacía después |
| Mutaciones deliberadas | Ver abajo |

**Todo o nada, probado de verdad.** `purchase` necesitaba una transacción real y los repositorios
hacían `commit()` cada uno por su cuenta. Se añadió `atomic(session)` en `app/db.py`: dentro del bloque
los repositorios solo hacen `flush`, y un error revierte stock, historial y lista a la vez. El test
provoca un fallo en la **segunda** línea y comprueba que ni el stock, ni el historial, ni la lista
cambian. Tres mutaciones (quitar el `rollback`; dos repositorios que vuelven a hacer `commit`) hacen
fallar tests.

**Desviaciones.**

- **Las mutaciones del frontend están en `useShoppingListMutations.ts`**, no en `useMutations.ts`,
  que ya era largo y mezclaba otro dominio.
- **El stepper es editable** (admite 0,5) y bajar de 1 quita la línea, como pedía la spec.
- **La hoja del modo Gastar ya no dice «ya está en la lista»** (ver
  [v0.3/03](../v0.3/03-modo-consumir.md)): con esta spec habría sido falso.

**Bugs encontrados al probarlo.**

- El aviso «No se pudo guardar» de una línea se leía en el componente padre, que **no** tiene esa
  mutación (cada fila tiene la suya): nunca habría salido. Se movió a la fila.
- `onSettled` devolvía la promesa de recargar la lista, y TanStack Query v5 no publica el estado de error
  hasta que terminan los callbacks: con mala cobertura, la casilla revertía pero el aviso esperaba a la
  recarga. Ahora la recarga se lanza sin esperarla.
- Un test mío comprobaba `inventoryReads >= 0` (siempre verdadero); se sustituyó por una comprobación
  real de que la caché del inventario queda obsoleta tras comprar.

**No verificado.**

- **MariaDB.** `0005` y la atomicidad solo se ensayaron en SQLite. `begin`/`rollback` son estándar,
  pero hay que ensayar la migración sobre un volcado restaurado antes de desplegar.
- **A 380 px y en el móvil.** No hay navegador utilizable en esta sesión.
- **L3/L6 en la tienda sin cobertura.** Marcar depende de la red; la reversión con aviso lo cubre a
  medias, como la propia spec advertía. Si pasa a menudo, la alternativa es volver a `localStorage`.
- **Datos que se pierden.** La lista antigua era derivada, así que no hay nada que migrar; pero
  `localStorage["shoppingChecked"]` de cada navegador queda huérfano (inofensivo).
