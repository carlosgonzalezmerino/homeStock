# Spec 04 · Repaso semanal

**Cubre:** U-04
**Estado:** implementada (2026-11-03). Ver [Verificación](#verificación-2026-11-03).
**Toca la BD:** sí, migración `0004` (una columna nullable).
**Depende de:** [Spec 01](01-registro-de-movimientos.md) (el historial es lo que se mide).
**Decisión E6:** el repaso **espera a que abras la aplicación**. No avisa solo.

## El problema

Aunque entrar y gastar cueste poco, habrá deriva: una compra suelta sin escanear, un yogur que se
tira sin pasarlo. La spec no intenta evitarlo: **lo acepta y lo corrige barato**. Una vez por
semana, en un minuto, solo se pregunta por lo que el historial dice que **debería haberse acabado**.

## Qué se pregunta (y qué no)

Solo productos que **ya están en la despensa con stock > 0**. Hay dos motivos, en este orden:

### 1. `overdue` · «debería haberse acabado»

Para cada producto con consumo medible:

```
consumido     = suma de -delta de los movimientos `consume` de los últimos 90 días
observado     = días desde el primer consumo de la ventana, con mínimo de 7
ritmo         = consumido / observado               (unidades al día)
referencia    = el más reciente de: último movimiento, `checked_at`, alta de la fila
fin_estimado  = referencia + stock / ritmo
```

Entra si `fin_estimado <= ahora`. «Según tu ritmo, ya debería haberse acabado y nadie ha registrado
nada desde entonces.» Se ordena por quien lleva más tiempo pasado.

Solo hay ritmo con **al menos 3 movimientos `consume`** en la ventana. Con menos no se pregunta por
este motivo: dos datos no son un ritmo, son una anécdota.

### 2. `stale` · «hace mucho que no se toca»

Productos **sin ritmo medible** cuya referencia es de hace `STALE_DAYS` (60) o más. **No se pregunta
por congelador**: que algo lleve meses ahí es lo esperable, y su antigüedad ya se muestra aparte.
Un producto con ritmo medible que no está pasado **nunca** entra por este motivo: ya se sabe que va
bien.

### Tope y arranque en frío

Máximo `MAX_REVIEW_CARDS` (10) por repaso, primero los `overdue`. Con la base recién migrada solo
hay movimientos `initial`, así que **no habrá ritmos**: el repaso empieza vacío y solo trae
`stale`. Es lo correcto y honesto, y se dice: «Aún no hay historial suficiente».

## Qué hace cada respuesta

La tarjeta muestra el producto, el stock registrado y un **stepper** empezando en ese valor.

| Acción | Efecto |
|---|---|
| **«Sigue igual»** (stepper sin tocar) | `POST /api/review/{ean}/confirm`: guarda `checked_at = ahora`. **Sin movimiento**: nada cambió |
| **«Guardar N»** (stepper movido) | `PATCH` de cantidad con `reason = consume` si baja o `purchase` si sube, `source = review` |
| **«Se acabó»** | `PATCH` a 0, `reason = consume`, `source = review` |
| **«Saltar»** | Nada. Volverá en el próximo repaso |

Bajar y «Se acabó» se registran como `consume`, **no** como `adjust`: es consumo no registrado a
tiempo, y alimenta el ritmo de la próxima vez.

Añadir `checked_at` a `inventory_items` es el único cambio de esquema: es lo único que no cabe en
un movimiento (`delta` nunca es 0).

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/review` | Hasta 10 candidatos: `ean`, `name`, `brand`, `image_url`, `quantity`, `unit`, `reason`, `estimated_empty_on` (fecha o `null`), `days_since_activity` |
| `POST` | `/api/review/{ean}/confirm` | Marca el producto como comprobado. `404` si no se sigue |

Hay que regenerar `docs/openapi.json`.

## Pantalla `/repaso`

Una tarjeta cada vez, grande, con barra de progreso «3 de 8».

- Tarjeta: miniatura, nombre, marca, «Debería quedarte unos 2» o «Hace 3 meses que no lo tocas»,
  stepper, botón principal dinámico, «Se acabó» y «Saltar».
- Fin: «Listo, N comprobados» con enlace a la despensa. Vacío: «No hay nada que repasar».
- Acceso desde **Inicio**: una tarjeta «Repaso semanal · N productos · 1 minuto» que solo aparece
  si hay candidatos. No es una pestaña nueva (la barra ya tiene cinco) ni un aviso: espera.

## Reglas del proyecto que afectan

| Regla | Cómo |
|---|---|
| La regla de stock bajo está en tres sitios | **No se toca.** Esta spec no decide qué es «bajo» |
| El verde solo para acciones | El botón principal en verde; las etiquetas de motivo, no |
| Funciones ≤ 30 líneas | El cálculo del ritmo se parte en pasos pequeños y testeables |
| Sin números mágicos | `RATE_WINDOW_DAYS`, `MIN_OBSERVED_DAYS`, `MIN_CONSUME_EVENTS`, `STALE_DAYS`, `MAX_REVIEW_CARDS` en `constants.py` |

## Criterios de aceptación

1. Un producto con 3 consumos que el ritmo da por agotado hace días aparece como `overdue`.
2. Uno con menos de 3 consumos no aparece como `overdue`.
3. Uno sin ritmo y sin actividad hace más de 60 días aparece como `stale`, salvo en el congelador.
4. Uno con ritmo y no pasado no aparece, aunque lleve más de 60 días sin tocar.
5. Nunca hay más de 10 y los `overdue` van antes que los `stale`.
6. «Sigue igual» no crea ningún movimiento y saca al producto del próximo repaso.
7. «Se acabó» deja stock 0 con un `consume` y `source = review`.
8. Con la base recién migrada, el repaso no explota: devuelve vacío o `stale`.
9. La migración `0004` sube y baja sin perder otros datos.

## Tests

| Fichero | Casos |
|---|---|
| `tests/services/test_review.py` | Los dos motivos; mínimos de eventos y de observación; congelador; tope; orden; `checked_at`; cola fría |
| `tests/api/test_review.py` | Contrato; `404` en confirmar; efecto sobre el siguiente `GET` |
| `tests/test_migrations.py` | `0004` sube y baja |
| `src/screens/Review.test.tsx` | Una tarjeta cada vez; botón dinámico; cada acción llama a lo suyo; fin; vacío |
| `src/screens/Dashboard.test.tsx` | La tarjeta solo aparece con candidatos |

## Fuera de alcance

- Avisar solo (E6, y N-15 de la v0.2 que ya se descartó).
- Estacionalidad o ritmos por día de la semana: un promedio simple basta para una casa.
- Que el ritmo mueva el umbral automáticamente (U-08).
- Repaso de caducidades (U-10).


## Verificación (2026-11-03)

**Qué se hizo.** Migración `0004` (`checked_at`); `ReviewService` (ritmo de consumo, `overdue` y
`stale`, tope de 10, congelador excluido de `stale`); `GET /api/review` y
`POST /api/review/{ean}/confirm`; pantalla `/repaso` de una tarjeta cada vez; tarjeta de entrada en
Inicio que solo aparece si hay candidatos.

**Cómo se comprobó.**

| Comprobación | Resultado |
|---|---|
| Servicio de repaso: 15 casos (ritmo medible, mínimo de 3 consumos, suelo de 7 días de observación, `stale` a los 60 días, congelador, tope, orden, arranque en frío) | Verdes, con el reloj controlado |
| Mutación: contar el congelador como `stale` | Hace fallar el test; restaurado |
| Mutación: no congelar la lista del repaso en pantalla | La primera versión del test **no la detectaba**; se reescribió y ahora sí |
| Recorrido real sobre la copia de tu base: `GET /api/review` | 10 candidatos, todos `stale`, como se esperaba |
| Migración `0004` subida y bajada sobre la copia | Correcta |

**Algo que vas a notar al desplegar.** Tu base no tiene historial de consumo (todo lo anterior son
movimientos `initial` con la fecha de alta), así que **no habrá candidatos `overdue`** hasta que se
acumulen al menos 3 consumos por producto. Lo que verás al principio son hasta 10 tarjetas `stale`
(«Lo tocaste por última vez hace 3 meses»), porque tus productos se dieron de alta en julio y no se
han tocado desde. Es correcto, pero la primera vez puede parecer mucho. Con el uso, el repaso pasa a
preguntar solo por lo que de verdad debería haberse acabado.

**Desviaciones.**

- La acción «Guardar N» y «Se acabó» se registran como `consume` con `source = review`, y
  «Sigue igual» no escribe movimiento: como se pedía.
- «Saltar» no se guarda: el producto volverá en el siguiente repaso.

**No verificado.** Que el umbral de 60 días y el mínimo de 3 consumos sean los adecuados para tu
casa: son valores razonados, no medidos. Están en `app/constants.py` precisamente para ajustarlos.
