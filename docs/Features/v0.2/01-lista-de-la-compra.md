# Spec 01 · Pantalla de lista de la compra

**Cubre:** N-01
**Estado:** implementada (2026-11-03). Ver [Verificación](#verificación-2026-11-03).
**Toca la BD:** no.
**Depende de:** nada. Todo el backend que necesita ya existe.

## Punto de partida

Ya construido y sin usar:

| Pieza | Dónde | Qué da |
|---|---|---|
| `GET /api/shopping-list` | `app/api/shopping_list.py` | `ean`, `name`, `quantity`, `threshold`, `unit`, `image_url` por línea |
| `ShoppingListService` | `app/services/shopping_list.py` | Las filas con `is_low`, emparejadas con su producto |
| `getShoppingList` | `frontend/src/api/shoppingList.ts` | La llamada |
| `useShoppingList` | `frontend/src/hooks/useShoppingList.ts` | La consulta, con clave `["shopping-list"]` |
| Invalidación | `hooks/useMutations.ts` | Toda escritura de inventario ya invalida `["shopping-list"]` |

**No hay pantalla.** Este spec solo añade frontend.

La lista es **derivada**: es una consulta sobre el stock, no una lista guardada. No admite productos
que no estén en el inventario (ver [D3](#decisiones-pendientes)).

## Comportamiento

### Ruta y acceso

- Nueva ruta `/lista` en `AppRoutes.tsx`, con la pantalla `ShoppingList`.
- Nueva pestaña en `BottomNav`, entre «Despensa» y «Escanear»: etiqueta «Lista», icono
  `shopping_cart`.
- **Riesgo:** la barra pasa de 4 a 5 pestañas. Con `px-4` por pestaña hay que comprobar que a
  380 px no se desborda ni se parten las etiquetas. Si no cabe, la alternativa es reducir el
  `px-4` a `px-3`, no quitar una pestaña.

### Qué muestra cada línea

De arriba a abajo, reutilizando los componentes que ya hay:

- Miniatura (`ProductThumbnail`, 44 px, como en la despensa).
- Nombre del producto.
- **Lo que queda y lo que hay que comprar:** `Quedan 1 de 3 · comprar 2`.
  - Lo que queda mientras compras es justamente lo que hace útil la lista en la tienda, y la API
    ya devuelve `quantity` y `threshold` sin pedir nada nuevo.
- Casilla para marcar que ya lo has cogido.

### Cuánto propone comprar

```
faltan   = max(umbral − cantidad, 0)
sugerido = faltan > 0 ? faltan : 1
```

Esto encaja a propósito con la regla de stock bajo, que es una trampa conocida del proyecto:
estar **exactamente** en el umbral no es bajo, así que comprar `umbral − cantidad` es justo lo que
hace falta para dejar de estar bajo, nunca una unidad de más.

| Cantidad | Umbral | ¿Bajo? | Sugerido | Después queda |
|---|---|---|---|---|
| 0 | 2 | sí | 2 | 2, ya no bajo |
| 1 | 2 | sí | 1 | 2, ya no bajo |
| 0 | 0 | sí | 1 | 1, ya no bajo |
| 0 | 0,5 | sí | 0,5 | 0,5, ya no bajo |
| 0,5 | 0 | no | — | no aparece en la lista |

El sugerido pasa por `roundQuantity`, como el resto de las cantidades.

### Marcar mientras compras

- Marcar una línea la tacha y la manda al final de la lista. Desmarcarla la devuelve a su sitio.
- **Las marcas se guardan en `localStorage`**, con clave `shoppingChecked` y valor el conjunto de
  EAN marcados. Motivo: en el supermercado la pantalla se apaga, hay poca cobertura y una recarga
  no puede borrar media compra. React state solo no sobrevive a eso.
- El acceso va envuelto como el resto (`activeLocation`, `theme`): si el almacenamiento está
  bloqueado la pantalla sigue funcionando en memoria y avisa por consola.
- Un EAN marcado que ya no está en la lista se descarta al leer, para que no se acumule basura.

### Registrar la compra al volver a casa

- Un botón fijo abajo: **«Añadir al stock (N)»**, con N las líneas marcadas. Deshabilitado con N = 0.
- Al pulsarlo, para cada línea marcada: `PATCH /api/inventory/{ean}` con
  `{ quantity: cantidad_actual + sugerido }`.
- No hay endpoint de lote, así que son N peticiones secuenciales. Para una casa son menos de 30;
  si algún día molesta, el arreglo es un endpoint de lote, no cambiar la pantalla.
- **Fallo parcial:** las que fallan se quedan marcadas y se muestra
  «No se pudieron añadir N productos». Las que fueron bien se desmarcan. Nunca se pierde el rastro
  de lo que falta por registrar.
- Al terminar bien, se limpian las marcas y se muestra `StatusToast` con «Compra añadida».
- La lista se refresca sola: `usePatchInventory` ya invalida `["shopping-list"]`.

### Estados

| Estado | Qué se ve |
|---|---|
| Cargando | `Spinner` |
| Error | `ErrorState` con «Error al cargar» y reintento |
| Lista vacía | `EmptyState` con «No falta nada» |

### Abrir el producto

Pulsar el nombre o la miniatura abre `/despensa/{ean}` (`encodeURIComponent`), igual que en la
despensa y en las alertas. La casilla y el botón no navegan.

## Cambios

| Archivo | Cambio |
|---|---|
| `screens/ShoppingList.tsx` | Nuevo. Pantalla, líneas y botón de registrar |
| `screens/index.ts` | Exportarla |
| `AppRoutes.tsx` | Ruta `/lista` |
| `components/BottomNav.tsx` | Quinta pestaña |
| `hooks/useCheckedItems.ts` | Nuevo. Marcas con respaldo en `localStorage`, envuelto |
| `utils/shopping.ts` | Nuevo. `suggestedPurchase(quantity, threshold)`, pura |

Nada del backend. **No hace falta** `scripts.export_openapi`: no cambia ningún endpoint ni esquema.

## Tests

Función pura, con los casos de la tabla compartidos con la regla de stock bajo:

- `suggestedPurchase` con cantidad 0 y umbral 2 devuelve 2.
- `suggestedPurchase` con cantidad 1 y umbral 2 devuelve 1.
- `suggestedPurchase` con cantidad 0 y umbral 0 devuelve 1.
- `suggestedPurchase` con cantidad 0 y umbral 0,5 devuelve 0,5.
- `suggestedPurchase` nunca devuelve un número negativo.

Pantalla:

- Con la lista vacía muestra «No falta nada».
- Con dos líneas muestra el nombre, lo que queda y lo que hay que comprar de cada una.
- Marcar una línea la tacha y la baja al final.
- El botón está deshabilitado sin nada marcado y muestra el número cuando hay marcas.
- Pulsar «Añadir al stock» envía un `PATCH` por línea marcada, con la cantidad sumada.
- Si un `PATCH` falla, esa línea sigue marcada y se avisa del número que falló.
- Pulsar el nombre navega a `/despensa/:ean`, también con un EAN `CUSTOM-`.
- Un error de carga muestra el reintento.

Marcas:

- Las marcas sobreviven a volver a montar la pantalla.
- Con `localStorage` bloqueado la pantalla funciona y no lanza.
- Un EAN marcado que ya no está en la lista se descarta.

Accesibilidad:

- Cada casilla tiene nombre accesible con el nombre del producto.
- El botón de registrar anuncia cuántos productos añade.

## Criterios de aceptación

- [ ] Hay una pestaña «Lista» y la pantalla muestra lo que falta.
- [ ] Cada línea dice cuánto queda y cuánto comprar.
- [ ] Puedo marcar lo que ya tengo en el carro, y las marcas aguantan una recarga.
- [ ] Un botón registra de golpe todo lo marcado, sumándolo al stock.
- [ ] Si algo falla al registrar, sé qué fue y no lo pierdo.
- [ ] Con la despensa al día la pantalla dice que no falta nada.
- [ ] Pulsar una línea abre el detalle del producto.
- [ ] A 380 px las cinco pestañas caben y la línea no se desborda.

## Fuera de alcance

| Qué | Por qué |
|---|---|
| Ítems sueltos que no son productos («bolsas de basura») | Necesita tabla y una decisión (D3) |
| Agrupar por categoría y orden de pasillo | Es N-03 |
| Añadir a la lista escaneando en la tienda | Es N-09, y depende de D3 |
| Endpoint de lote para registrar la compra | N peticiones bastan para una casa |
| Compartir la lista con otra persona en tiempo real | La aplicación no tiene usuarios, por diseño |

## Decisiones pendientes

| # | Pregunta | Mi propuesta |
|---|---|---|
| **D3** | ¿La lista admite ítems sueltos que no son productos del inventario? | Sí, pero **no en este spec**. Es la mitad de una lista de la compra de verdad, y es lo que pedirán también las recetas (Spec 03) para lo que falta. Merece su propia tabla y su propia iteración |
| D8 | ¿La quinta pestaña, o acceso desde Inicio? | Pestaña. Es una pantalla que se usa de pie en una tienda, no se busca dentro de otra |

## Verificación (2026-11-03)

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| Hay una pestaña «Lista» y la pantalla muestra lo que falta | ✔ | `BottomNav` con la ruta `/lista`; `ShoppingList.test.tsx` |
| Cada línea dice cuánto queda y cuánto comprar | ✔ | `test_shoppingList_item_showsRemainingAndSuggested` |
| Puedo marcar lo que ya tengo en el carro, y las marcas aguantan una recarga | ✔ | `test_shoppingList_checkedMark_survivesRemount`, `useCheckedItems.test.tsx` |
| Un botón registra de golpe todo lo marcado, sumándolo al stock | ✔ | `test_shoppingList_registerChecked_sendsPatchWithSummedQuantity`, `..._registerTwoChecked_...` |
| Si algo falla al registrar, sé qué fue y no lo pierdo | ✔ | `test_shoppingList_partialFailure_keepsFailedItemCheckedAndReportsCount` |
| Con la despensa al día la pantalla dice que no falta nada | ✔ | `test_shoppingList_empty_showsNoFaltaNada` |
| Pulsar una línea abre el detalle del producto | ✔ | `test_shoppingList_clickName_navigatesToDetail` |
| A 380 px las cinco pestañas caben y la línea no se desborda | ⚠ | No hay navegador en esta sesión. Se redujo `px-4` a `px-3` en `BottomNav` como medida preventiva, tal como preveía este spec, pero no está comprobado visualmente |

**Desviación:** el botón de registrar no usa `position: fixed` como proponía el spec, sino
`position: sticky` dentro del flujo de la pantalla. La aplicación no tiene ningún otro
elemento con posición fija aparte de la cabecera y `BottomNav`, y un segundo `fixed` real habría
necesitado coordinar manualmente su altura con la de `BottomNav` para no superponerse. `sticky`
da el mismo resultado práctico (el botón queda visible al final del scroll) sin ese riesgo.

Tests: 404 pasan (347 al cerrar la v0.1, +57 de esta spec y la Spec 02 juntas). `tsc --noEmit` y
`npm run build` correctos; el build sigue precacheando 11 ficheros. No se ha tocado el backend ni
`docs/openapi.json`.
