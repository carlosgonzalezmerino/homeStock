# homeStock v0.3 · Specs de implementación

Convierte en specs implementables lo elegido de [`version0.3.md`](../version0.3.md), que es el
catálogo completo con el diagnóstico, las alternativas y el hardware.

**Estado:** spec 01 escrita, sin implementar. Las specs 02, 03 y 04 se escribirán en ese orden,
cada una cuando la anterior esté cerrada.

## Specs

| Spec | Cubre | Toca la BD | Estado |
|---|---|---|---|
| [01 · Registro de movimientos](01-registro-de-movimientos.md) | U-01 (= N-04) | **Sí**, migración `0003` | Escrita |
| 02 · Modo compra (ráfaga) | U-02 | No | Pendiente |
| 03 · Modo consumir | U-03 (= N-06) | No | Pendiente |
| 04 · Repaso semanal | U-04 | No | Pendiente |

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
| La regla de stock bajo está escrita **tres veces** (propiedad, SQL y `computeStockStatus`) | Spec 04 la usa para decidir a quién preguntar. **No la modifica** |
| Una sola fila de inventario por EAN | Spec 01 cuelga el historial del EAN, no de la fila, justamente por esto |
| Un producto está en una sola ubicación | Spec 02: un mismo EAN escaneado dos veces en una ráfaga no puede ir a dos sitios |
| Todo acceso a `localStorage` va envuelto | Specs 02 y 03 recuerdan ahí el modo activo |
| El verde solo para acciones y datos destacados (S-04) | Spec 03: el modo consumir **no** se marca en verde |
| La cámara solo funciona en contexto seguro (HTTPS) | Spec 02 alarga mucho la sesión de cámara: hay que probarla en el iPhone de verdad, no solo en el portátil |
| Después de tocar un endpoint o un esquema, `export_openapi` | Spec 01, que añade endpoints y cambia `InventoryPatch` |

## Choque de numeración de migraciones

[`v0.2/03-recetas.md`](../v0.2/03-recetas.md) reservaba la revisión `0003`. Como las recetas siguen
sin implementarse y esto sí va a hacerse, **`0003` es el registro de movimientos** y las recetas
pasarían a `0004`. Hay que corregir esa línea de la spec de recetas cuando se retome.

## Pendientes de antes que siguen abiertos

De la v0.1 y la v0.2, no son parte de esta iteración pero siguen ahí: probar la cámara en el
iPhone (**que esta iteración vuelve crítico**, ver la tabla de trampas), el despliegue con
`alembic stamp 0001`, los EAN de F-12 y **los commits**, que siguen sin hacerse: el árbol de
trabajo tiene la v0.2 entera sin confirmar.
