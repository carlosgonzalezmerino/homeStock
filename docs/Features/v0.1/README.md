# homeStock v0.1 · Specs de implementación

Convierte la lista de [`version0.1.md`](../version0.1.md) en specs implementables, y recoge cómo
quedó cada una. Cómo acabó la sesión que las implementó: [`SESSION-2026-11-02.md`](SESSION-2026-11-02.md).

**Estado:** implementada y verificada con tests. Pendiente la prueba en el iPhone y los datos de F-12.

## Specs

| Spec | Cubre | Toca la BD | Estado |
|---|---|---|---|
| [01 · Reglas de stock](01-reglas-de-stock.md) | F-03, F-04 | No | Implementada |
| [03 · Escáner y cámara](03-escaner.md) | F-11, F-12 | No | F-11 sin probar en iPhone. F-12 espera datos |
| [02 · Flujos de alta](02-flujos-de-alta.md) | F-01, F-02, F-05, F-09, F-10 | No | Implementada |
| [04 · Listas y alertas](04-listas-y-alertas.md) | F-13, F-15 | No | Implementada |
| [05 · Cajón, fecha y notas](05-datos-congelador-y-notas.md) | F-06, F-07, F-14 | **Sí** | Implementada, migración aplicada en local |
| [06 · Estilo visual](06-estilo-visual.md) | S-01 a S-06 | No | Implementada, salvo el bloque claro de Inicio |

Cada spec termina con una sección **Verificación** que marca cada criterio de aceptación como demostrado
por un test (✔), sin verificar (⚠) o con desviación (≠).

**Fuera de esta iteración:** F-08 (el mismo producto en dos ubicaciones), por decisión tuya.

## Decisiones

| # | Pregunta | Aplicado | Qué cambia si no te convence |
|---|---|---|---|
| D1 | ¿Cuándo está bajo un producto? | `cantidad == 0` o `cantidad < umbral` | Hay que cambiar el servidor y `computeStockStatus`, y los casos compartidos de los tests |
| D2 | ¿A dónde vuelve un producto al guardar? | Escaneado: al escáner, sin cámara. Manual y sin código: a la lista | Cambia `detail/navigation.ts` y los flujos |
| D3 | ¿Cómo se migra la base de datos? | Alembic | |
| D4 | ¿Dónde va la nota de F-14? | En el inventario | Otra migración |
| D5 | ¿Cómo se aplican las tarjetas claras? | Solo en la cabecera del detalle | El resumen de Inicio queda sin bloque claro |

D1, D2, D4 y D5 son propuestas mías que aplicaste sin una respuesta explícita. D3, F-06, F-08 y S-02 son tuyas.

## Dónde queda cada documento

- Arquitectura vigente: [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md)
- Base de datos y migraciones: [`docs/DATABASE.md`](../../DATABASE.md)
- Estrategia de tests y su evaluación: [`docs/TESTING.md`](../../TESTING.md)
- Specs anteriores: [`docs/superpowers/specs/`](../../superpowers/specs), cada una con un aviso de lo que ha cambiado

## Reglas que se aplicaron en todas las specs

Se sigue [`DevelopStyle.md`](../../../../Trabajo/Desarrollo/DevelopStyle.md):

- Métodos de 30 líneas como máximo y bloques `try` de 7. Se mide con un análisis del código, no a ojo.
- Docstrings con Args y Returns en todo lo público. Sin números mágicos.
- Tests con nombre `test_<método>_<escenario>_<resultado>`, con caso normal, límites y errores.
- Errores específicos y con mensajes comprensibles. Commits `tipo: descripción` (**no se ha hecho ninguno**).
- No se añadió inyección de dependencias nueva.
