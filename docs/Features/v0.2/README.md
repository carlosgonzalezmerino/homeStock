# homeStock v0.2 · Specs de implementación

Convierte en specs implementables las propuestas elegidas de
[`version0.2.md`](../version0.2.md), que es el catálogo completo de las 24 ideas con su coste.

**Estado:** specs 01 y 02 implementadas y verificadas con tests (2026-11-03). Spec 03 es un
diseño para explorar, con tres decisiones pendientes, sin implementar.

## Specs

| Spec | Cubre | Toca la BD | Estado |
|---|---|---|---|
| [01 · Lista de la compra](01-lista-de-la-compra.md) | N-01 | No | Implementada, **sustituida por la 04** |
| [02 · Antigüedad en el congelador](02-antiguedad-congelador.md) | N-02 | No | Implementada |
| [03 · Recetas y «qué puedo cocinar»](03-recetas.md) | N-17, N-18 | **Sí** | Diseño. Espera D9, D10 y D11 |
| [04 · Lista de la compra manual](04-lista-de-la-compra-manual.md) | N-01 (rehecha) | **Sí** (`0005`) | Implementada |

Las dos primeras son **solo frontend**: no cambian ningún endpoint ni esquema, así que no hace
falta `uv run python -m scripts.export_openapi`. La tercera necesitaría migración (ahora `0006`, porque la v0.3 usó `0003` y `0004` y la spec 04 usó `0005`).

## Por qué estas tres

De las 24 propuestas, elegiste empezar por la lista de la compra y el congelador, y explorar las
recetas. Lo que las une:

- **N-01** es lo más útil por esfuerzo del repositorio: `GET /api/shopping-list`, el cliente y el
  hook ya existen y llevan desde la v0.1 sin ninguna pantalla que los use.
- **N-02** usa un dato que ya se guarda, `frozen_at`, y que hoy **no se lee en ninguna parte**.
- **N-17 y N-18** son la iteración grande, y su mejor parte depende de una decisión (D3) que
  conviene tomar antes.

Descartado por ahora: los avisos automáticos (N-15), que dijiste que no.

## Decisiones

### Tomadas

| # | Pregunta | Resolución |
|---|---|---|
| D1 | ¿Por dónde empezar? | Lista de la compra y congelador (tuya) |
| D2 | ¿Avisos automáticos? | No por ahora (tuya) |
| D4 | ¿Recetas? | Sí: tus recetas con cantidades, y qué puedes cocinar con lo que hay, mirando el congelador (tuya) |

### Pendientes

| # | Pregunta | Spec | Mi propuesta |
|---|---|---|---|
| **D3** | ¿La lista de la compra admite ítems sueltos que no son productos del inventario? | 01, 03 | Sí, pero en su propia iteración. **Bloquea la mejor parte de las recetas** |
| D8 | ¿La lista es una quinta pestaña o se entra desde Inicio? | 01 | Pestaña |
| **D9** | ¿El ingrediente de una receta es un EAN, texto libre o una tabla propia? | 03 | Tabla propia, con interfaz de elegir productos de tu despensa |
| **D10** | ¿«Puedo cocinar esto» se mira por presencia o por cantidad real? | 03 | Por presencia, guardando la cantidad. Y decirlo como «tienes los ingredientes» |
| D11 | ¿Resolvemos D3 antes de las recetas? | 03 | Sí |
| D12 | ¿Pegar recetas como texto en la primera versión? | 03 | No |

D9 y D10 son las que cambian el coste de las recetas de forma importante. Están razonadas en la
[Spec 03](03-recetas.md#los-dos-problemas-de-fondo).

## Reglas que se aplican en las tres

Las mismas de la v0.1, de [`DevelopStyle.md`](../../../../Trabajo/Desarrollo/DevelopStyle.md):

- Métodos de 30 líneas como máximo, bloques `try` de 7.
- Docstrings con Args y Returns en todo lo público. Sin números mágicos: los umbrales van a
  `constants/`.
- Tests `test_<método>_<escenario>_<resultado>`, con caso normal, límites y errores.
- Sin inyección de dependencias nueva. La lógica de negocio en servicios, no en routers.
- Cada spec termina en **Criterios de aceptación** y **Fuera de alcance**, y añadirá una sección
  de **Verificación** cuando se implemente.

## Trampas del proyecto que afectan a estas specs

| Trampa | Dónde aparece |
|---|---|
| La regla de stock bajo está escrita **tres veces** (propiedad, SQL y `computeStockStatus`) y hay que tocarlas juntas | Spec 01 la usa para calcular cuánto comprar, pero **no la modifica** |
| Hay una sola fila de inventario por EAN | Spec 02 no puede dar una fecha por lote; Spec 03 cuenta el stock total, no por lote |
| Todo acceso a `localStorage` va envuelto | Spec 01 guarda ahí lo que marcas en la tienda |
| El verde solo para acciones y datos destacados (S-04) | Spec 02 marca lo viejo en `on-surface-variant`, no en verde |
| Después de tocar un endpoint o un esquema, `export_openapi` | Solo afecta a la Spec 03 |

## Pendientes de la v0.1 que siguen abiertos

No son parte de esta iteración, pero siguen ahí (ver
[`SESSION-2026-11-02.md`](../v0.1/SESSION-2026-11-02.md)): probar la cámara en el iPhone, el
despliegue con `alembic stamp 0001`, los EAN de F-12, la revisión visual a 380 px y **los commits**,
que no se han hecho.

La revisión visual a 380 px gana importancia con estas specs: la Spec 01 añade una quinta pestaña
a la barra y la Spec 02 un cuarto trozo a una línea que ya se trunca.
