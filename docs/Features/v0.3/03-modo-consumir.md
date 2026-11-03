# Spec 03 · Modo consumir

**Cubre:** U-03 (= N-06 de la v0.2)
**Estado:** implementada (2026-11-03). Ver [Verificación](#verificación-2026-11-03).
**Toca la BD:** no.
**Depende de:** [Spec 01](01-registro-de-movimientos.md) y [Spec 02](02-modo-compra.md).
**Prepara:** el escáner de pared H-01, que llamará al mismo `POST /api/scan` con `mode = consume`.

## El problema

Cada vez que se gasta algo, registrarlo cuesta cinco acciones (desbloquear, abrir, pestaña,
buscar, tocar «−») para algo que físicamente dura dos segundos. El resultado es la **deriva**:
el inventario deja de ser verdad y, con él, la lista de la compra.

## La idea

El momento en que algo se acaba es el momento en que se **tira el envase**. Es un gesto que ya
existe, diario y fiable. La spec engancha el registro a ese gesto: envase vacío en la mano,
escaneo, a la basura.

Es el mismo motor de cámara continua y el mismo `POST /api/scan` de la spec 02, con el signo
invertido. No se construye nada nuevo en el motor.

## Las tres reglas de seguridad

Restar es **peor** que sumar por error: un `+1` indebido se ve en la despensa; un `−1` silencioso
se descubre semanas después, cuando la lista de la compra miente. Por eso esta spec existe aparte y
no es «un modo más»:

1. **Se entra a propósito.** Gastar es una pestaña del selector, nunca el modo por defecto, y
   **nunca se recuerda entre sesiones** (decisión E5). Salir de la pantalla y volver deja el modo
   en Detalle o Compra. `consume` no se escribe en `localStorage`.
2. **Se ve que se está en él.** Banner permanente «Modo gastar · cada lectura resta 1», marco del
   visor y pestaña activa en el color de aviso (`tertiary`), **no en verde**. El verde es para
   acciones (S-04); aquí informa de que cada lectura tiene consecuencias.
3. **Nada se confirma sin poder deshacerse.** Cada lectura deja la hoja de resultado con
   **Deshacer** (spec 02) durante `RESULT_SHEET_MS`.

## Comportamiento

| Lectura | Efecto | Hoja |
|---|---|---|
| Producto seguido con stock | `−1` (o lo que quede si es menos de 1). Movimiento `consume`, `source = scan` | «−1 · quedan 2» |
| Queda 0 tras restar | Igual | «Se acabó» |
| Producto seguido, stock ya 0 | No cambia nada (`already_empty`) | «Ya estaba agotado» |
| Producto conocido pero no seguido | No cambia nada (`not_tracked`) | «No está en tu despensa» |
| Código desconocido | No cambia nada (`unknown`) | «Código sin identificar» |

Las tres últimas usan el tono de **aviso** y vibración de aviso, no de éxito: son lecturas que no
han hecho lo esperado y quien escanea tiene que enterarse sin mirar.

### La lista de la compra no se toca

> **Cambiado (2026-11-03).** Esta spec se escribió cuando la lista de la compra se derivaba del
> stock, y decía «Se acabó · ya está en la lista» con un enlace. La [Spec 04 de v0.2](../v0.2/04-lista-de-la-compra-manual.md)
> la convirtió en una lista **propia**: solo contiene lo que el usuario añade, y estar a 0 no mete
> nada. Esa frase habría sido falsa, así que la hoja dice solo «Se acabó».

Añadir a la lista desde el escáner es una decisión de interfaz propia (N-09), fuera de alcance de la
Spec 04 y de esta.

### Cantidades

Siempre `−1`. Consumos parciales («medio paquete») quedan fuera de alcance: se corrigen en la
despensa con el stepper, que registra `consume`/`purchase` según el signo (spec 01).

## Detalles de implementación

- El selector de modo gana un estilo de pestaña activa por opción (`activeClass`), para que
  «Gastar» no use el verde de acción. `SegmentedControl` sigue igual para el resto de la app.
- La hoja de resultado es la misma de la spec 02, con una variante de contenido.
- Al pasar de Gastar a otro modo con la cámara encendida, no se reinicia (spec 02).
- Las cadenas de `mode` viajan como `"purchase" | "consume"`; hay un único sitio que las define.

## Criterios de aceptación

1. Escanear un producto con stock 3 en Gastar lo deja en 2, con un movimiento `consume` de `−1`.
2. Escanear uno con stock 0,5 lo deja en 0 con `delta = −0,5`.
3. Escanear uno con stock 0 no cambia nada y avisa; no genera movimiento.
4. Escanear un producto conocido pero no seguido **no lo crea**.
5. Al llegar a 0 la hoja dice solo «Se acabó» y **no** afirma nada sobre la lista; `GET /api/shopping-list`
   sigue sin devolver el producto (la lista solo tiene lo que se añade).
6. Salir de `/scan` y volver, tras estar en Gastar, abre en Detalle o Compra, nunca en Gastar.
7. `localStorage` no contiene `consume` en ningún momento.
8. El modo Gastar no usa el color de acción en banner, marco ni pestaña activa.
9. Deshacer una lectura devuelve el stock a su valor anterior.

## Tests

| Fichero | Casos |
|---|---|
| `tests/services/test_scan.py` | Resta 1; fracción; ya vacío; no seguido no se crea; desconocido |
| `tests/api/test_scan.py` | El flujo completo de consumo; gastar hasta 0 **no** mete el producto en la lista |
| `src/screens/Scan.consume.test.tsx` | Modo no persistido; banner; hoja «se acabó» con enlace; avisos de las tres lecturas inertes |
| `src/utils/scanMode.test.ts` | Lectura y escritura de modo: `consume` nunca se guarda ni se restaura |

## Fuera de alcance

- Cantidad por defecto por producto (el *quick consume amount* de Grocy).
- Distinguir **abrir** de **consumir** (U-09).
- Consumo por voz o NFC (H-03, H-05).
- Motivo `waste` desde la interfaz (N-13).


## Verificación (2026-11-03)

**Qué se hizo.** Modo «Gastar» sobre el mismo motor y endpoint de la spec 02: banner permanente,
marco del visor y pestaña activa en `tertiary`, nunca en verde; `consume` no se guarda en
`localStorage` ni se restaura; la hoja dice «Se acabó» (ver el aviso de la sección «La lista
de la compra no se toca»).

**Cómo se comprobó.**

| Comprobación | Resultado |
|---|---|
| Servicio y API de `consume`: resta 1, fracción, ya vacío, no seguido (**no se crea**), desconocido | Tests verdes |
| Tras gastar hasta 0, `GET /api/shopping-list` **no** devuelve el producto, y la hoja no habla de la lista | Test de API y de pantalla verdes |
| `consume` nunca se escribe; si algo lo escribe, no se restaura | 8 tests de `scanMode`, más el de pantalla |
| Mutación: dejar que `consume` se recuerde | Hace fallar **5 tests**; restaurado |
| Recorrido real contra el servidor (copia de tu base): `consume` de 5 → 4 con movimiento `consume` / `scan` | Correcto |
| Deshacer un `consume` devuelve la unidad | Cubierto por tests de servicio y de API; **no** se repitió en el recorrido real (ahí se deshizo la compra) |

**Desviaciones.** Una, posterior: al pasar la lista de la compra a ser manual (v0.2/04), la hoja dejó de
decir «ya está en la lista» y el enlace desapareció. «Añadir a la lista» desde el escáner sigue sin
existir como acción (N-09).

**No verificado.** Lo mismo que la spec 02: cámara en iPhone y revisión visual. Especialmente que el
color de aviso de «Gastar» se distinga bien con la pantalla a poco brillo.
