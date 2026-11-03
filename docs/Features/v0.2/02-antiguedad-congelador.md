# Spec 02 · Antigüedad en el congelador

**Cubre:** N-02
**Estado:** implementada (2026-11-03). Ver [Verificación](#verificación-2026-11-03).
**Toca la BD:** no.
**Depende de:** nada.

## Punto de partida

`frozen_at` existe desde la migración `0002` y **se escribe pero no se lee en ninguna parte**:

| Dónde | Qué pasa hoy |
|---|---|
| `utils/freezer.ts` | Lo rellena con `localIsoDate()` al añadir al congelador o al mover algo allí |
| `components/FreezerFields.tsx` | Campo de fecha editable en los formularios de alta |
| `screens/detail/ManageStockCards.tsx` | Campo de fecha editable en el detalle |
| `screens/Pantry.tsx:206` | **No aparece.** `PantryItemDetails` solo compone marca, cajón y nota |
| Cualquier aviso o cálculo | **No existe** |

O sea: el dato lleva recogiéndose desde la v0.1 y no sirve para nada. Este spec lo hace visible y
lo convierte en el aviso de «esto hay que gastarlo».

Un congelador de cuatro cajones es exactamente donde se pierde la comida, y es lo único de la
aplicación que ya tiene la información necesaria para evitarlo.

## Comportamiento

### Cuánto tiempo lleva congelado

Nueva función pura en `utils/freezer.ts`:

```
monthsFrozen(frozenAt, today) → número de meses completos, o null
formatFrozenAge(frozenAt, today) → texto corto, o null
```

Reglas de redacción, de más corto a más largo:

| Días transcurridos | Texto |
|---|---|
| 0 | `Hoy` |
| 1 | `Ayer` |
| 2 a 30 | `Hace 12 días` |
| 31 a 60 | `Hace 1 mes` |
| más de 60 | `Hace 3 meses` |

Casos límite, que son los que rompen esto en la práctica:

- `frozen_at` nulo o vacío → `null`, no se muestra nada. Los artículos de antes de la `0002` no
  tienen fecha, y son reales: hay 18 filas de inventario anteriores a la migración.
- Fecha **futura** (reloj del móvil mal, o un dedazo al escribir) → se trata como `Hoy`. Nunca
  «hace −3 días».
- Fecha no interpretable → `null`, sin lanzar. La pantalla no se cae por un dato malo.
- Se compara por día local, con `localIsoDate`, no por hora UTC: la fecha se escribió con el
  calendario del dispositivo y hay que leerla igual.

### En la lista del congelador

- `PantryItemDetails` añade la antigüedad a la línea de detalle, **solo en el congelador**:
  `marca · Cajón 2 · Hace 3 meses · nota`.
- Se inserta después del cajón y antes de la nota.
- En la despensa no se muestra nunca, aunque la fila tuviera fecha.
- **Riesgo:** la línea ya usa `truncate` y ahora puede llevar cuatro trozos. Con un nombre de marca
  largo, lo primero que se corta es justo la antigüedad, que es lo que importa en el congelador.
  Hay que mirarlo a 380 px. Si estorba, la salida es quitar la marca en el congelador, no
  acortar la antigüedad.

### Aviso de lo que lleva demasiado

- Un artículo con `monthsFrozen >= FREEZER_STALE_MONTHS` se marca.
- La marca es un icono `schedule` de Material Symbols en color `on-surface-variant`, junto a la
  antigüedad, con `aria-label="Lleva mucho tiempo congelado"`.
- **No usa verde**: no es interactivo ni un dato destacado (regla S-04 de la v0.1).
- Tampoco usa el acento de error de la tarjeta: ese ya significa «sin stock» y mezclarlos haría
  ilegibles los dos.
- `FREEZER_STALE_MONTHS = 6` en `constants/inventory.ts`, con nombre, no suelto.

Seis meses es un valor único para todo. Lo correcto sería por tipo de alimento (la carne picada
aguanta 3 o 4 meses y la verdura 12), pero eso necesita categorías fiables, que es N-03. Un
umbral único y honesto ahora vale más que una tabla de categorías a medias.

### Ordenar por antigüedad

- En la pestaña Congelador, un control para ordenar: **«Más antiguo primero»** o «Por nombre».
- Por defecto, más antiguo primero. Es la pregunta que se le hace a un congelador: qué toca gastar.
- Los artículos sin fecha van al final, no al principio: no se sabe si son viejos y no deben
  encabezar la lista.
- En la despensa el control no aparece.
- La elección **no se recuerda** entre sesiones. Es una pantalla con dos opciones; guardarla
  añadiría otra clave de `localStorage` a cambio de nada.

### En el detalle

Junto al campo de fecha de congelación, el mismo texto en `text-body-sm text-on-surface-variant`,
para confirmar lo que la fecha significa sin tener que contar meses a mano.

## Cambios

| Archivo | Cambio |
|---|---|
| `utils/freezer.ts` | `monthsFrozen` y `formatFrozenAge`, puras |
| `constants/inventory.ts` | `FREEZER_STALE_MONTHS = 6` |
| `screens/Pantry.tsx` | Antigüedad e icono en `PantryItemDetails`; orden en la pestaña del congelador |
| `screens/detail/ManageStockCards.tsx` | Texto de antigüedad junto al campo de fecha |

Nada del backend, ninguna migración, ningún endpoint. **No hace falta** `export_openapi`.

## Tests

`monthsFrozen` y `formatFrozenAge`, con la fecha de hoy inyectada para que no dependan del reloj:

- Hoy devuelve «Hoy».
- Ayer devuelve «Ayer».
- Hace 12 días devuelve «Hace 12 días».
- Hace 30 días devuelve días, y hace 31 devuelve «Hace 1 mes» (el límite exacto).
- Hace 95 días devuelve «Hace 3 meses».
- `null` devuelve `null`.
- Una fecha futura devuelve «Hoy», no un número negativo.
- Una fecha inválida devuelve `null` y no lanza.
- `monthsFrozen` justo en 6 meses cuenta como pasado el umbral, y en 5 no (el límite exacto).

Lista:

- Un artículo del congelador con fecha muestra la antigüedad.
- Un artículo del congelador sin fecha no muestra ninguna antigüedad.
- Un artículo de la despensa con fecha no la muestra.
- La línea compone marca, cajón, antigüedad y nota en ese orden.
- Un artículo de más de 6 meses muestra el icono, con su nombre accesible.
- Uno de 2 meses no lo muestra.
- Ordenar por antigüedad pone el más viejo primero y los sin fecha al final.
- El control de orden no aparece en la despensa.

Detalle:

- El detalle de un artículo congelado muestra la antigüedad junto a la fecha.

## Criterios de aceptación

- [ ] En el congelador veo cuánto lleva congelada cada cosa.
- [ ] Lo que lleva más de seis meses está marcado.
- [ ] Puedo ordenar el congelador por lo más antiguo.
- [ ] Lo que no tiene fecha no miente: no muestra antigüedad y no encabeza la lista.
- [ ] En la despensa nada de esto aparece.
- [ ] Una fecha futura o mal escrita no rompe la pantalla.
- [ ] A 380 px, con marca y nota largas, la línea sigue legible.

## Fuera de alcance

| Qué | Por qué |
|---|---|
| Umbral por tipo de alimento | Necesita categorías fiables: es N-03 |
| Umbral configurable en Ajustes | Una constante basta hasta saber si 6 meses es el número bueno |
| Aviso en Inicio o notificación | Inicio es para el stock bajo; el aviso automático es N-15, que aplazaste |
| Fecha de congelación por lote | Hay una fila por EAN: es N-21 |
| Caducidad de la despensa | Es N-05, otra iteración |

## Verificación (2026-11-03)

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| En el congelador veo cuánto lleva congelada cada cosa | ✔ | `utils/freezer.test.ts` (`formatFrozenAge`); `Pantry.test.tsx` (`test_pantry_freezerItemWithFrozenDate_showsAge`) |
| Lo que lleva más de seis meses está marcado | ✔ | `test_isFreezerStale_sixMonths_isStale`; `test_pantry_freezerItemOverSixMonths_showsStaleIcon` |
| Puedo ordenar el congelador por lo más antiguo | ✔ | `test_pantry_sortByAge_defaultOrdersOldestFirst`, `..._sortByName_...` |
| Lo que no tiene fecha no miente: no muestra antigüedad y no encabeza la lista | ✔ | `test_formatFrozenAge_missingDate_returnsNull`; `test_compareByFreezerAge_missingDate_goesLast`; `test_pantry_freezerItemWithoutDate_showsNoAgeAndSortsLast` |
| En la despensa nada de esto aparece | ✔ | `PantryItemDetails` solo calcula `ageLabel` cuando `isFreezer`; el control de orden solo se muestra en el congelador (`test_pantry_sortControl_notShownInPantryTab`) |
| Una fecha futura o mal escrita no rompe la pantalla | ✔ | `test_formatFrozenAge_futureDate_returnsHoyNotNegativeDays`, `test_formatFrozenAge_invalidText_returnsNullWithoutThrowing` |
| A 380 px, con marca y nota largas, la línea sigue legible | ⚠ | No hay navegador en esta sesión. La línea ya usaba `truncate` antes de este cambio; no se ha comprobado visualmente con los cuatro trozos a la vez |

Tests: 27 nuevos en `utils/freezer.test.ts`, 7 nuevos en `Pantry.test.tsx`, 1 nuevo en
`ProductDetail.test.tsx` (antigüedad junto a la fecha en el detalle). `tsc --noEmit` y la
suite completa (404 tests) en verde. No se ha tocado el backend ni `docs/openapi.json`.
