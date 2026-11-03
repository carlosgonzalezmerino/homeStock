# homeStock v0.3 · Specs de implementación

Convierte en specs implementables lo elegido de [`version0.3.md`](../version0.3.md), que es el
catálogo completo con el diagnóstico, las alternativas y el hardware.

**Estado:** specs 01 a 04 implementadas y verificadas con tests (2026-11-03). Pendiente de comprobar en un
iPhone real y a 380 px; ver la sección de Verificación de cada spec.

## Specs

| Spec | Cubre | Toca la BD | Estado |
|---|---|---|---|
| [01 · Registro de movimientos](01-registro-de-movimientos.md) | U-01 (= N-04) | **Sí**, migración `0003` | Implementada |
| [02 · Modo compra (ráfaga)](02-modo-compra.md) | U-02 | No | Implementada |
| [03 · Modo consumir](03-modo-consumir.md) | U-03 (= N-06) | No | Implementada |
| [04 · Repaso semanal](04-repaso-semanal.md) | U-04 | **Sí**, migración `0004` | Implementada |

Y después, a darle vueltas sin compromiso: **U-07, el ticket de Mercadona**. No se escribe spec
hasta que las cuatro anteriores estén.

## Por qué este orden

No es arbitrario: cada una **necesita** a la anterior.

```
01 movimientos ──┬── 02 ráfaga      (necesita deshacer, que necesita el diario)
                 ├── 03 consumir    (necesita deshacer; restar por error es peor que sumar)
                 └── 04 repaso      (necesita historial para saber qué preguntar)
```

- **01 primero y sin discusión.** Es la única de las cuatro cuyo coste de aplazar *crece*: lo que
  no se registre hoy no se puede reconstruir mañana. Las otras tres se pueden hacer en cualquier
  momento sin perder nada.
- **02 antes que 03** porque la compra es donde más toques se ahorran de golpe, y porque el motor
  de cámara continua que construye 02 lo reutiliza 03 entero. Hacer 03 primero sería construir ese
  motor dos veces.
- **04 la última** porque es la red de seguridad de las otras: solo tiene sentido medir la deriva
  cuando ya has hecho lo posible por evitarla.

## El riesgo de esta iteración

Las specs 02 y 03 introducen **acciones de un solo toque que cambian el stock**. Eso es
exactamente lo que se busca, y también lo que puede estropear los datos de verdad.

Tres reglas que aplican a las tres specs y que no se negocian:

1. **Nada se confirma sin poder deshacerse.** Si una acción no tiene vuelta atrás visible, no es
   de un toque: lleva confirmación.
2. **Restar nunca se hace por defecto.** El modo consumir se entra a propósito y se ve que estás
   en él. Un `+1` indebido se corrige; un `−1` silencioso se descubre semanas después.
3. **Lo dudoso se encola, no se adivina.** Un código desconocido en mitad de una ráfaga no
   interrumpe y no inventa: espera a la pantalla de revisión.

## Reglas que se aplican a todas

Las mismas de la v0.1 y la v0.2, de [`DevelopStyle.md`](../../../../Trabajo/Desarrollo/DevelopStyle.md):

- Métodos de 30 líneas como máximo, bloques `try` de 7.
- Docstrings con Args y Returns en todo lo público. Sin números mágicos: a `app/constants.py` o a
  `frontend/src/constants/`.
- Tests `test_<método>_<escenario>_<resultado>`, con caso normal, límites y errores.
- Sin inyección de dependencias nueva. La lógica en servicios, no en routers.
- Cada spec termina en **Criterios de aceptación** y **Fuera de alcance**, y añade una sección de
  **Verificación** al implementarse.

## Trampas del proyecto que afectan a estas specs

| Trampa | Dónde aparece |
|---|---|
| La regla de stock bajo está escrita **tres veces** (propiedad, SQL y `computeStockStatus`) | Spec 04 no decide qué es «bajo»: pregunta por lo que el historial da por agotado. **No la toca** |
| Una sola fila de inventario por EAN | Spec 01 cuelga el historial del EAN, no de la fila, justamente por esto |
| Un producto está en una sola ubicación | Spec 02: un mismo EAN escaneado dos veces en una ráfaga no puede ir a dos sitios |
| Todo acceso a `localStorage` va envuelto | Specs 02 y 03 recuerdan ahí el modo activo |
| El verde solo para acciones y datos destacados (S-04) | Spec 03: el modo consumir **no** se marca en verde |
| La cámara solo funciona en contexto seguro (HTTPS) | Spec 02 alarga mucho la sesión de cámara: hay que probarla en el iPhone de verdad, no solo en el portátil |
| Después de tocar un endpoint o un esquema, `export_openapi` | Spec 01, que añade endpoints y cambia `InventoryPatch` |

## Numeración de migraciones

`0003` es el registro de movimientos y `0004` el repaso semanal (esta iteración). `0005` es la tabla
de la lista de la compra manual ([v0.2/04](../v0.2/04-lista-de-la-compra-manual.md)), ya
implementada. Las recetas ([`v0.2/03-recetas.md`](../v0.2/03-recetas.md)), que citan `0003`, pasarían
a `0006` cuando se retomen.

## Pendientes de antes que siguen abiertos

De la v0.1 y la v0.2, no son parte de esta iteración pero siguen ahí: probar la cámara en el
iPhone (**que esta iteración vuelve crítico**, ver la tabla de trampas), el despliegue con
`alembic stamp 0001`, los EAN de F-12 y **los commits**, que siguen sin hacerse: el árbol de
trabajo tiene la v0.2 entera sin confirmar.
