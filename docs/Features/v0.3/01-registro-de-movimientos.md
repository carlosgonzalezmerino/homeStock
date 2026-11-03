# Spec 01 · Registro de movimientos

**Cubre:** U-01 (= N-04 de la v0.2)
**Estado:** escrita, sin implementar.
**Toca la BD:** sí, migración `0003`.
**Depende de:** nada.
**Bloquea a:** las specs 02, 03 y 04 enteras, y a U-05, U-08, N-10 a N-14.

## El problema

`PATCH /api/inventory/{ean}` **sobreescribe** `quantity`. Si una leche baja de 3 a 2, la
aplicación no sabe si te la bebiste, si caducó o si fue un error de dedo. Solo conoce el presente.

Eso bloquea, hoy:

| Qué | Por qué lo necesita |
|---|---|
| **Deshacer** | Sin saber qué cambió, no se puede revertir |
| Las specs 02 y 03 | Son acciones de un toque, y sin deshacer no se pueden ofrecer (regla 1 del [README](README.md#el-riesgo-de-esta-iteración)) |
| La spec 04 | Para preguntar «¿queda leche?» hay que saber cada cuánto se gasta |
| Umbral automático, gasto, desperdicio | Todo se deriva del historial |

**Y es lo único de la iteración cuyo coste de aplazar crece:** lo que no se registre hoy no se
reconstruye mañana.

## La decisión de fondo: diario, no fuente de la verdad

Hay dos formas de hacerlo:

| | Qué implica | Veredicto |
|---|---|---|
| **Diario paralelo** | `inventory_items.quantity` sigue siendo la verdad. Los movimientos son un registro que se escribe a la vez | **Esta.** No rompe nada de lo que ya hay, se implementa en una sesión, y permite todo lo que viene |
| Fuente de la verdad | `quantity` desaparece y se calcula sumando movimientos | Más puro y mucho más caro: toca todas las consultas, la regla de stock bajo y el rendimiento de la lista. No aporta nada que el diario no dé |

Se elige el **diario paralelo** (decisión E4 del catálogo). El precio honesto de esa decisión es
que los dos pueden desincronizarse si alguien escribe SQL a mano, así que la spec incluye un
script de comprobación. Pasar a fuente de la verdad más adelante sigue siendo posible y esta
tabla es exactamente la que haría falta.

## El modelo

### Tabla `stock_movements`

| Columna | Tipo | Nulo | Qué es |
|---|---|---|---|
| `id` | int, PK | no | |
| `ean` | str, índice, FK → `products.ean` | no | De qué producto |
| `delta` | float | no | Lo que cambió, **con signo**. Nunca 0 |
| `quantity_after` | float | no | Lo que quedó tras el movimiento |
| `reason` | str | no | **Por qué** cambió el stock |
| `source` | str | no | **Por dónde** entró el cambio |
| `price` | float | sí | Importe total de la línea, en euros. Vacío hasta U-07 |
| `undoes_id` | int, FK → `stock_movements.id` | sí | El movimiento que este deshace |
| `created_at` | datetime | no | |

Tres decisiones del esquema que conviene razonar:

- **La clave externa va a `products.ean`, no a `inventory_items.id`.** Las filas de inventario se
  borran («Quitar de la despensa»); el historial no debe irse con ellas. Como además hay una sola
  fila de inventario por EAN, colgarlo del EAN no pierde nada.
- **`quantity_after` es redundante pero se guarda igual.** Permite auditar y deshacer sin
  reproducir toda la cadena desde el principio, y es lo que delata una desincronización con
  `inventory_items`.
- **`reason` y `source` son cosas distintas.** `reason` es semántica de negocio y se usa para
  calcular (el consumo medio solo mira `consume`). `source` es de dónde vino, sirve para depurar
  y **prepara el escáner de pared H-01**, que escribirá con `source = device` sin pasar por el
  navegador.

### Valores de `reason`

A `app/constants.py`, nada de literales sueltos:

| Valor | Signo | Cuándo |
|---|---|---|
| `initial` | + | Primera vez que se empieza a seguir un producto |
| `purchase` | + | Se ha comprado |
| `consume` | − | Se ha gastado |
| `waste` | − | Se ha tirado: caducado, estropeado |
| `adjust` | ± | Corrección: el número no coincidía con la realidad |
| `removed` | − | «Quitar de la despensa» con stock pendiente |

`waste` no tiene todavía quién lo escriba (hace falta interfaz, y eso es N-13). Se define ahora
porque definirlo después obliga a reinterpretar el historial ya grabado.

### Valores de `source`

| Valor | Cuándo |
|---|---|
| `app` | Interfaz, sin más contexto |
| `scan` | Vino de un escaneo |
| `shopping_list` | El botón «Añadir al stock» de la lista |
| `device` | Un cacharro externo. Reservado para H-01 |
| `ticket` | Importación de ticket. Reservado para U-07 |
| `migration` | Lo escribió la migración `0003` |
| `undo` | Es la reversión de otro movimiento |

## Comportamiento

### Dónde se escribe

Solo en `InventoryService`. **Ni en los routers ni en los repositorios**, para que el escáner de
pared y la importación de tickets hereden el registro sin duplicar código.

| Operación del servicio | Movimiento |
|---|---|
| `start_tracking` | `initial`, `delta = quantity`. **No se escribe si `quantity` es 0**: un alta vacía no es un movimiento |
| `update`, cuando `quantity` cambia | `delta = nueva − anterior`, con el `reason` que venga, o `adjust` si no viene |
| `update`, cuando `quantity` no cambia | **Nada.** Cambiar el umbral, la nota o el cajón no es un movimiento de stock |
| `stop_tracking` con stock > 0 | `removed`, `delta = −quantity` |
| `stop_tracking` con stock 0 | Nada |

Un `delta` de 0 **nunca** se guarda. Es la regla que mantiene el diario legible.

### Cómo llega el motivo

`InventoryPatch` gana un campo opcional `reason`. Y aquí hay una **trampa concreta**: el router
hace `payload.model_dump(exclude_unset=True)` y pasa el diccionario entero a `service.update`, que
acaba en `update_fields`. Si `reason` viaja ahí dentro, se intentará escribir una columna que no
existe.

Hay que **sacarlo del diccionario en el servicio**, antes de `_plan_update`, y tratarlo aparte.
Tiene test propio (`test_update_with_reason_does_not_write_it_as_a_column`).

Qué envía cada sitio de la interfaz:

| Dónde | `reason` | `source` |
|---|---|---|
| `AddStockCard`, alta nueva | `initial` (lo pone el servicio) | `scan` o `app` |
| `AddStockCard`, sumar a existente | `purchase` | `scan` o `app` |
| Stepper de `Pantry.tsx`, «−» | `consume` | `app` |
| Stepper de `Pantry.tsx`, «+» | `purchase` | `app` |
| `QuantityCard` del detalle, «Actualizar cantidad» | `adjust` | `app` |
| `ShoppingList`, «Añadir al stock» | `purchase` | `shopping_list` |
| «Quitar de la despensa» | `removed` (lo pone el servicio) | `app` |

El «−» del stepper de la despensa se registra como `consume` y no como `adjust` **a propósito**:
es el gesto con el que hoy se gasta de verdad, y si no cuenta como consumo la spec 04 no tendrá
nada que medir.

`source` viaja en una cabecera `X-HomeStock-Source`, no en el cuerpo. Motivo: no es un dato de
negocio del recurso, y así ningún esquema de escritura tiene que repetirlo. Si falta, `app`.

### Deshacer

`POST /api/movements/{id}/undo`:

1. Comprueba que el movimiento existe y que **no ha sido deshecho ya** (que no haya otra fila con
   `undoes_id` apuntándole). Si lo está, `409`.
2. Aplica `−delta` al stock actual. Si el resultado sería negativo, se queda en 0 — no se rechaza:
   el objetivo es que la cantidad vuelva a ser creíble, no castigar al usuario.
3. Inserta un movimiento nuevo con `delta` invertido, `reason = adjust`, `source = undo` y
   `undoes_id` apuntando al original.

**La tabla es solo de inserción. Nada se borra ni se modifica, nunca.** Deshacer un deshacer
funciona solo, porque el segundo movimiento es tan normal como el primero.

### Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/movements` | Lista, la más reciente primero. Parámetros `ean`, `reason`, `limit` (por defecto 50, máximo 200), `offset` |
| `GET` | `/api/movements/last` | El último movimiento, para pintar «Deshacer» al abrir la aplicación |
| `POST` | `/api/movements/{id}/undo` | Lo de arriba. `404` si no existe, `409` si ya estaba deshecho |

Después de tocarlos: `uv run python -m scripts.export_openapi`.

### Migración `0003`

- Crea la tabla y su índice por `ean`.
- **Rellena el pasado:** un movimiento `initial` por cada fila de `inventory_items` con
  `quantity > 0`, con `delta = quantity_after = quantity`, `source = migration` y el `created_at`
  de la fila de inventario, para no fingir que todo se compró el día del despliegue.
- `downgrade` borra la tabla. Se pierde el historial, que es lo esperable y debe decirlo el
  docstring.

Hay que ensayarla **sobre una copia** de la base de MariaDB antes de desplegar, como manda
`docs/DATABASE.md`. Y ojo con el aviso del README: la base vive en `/mnt/d`, un montaje drvfs sin
bloqueo de ficheros real. Copia de seguridad antes, sin excepción.

### Comprobación de coherencia

`scripts/check_movements.py`: por cada EAN, compara `sum(delta)` con `inventory_items.quantity` y
lista las diferencias. No arregla nada, solo informa. Es el precio de haber elegido diario
paralelo, y conviene ejecutarlo después de la migración y de cada despliegue.

## Lo que esto **no** cambia

- `quantity` sigue siendo la verdad. Ninguna consulta existente cambia.
- La regla de stock bajo **no se toca**. Sigue escrita en los tres sitios de siempre.
- `GET /api/inventory` devuelve exactamente lo mismo que ahora.
- No hay pantalla de historial. Esta spec es backend más la fontanería mínima de `reason`.

## Criterios de aceptación

1. Toda operación que cambia `quantity` deja exactamente un movimiento, con el signo correcto y
   `quantity_after` igual a la cantidad guardada.
2. Un alta con cantidad 0 no deja movimiento. Cambiar solo umbral, nota, cajón o ubicación tampoco.
3. Quitar de la despensa un producto con stock deja un `removed` negativo, y el historial del EAN
   sobrevive a la baja.
4. `reason` enviado en el `PATCH` se guarda en el movimiento y **no** se intenta escribir en
   `inventory_items`.
5. Un `PATCH` de cantidad sin `reason` se guarda como `adjust`.
6. `undo` devuelve el stock a su valor anterior, inserta la fila compensatoria con `undoes_id`, y
   un segundo `undo` del mismo movimiento responde `409`.
7. `undo` de un movimiento positivo mayor que el stock actual deja el stock en 0, no negativo.
8. Tras `alembic upgrade head` sobre una copia real, cada producto con stock tiene su `initial`
   con la fecha de alta original, y `check_movements.py` no reporta diferencias.
9. `docs/openapi.json` está regenerado y su test pasa.
10. Cobertura ≥ 80 % en backend, y `ruff check` y `ruff format --check` limpios.

## Tests

Siguiendo `test_<método>_<escenario>_<resultado>`:

| Fichero | Casos |
|---|---|
| `tests/repositories/test_movements.py` | Insertar y listar; orden descendente; filtro por `ean` y por `reason`; `limit` y `offset`; tope de 200 |
| `tests/services/test_movements.py` | Los seis `reason`; delta 0 no escribe; alta con 0 no escribe; cambio de umbral no escribe; `reason` no se filtra a las columnas; `undo` normal, doble `undo`, `undo` que llevaría a negativo |
| `tests/api/test_movements.py` | Los tres endpoints; `404`; `409`; validación de `limit`; cabecera `X-HomeStock-Source` presente y ausente |
| `tests/test_migrations.py` | `upgrade` sobre una base con inventario rellena el pasado con las fechas correctas; `downgrade` deja el esquema como estaba |
| `tests/test_openapi_contract.py` | Ya existe; debe seguir pasando tras regenerar |

## Fuera de alcance

- Pantalla de historial. Se verá cuando haya datos que merezca la pena mirar.
- Interfaz de **deshacer** (U-05): aquí solo se construye el endpoint. El botón sale en la spec 02,
  que es la primera que lo necesita de verdad.
- Interfaz de `waste`: el motivo existe, nadie lo escribe todavía.
- Precios reales: el campo se crea vacío y se llena con U-07.
- Predicción y umbral automático: son la spec 04 y U-08.
- Derivar `quantity` de los movimientos. Decisión E4, aplazada.

## Preguntas abiertas

| # | Pregunta | Mi propuesta |
|---|---|---|
| **E9** | ¿El «−» del stepper de la despensa es `consume` o `adjust`? | **`consume`.** Es el gesto real de gastar hoy. Si fuese `adjust`, la spec 04 arrancaría sin datos |
| **E10** | ¿Cuánto historial se guarda? | **Todo.** Un hogar genera del orden de 2.000 filas al año; no hay motivo para podar, y podar destruye justo lo que da valor |
| E11 | ¿`source` por cabecera o en el cuerpo? | Cabecera, por lo razonado arriba. Si resulta incómodo desde el frontend, pasarlo al cuerpo es un cambio pequeño |
