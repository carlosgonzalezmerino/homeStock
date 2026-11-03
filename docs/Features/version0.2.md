# homeStock v0.2 — Propuestas de mejora

Lista de ideas para la siguiente iteración, con el origen de cada una y lo que costaría.
Pensada para iterarla punto por punto, como la [v0.1](version0.1.md).

**Estado:** propuesta. No se ha escrito código ni specs. Nada decidido.

## Contexto

- **Qué se revisó:** `README.md`, `docs/ARCHITECTURE.md`, `docs/Features/version0.1.md`,
  `docs/Features/v0.1/` y el código de `app/` y `frontend/src/`.
- **Qué se comprobó en el código** (no supuesto): los campos que la interfaz usa y los que no,
  los endpoints que existen, y qué pantallas hay.
- **Qué se buscó fuera:** Grocy, KitchenOwl, NoWaste y los comparativos de aplicaciones de
  despensa de 2026. Las fuentes están al final.
- **Punto de partida honesto:** la v0.1 dejó la base en buen estado (151 + 347 tests, migraciones,
  OpenAPI contrastado). Esto no son arreglos, son funcionalidades nuevas.

---

## Diagnóstico

Antes del catálogo, las tres cosas que condicionan todo lo demás.

### 1. La aplicación no tiene memoria

`PATCH /api/inventory/{ean}` **sobreescribe** `quantity`. No queda registro de qué pasó: si bajó
de 3 a 2 porque te lo comiste, porque lo tiraste o porque corregiste un error, la aplicación no
lo sabe. Solo conoce el presente.

Esto es lo que bloquea casi todo lo que hacen las aplicaciones parecidas: ritmo de consumo,
umbrales automáticos, gasto mensual, desperdicio, deshacer. Todas se derivan del historial.
Es también el cambio más barato de los estructurales: una tabla nueva, solo de inserción, escrita
desde `InventoryService`, sin romper nada de lo que ya hay.

**Es la pieza clave.** Cuanto más tarde se añada, más historial se pierde para siempre.

### 2. No hay ninguna fecha sobre la comida

No existe consumo preferente ni caducidad. `frozen_at` sí existe, pero se escribe y **no se usa**:
no aparece en la lista del congelador (`Pantry.tsx` solo muestra marca, cajón y nota) y nada
calcula cuánto tiempo lleva algo congelado.

«Qué está a punto de echarse a perder» es la función sobre la que está construida NoWaste entera,
y Grocy distingue incluso entre consumo preferente y caducidad. Es lo que evita tirar comida, o
sea lo que ahorra dinero de verdad.

### 3. El riesgo real no es la falta de funciones, es la deriva

Un inventario solo sirve si es verdad. Los comparativos de 2026 coinciden en el mismo fallo: *la
despensa solo sigue siendo exacta mientras sigas escribiendo en ella*, y por eso la entrada
automática (ticket, escaneo) es lo que distingue a las que se usan de las que se abandonan.

Hoy registrar una compra está bien resuelto (escaneo → sumar). **Gastar** está peor: hay que
entrar al detalle o usar el stepper de la lista. Y dar de alta la compra semanal entera es
producto a producto.

Conclusión: bajar la fricción vale más que añadir capacidades. Si el inventario deja de ser
cierto, todo lo demás sobra.

---

## Catálogo de propuestas

Coste: **S** = un rato · **M** = una sesión · **L** = varias sesiones.
«Migración» significa que toca el esquema, y por tanto Alembic.

### A · Cerrar lo que ya está medio hecho

| ID | Propuesta | Por qué | Coste | Toca |
|---|---|---|---|---|
| **N-01** | **Pantalla de lista de la compra.** `GET /api/shopping-list`, `api/shoppingList.ts` y `useShoppingList.ts` ya existen; no hay pantalla. Añadir: marcar como cogido mientras compras, y «comprado» que suma al stock sin volver a escanear. | Es lo más útil por unidad de esfuerzo de todo el repositorio: el trabajo del backend ya está pagado y sin usar. Y es lo único de esta lista que usarías **fuera de casa**, que es donde más falta hace. | **S** | 1 pantalla, ruta, navegación |
| **N-02** | **Edad en el congelador.** Mostrar «congelado hace 3 meses» en la lista y avisar al pasar de N meses. | El dato ya está guardado y no se ve. Coste casi nulo, y es justo lo que se olvida en un congelador de cuatro cajones. | **S** | `utils/freezer.ts`, `Pantry.tsx` |
| **N-03** | **Agrupar por categoría** la despensa y la lista de la compra, en orden de pasillo. | `product.category` ya viene de OpenFoodFacts. En la lista de la compra ordenar por pasillo ahorra vueltas al supermercado. Ojo: la taxonomía de OFF es ruidosa, hace falta mapearla a una lista corta propia. | **M** | Mapa de categorías, 2 pantallas |

### B · Las dos carencias estructurales

| ID | Propuesta | Por qué | Coste | Toca |
|---|---|---|---|---|
| **N-04** | **Registro de movimientos.** Tabla nueva solo de inserción: `ean`, `delta`, `motivo` (compra / consumo / merma / ajuste), `precio?`, `fecha`. La escribe `InventoryService` en cada cambio. | Es la llave de N-10 a N-14. Barata y sin romper nada. **Cada día que pasa sin ella es historial perdido.** | **M** | Migración `0003`, servicio, repositorio |
| **N-05** | **Consumo preferente / caducidad.** `best_before` en el inventario, sección «Caduca pronto» en Inicio, y estado en las listas. | Lo que evita tirar comida. Grocy separa consumo preferente (*caduca*, aviso suave) de caducidad (*no te lo comas*); merece la pena copiar la distinción. Con una fila por EAN solo cabe **una** fecha: la más próxima. Es un apaño honesto hasta N-21. | **M** | Migración, esquemas, Inicio, listas |

### C · Bajar la fricción

| ID | Propuesta | Por qué | Coste | Toca |
|---|---|---|---|---|
| **N-06** | **Modo «gastar» en el escáner** (`/consumir/:ean`): escaneas y resta 1. | Es el bucle central de Grocy. El escáner y el detalle ya tienen dos modos; un tercero encaja en la arquitectura que hay. Mantener el inventario al día pasa a costar un gesto. | **M** | Ruta, `navigation.ts`, detalle |
| **N-07** | **Importar el ticket de Mercadona.** Un ticket digital → alta masiva con precios. | El que más fricción quita de toda la lista: la compra semanal en una pantalla en vez de producto a producto. Y es la **única** vía realista a los precios, que OpenFoodFacts no tiene. Encaja con que todo el subconjunto de OFF esté ya filtrado a Mercadona. Contra: formato no documentado y frágil, se rompe cuando ellos cambien algo. | **L** | Parser, endpoint, pantalla de revisión |
| **N-08** | **Escritura sin conexión.** Cola de mutaciones en el PWA. | La despensa y el congelador suelen estar donde peor llega el wifi. Hoy la API es *network-first*: sin red, no escribes. KitchenOwl lo tiene parcial. | **M** | Service worker, cola, `useMutations` |
| **N-09** | **Añadir a la lista escaneando** en la tienda, sin tocar el stock. | Ves que algo se acaba y lo apuntas en el momento. Necesita una lista con ítems propios, no solo derivada (ver decisión D3). | **M** | Depende de N-01 |

### D · Lo que el historial habilita (todo depende de N-04)

| ID | Propuesta | Por qué | Coste |
|---|---|---|---|
| **N-10** | **Umbral sugerido** a partir del consumo real. | Hoy el umbral es un número que te inventas producto a producto. Que lo proponga la aplicación quita trabajo y lo hace mejor. | **M** |
| **N-11** | **Previsión:** «te quedarás sin leche el jueves». | Convierte el aviso de «estás bajo» en «cómpralo ya», que es la decisión que de verdad tomas. | **M** |
| **N-12** | **Gasto y precio por producto:** gasto mensual, y si algo ha subido. | Pantrino y Recipy lo venden como su función principal. Requiere precios, o sea N-07 o meterlos a mano. | **M** |
| **N-13** | **Desperdicio:** qué tiraste y cuánto costaba. | Ver el número es lo que cambia la conducta. Sale gratis del motivo «merma» de N-04. | **S** |
| **N-14** | **Deshacer** el último movimiento. | Hoy un error de dedo es irreversible. Con N-04 es trivial. | **S** |

### E · Que la aplicación te busque a ti

| ID | Propuesta | Por qué | Coste |
|---|---|---|---|
| **N-15** | **Aviso diario** (ntfy o Telegram desde el backend, con un cron): qué falta y qué caduca. | **El cambio de categoría de toda la lista.** Hoy la aplicación solo sirve si te acuerdas de abrirla, y el momento en que la necesitas (ir a comprar) es justo cuando no lo haces. Por ntfy o Telegram, no por Web Push: en iPhone el *push* web solo va en PWA instalada y da bastante guerra; tú ya tienes servidor en casa con Docker. | **M** |
| **N-16** | **Integración con Home Assistant**, si la usas: sensores de «faltan N» y «caducan N». | La API no tiene autenticación y está en la LAN, así que HA solo tiene que consultarla. Es el camino que ya usa la gente con Grocy. | **S** |

### F · Cocina (salto de alcance)

Aquí viven Grocy, KitchenOwl, Mealie y Tandoor. Es la zona de más valor potencial y más trabajo,
y donde la aplicación deja de ser un inventario. Solo merece la pena si cocináis con recetas.

| ID | Propuesta | Por qué | Coste |
|---|---|---|---|
| **N-17** | **Tus platos, no recetas.** Una lista de los 20 platos que hacéis, con ingredientes; un toque descuenta el stock. | El 20 % que da el 80 %: sin importar recetas de internet ni gestor de recetas. Y hace que gastar el stock sea un gesto. | **M** |
| **N-18** | **«Qué puedo cocinar con lo que tengo»** cruzando N-17 con el stock. | Resuelve la pregunta de las nueve de la noche. Grocy y KitchenOwl lo tienen. | **M** |
| **N-19** | **Menú semanal → lista de la compra.** | Es la función estrella de KitchenOwl y Grocy. Mucho trabajo y solo sirve si realmente planificáis. | **L** |
| **N-20** | **Resumen nutricional de lo consumido** (semana / mes). | Los macros **ya están en la base** y se muestran por 100 g en el detalle. Con N-04 se pueden sumar sobre lo que has comido de verdad, que ninguna aplicación de despensa hace bien. | **M** |

### G · La bifurcación del modelo de datos

| ID | Propuesta | Por qué | Coste |
|---|---|---|---|
| **N-21** | **Lotes** (*stock entries* de Grocy): cada compra es una fila con su fecha y su precio; el stock del producto es la suma. | Resuelve de una vez **F-08** (el mismo producto en dos sitios, que aplazaste), la caducidad por lote y el precio por lote: son el mismo cambio. Es el final natural del camino, pero es una migración grande y hay que querer llegar. | **L** |
| **N-22** | Unidades y conversiones (un pack de 6 huevos = 6 unidades). | Grocy lo tiene. Para una sola casa, poco valor por mucha complejidad. **No lo recomiendo.** | **M** |
| **N-23** | Productos padre/hijo y sustitutos. | Grocy lo tiene. Mismo juicio que N-22. **No lo recomiendo.** | **M** |

### H · Más allá de la comida

| ID | Propuesta | Por qué | Coste |
|---|---|---|---|
| **N-24** | **Mantenimiento de la casa:** filtros de agua, pilas, revisiones, con su «cada cuánto». | Grocy se define como «un ERP más allá de la nevera» y lleva tareas, pilas y equipos. Es otra lista con fechas, reutiliza los avisos de N-15, y pedías mejorar la vida, no solo la despensa. Encaja mejor como pestaña aparte que mezclado con la comida. | **M** |

---

## Orden recomendado

| # | Qué | Por qué ahí |
|---|---|---|
| 1 | **N-01** lista de la compra | Barato, el backend ya está hecho, y se usa cada semana |
| 2 | **N-02** edad en el congelador | Casi gratis, el dato ya se guarda |
| 3 | **N-04** registro de movimientos | Antes que nada que dependa de él: lo que no se registre hoy se pierde |
| 4 | **N-05** caducidad | Lo que más desperdicio evita |
| 5 | **N-15** aviso diario | Convierte la aplicación en algo que te avisa, no que tienes que recordar abrir |
| 6 | **N-06** modo gastar | Mantiene cierto el inventario, de lo que vive todo lo demás |
| 7 | Luego: **N-14**, **N-13**, **N-10**, **N-11** | Salen casi solos una vez existe N-04 |
| 8 | A decidir: **N-07** ticket, bloque **F**, **N-21** lotes | Las tres apuestas grandes. Una por iteración, no las tres |

Dos avisos que vienen de la v0.1 y siguen aplicando: **la regla de stock bajo está escrita tres
veces** (propiedad, SQL y `computeStockStatus`) y hay que tocarlas juntas; y después de cambiar
cualquier endpoint, `uv run python -m scripts.export_openapi`.

Pendientes de la v0.1 que no están aquí porque no son funcionalidades: probar la cámara en el
iPhone, el despliegue con `alembic stamp`, los EAN de F-12 y los commits.

---

## Decisiones

Las specs de lo decidido están en [`v0.2/`](v0.2/README.md).

### Tomadas (2026-11-03)

| # | Pregunta | Resolución |
|---|---|---|
| D1 | ¿Por dónde empezamos? | **N-01 y N-02.** Especificadas en `v0.2/01` y `v0.2/02` |
| D2 | ¿Quieres avisos y por dónde? | **Ninguno por ahora.** N-15 y N-16 quedan aplazados |
| D4 | ¿Cocináis con recetas? | **Sí**, y se quiere explorar: tus recetas con cantidades, y qué se puede cocinar con lo que hay, mirando el congelador. Diseñado en `v0.2/03` (N-17 + N-18). N-19, el menú semanal, sigue fuera |

### Pendientes

| # | Pregunta | Mi propuesta |
|---|---|---|
| **D3** | ¿La lista de la compra solo deriva del stock, o admite ítems sueltos («bolsas de basura»)? | Que los admita, en su propia iteración: es la mitad de una lista de verdad, pero necesita tabla. **Bloquea la mejor parte de las recetas** (`v0.2/03`, D11) |
| D5 | ¿Precios a mano o esperamos al ticket (N-07)? | Dejar el campo en N-04 desde el principio y rellenarlo cuando haya N-07 |
| D6 | ¿Vamos hacia los lotes (N-21) o seguimos con una fila por EAN? | Una fila por ahora. Pero si la respuesta es «sí algún día», N-05 se diseña sabiéndolo |
| D7 | ¿Usas Home Assistant? | Si sí, N-16 es casi gratis |
| **D9, D10** | Las dos decisiones de modelo de las recetas | En [`v0.2/03`](v0.2/03-recetas.md): son las que cambian su coste de verdad |

---

## De dónde sale cada idea

| Proyecto | Qué tiene que aquí falta |
|---|---|
| [Grocy](https://grocy.info/) | Fechas con tipo (consumo preferente vs. caducidad), *consumir* y *abrir* como operaciones, lotes con fecha y precio, conversión de unidades, productos padre/hijo, y tareas, pilas y equipos. Misma pila de escaneo que aquí (ZXing, solo HTTPS) y búsqueda en OpenFoodFacts |
| [KitchenOwl](https://github.com/Belgadon/kitchenowl) | Lista compartida con soporte parcial sin conexión, recetas importadas por URL, menú semanal y reparto de gastos entre miembros |
| [NoWaste](https://apps.apple.com/us/app/-/id926211004) | Listas separadas de nevera, congelador y despensa; orden por caducidad; alta por ticket o foto; la lista de la compra muestra el stock actual mientras compras |
| Comparativos 2026 ([Fango](https://fango.fi/en/blog/best-pantry-inventory-app/), [Pantryfy](https://www.pantryfy.ai/blog/best-pantry-inventory-apps), [Pantry Persona](https://www.pantrypersona.com/blog/best-pantry-inventory-apps-2026)) | El ticket escaneado es la función más repetida, con precios e histórico. Y el diagnóstico de fondo: sin alta automática, la despensa solo es exacta mientras sigas escribiendo en ella |

Las fichas de tiendas y los comparativos son material promocional: describen lo que venden, no lo
que la gente usa. El README de Grocy no trae lista de funciones (remite a su web), así que lo suyo
viene de su documentación y su registro de cambios.
