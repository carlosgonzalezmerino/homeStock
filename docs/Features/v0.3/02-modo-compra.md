# Spec 02 · Modo compra (ráfaga)

**Cubre:** U-02, y la parte de U-06 que le afecta
**Estado:** implementada (2026-11-03). Ver [Verificación](#verificación-2026-11-03).
**Toca la BD:** no.
**Depende de:** [Spec 01](01-registro-de-movimientos.md) (deshacer y `movement_id`).
**La reutiliza:** [Spec 03](03-modo-consumir.md) entera (mismo motor, mismo endpoint, signo invertido).

## El problema

Registrar una compra de 25 productos cuesta hoy ~75 toques y 25 arranques de cámara. La causa está
en dos sitios concretos del código:

| Dónde | Qué pasa |
|---|---|
| `BarcodeCameraScanner.handleDetection` | Llama a `this.stop()` tras **la primera** lectura. La cámara es de un solo disparo |
| `Scan.tsx` → `/scan/:ean` → `AddStockCard` | Cada producto navega a una pantalla de formulario y vuelve a `/scan` con la cámara en `idle` |

## Decisión de diseño: un endpoint de escaneo en el servidor

La ráfaga **no** compone `PATCH` desde el cliente. Usa un endpoint nuevo:

`POST /api/scan` con `{ ean, mode, location? }`, donde `mode` es `purchase` o `consume`.

Motivos, por orden de peso:

1. **Deshacer necesita el id del movimiento.** `PATCH /api/inventory/{ean}` devuelve la fila de
   inventario, no el movimiento. Cambiar eso rompería su contrato; un endpoint nuevo no.
2. **Es atómico.** Resolver el EAN (catálogo y OpenFoodFacts), seguir el producto si es nuevo y
   sumar es una sola operación con un solo movimiento, sin carreras entre peticiones del cliente.
3. **No asume navegador.** El escáner de pared (H-01, decisión E3) llamará a este mismo endpoint
   con `source = device` y no habrá que escribir la lógica dos veces.

### Respuesta: `ScanResult`

Todos los desenlaces de negocio son `200`. «No conozco ese código» es una respuesta normal, no un
error: el cliente tiene que poder encolarlo sin tratar una excepción.

| `status` | Cuándo | ¿Cambia el stock? |
|---|---|---|
| `applied` | El producto ya se seguía y el stock cambió | Sí |
| `created` | `purchase` de un producto del catálogo que **no** se seguía: se empieza a seguir con valores por defecto | Sí |
| `already_empty` | `consume` de algo con stock 0 | No |
| `not_tracked` | `consume` de un producto conocido que no está en la despensa | No |
| `unknown` | Nadie conoce el EAN (ni catálogo ni OpenFoodFacts) | No |

Campos: `status`, `mode`, `ean`, `name`, `image_url`, `quantity_before`, `quantity_after`, `unit`,
`movement_id`, `low`. Los que no aplican van a `null`.

### Reglas del servidor

- **Paso de 1.** `purchase` suma 1, `consume` resta 1 (constante `SCAN_STEP`). Si queda menos de 1,
  `consume` resta lo que haya: nunca deja el stock negativo y el `delta` es el real.
- **Alta por defecto** (`created`): cantidad 1, umbral `DEFAULT_THRESHOLD` (2), unidad por defecto,
  ubicación la que mande el cliente (la pestaña activa) o la despensa. Se pueden corregir después.
- El `reason` es `purchase` o `consume`; el `source` es `scan` salvo que llegue la cabecera
  `X-HomeStock-Source` (así `device` o `ticket` entran por el mismo sitio).
- `consume` **nunca** crea un producto ni lo empieza a seguir. Restar algo que no está es un error
  de lectura, no una orden.

## Comportamiento en la pantalla de escaneo

### Tres modos

Un selector bajo el visor: **Detalle · Compra · Gastar**.

| Modo | Qué hace una lectura |
|---|---|
| **Detalle** | Lo de siempre: abre `/scan/:ean`. Es el modo por defecto, para no cambiar el flujo que ya se conoce |
| **Compra** | `POST /api/scan` en modo `purchase`. La cámara **sigue encendida** |
| **Gastar** | Spec 03 |

El modo se recuerda en `localStorage` (`scanMode`), envuelto como el resto. Solo se recuerdan
`detail` y `purchase`: **`consume` nunca se guarda ni se restaura** (regla 2 del README).

### Motor de cámara continuo

`BarcodeCameraScanner` gana un modo continuo, activable por callback (`isContinuous`) que se lee en
cada lectura, de modo que cambiar de modo **no reinicia la cámara**.

- En continuo, `handleDetection` no llama a `stop()`: entrega el código y el bucle sigue.
- **Anti-rebote en el propio motor.** El mismo código visto dentro de `REPEAT_SUPPRESSION_MS`
  (1500 ms) **desde la última vez que se vio** se descarta, y cada avistamiento renueva la ventana.
  Así un producto quieto delante de la cámara cuenta una vez, y para sumar otra unidad hay que
  retirarlo un momento. Un código distinto entra siempre.
- El modo de un solo disparo no cambia, y sus tests tampoco.

### Respuesta inmediata al escanear

Se comprueba **tres canales a la vez**, porque quien escanea mira el producto, no la pantalla:

- Sonido corto (WebAudio) con tono distinto para éxito, aviso y fallo.
- Vibración (`navigator.vibrate`), donde exista. Safari iOS no la tiene.
- Hoja inferior visual.

El sonido y la vibración van envueltos en `try`/`catch` con aviso por consola y **nunca** rompen el
escaneo. El contexto de audio se crea al pulsar «Activar cámara», que es un gesto del usuario, porque
los navegadores lo exigen.

### Hoja de resultado

Anclada sobre la barra de navegación, no tapa el visor. Muestra miniatura, nombre y el efecto
(`+1 · ahora 3`), más el botón **Deshacer**.

- Se cierra sola a los `RESULT_SHEET_MS` (2500 ms). Una lectura nueva **sustituye** a la anterior:
  solo la última es deshacible.
- **Deshacer** llama a `POST /api/movements/{id}/undo`, confirma «Deshecho» y actualiza la sesión.
- `created` lo marca como **nuevo** («Nuevo en la despensa»), para que se vea que se ha dado de alta.
- `unknown` no dice «error»: dice «Código sin identificar, queda para revisar».

### La sesión de compra

Una lista persistente (`localStorage`, clave `purchaseSession`) de lo escaneado en este rato:

```
líneas:      ean → { nombre, imagen, unidades, nuevo, ids de movimiento }
sin identificar: [ean, ...]
```

Sobrevive a una recarga, porque en el súper o al descargar bolsas la pantalla se apaga. Deshacer
resta de la línea y, si llega a 0, la quita.

### Pantalla «Revisar compra» (`/scan/revisar`)

Botón **«Terminar (N)»** en el visor, visible con la sesión no vacía. Muestra tres bloques:

1. **Añadido:** una fila por línea con `×unidades`. Tocar abre `/despensa/:ean` para corregir.
2. **Nuevos, revisa el umbral:** las `created`. Tocar abre lo mismo, donde está el umbral.
3. **Sin identificar:** los EAN desconocidos, con «Dar de alta». Abre el alta manual con
   `state.returnTo = "/scan/revisar"` y, al guardar, **vuelve aquí**. Un EAN que ya aparece en el
   inventario desaparece de este bloque solo.

«Terminar» vacía la sesión y va a la despensa con el aviso de producto añadido.

## U-06: no bloquear el detalle esperando al inventario

`ProductDetail` hoy espera a `useResolve` **y** a `useInventory` entero antes de pintar nada. Solo
el modo `scan` necesita el inventario para decidir entre «producto nuevo» y «ya existe»; la cabecera
del producto no. **Fuera de alcance de esta entrega** salvo que estorbe: la ráfaga no pasa por el
detalle, así que el coste que se medía ya no aplica a la compra. Se deja anotado.

## Reglas del proyecto que afectan

| Regla | Cómo |
|---|---|
| El verde solo para acciones | «Terminar» y «Compra» activo van en verde; la hoja de resultado, **no** |
| Todo `localStorage` envuelto | `scanMode` y `purchaseSession`, con aviso por consola si falla |
| La cámara exige HTTPS | La sesión de cámara dura mucho más: **hay que probarla en el iPhone**, no basta el portátil |
| Una fila de inventario por EAN | Dos lecturas del mismo EAN suman a la misma fila |

## Criterios de aceptación

1. En modo Compra, escanear 3 productos distintos deja la cámara encendida todo el rato y 3
   movimientos `purchase` con `source = scan`.
2. El mismo código visible de forma continua cuenta **una vez**; tras retirarlo más de 1,5 s y
   volver a mostrarlo, cuenta otra.
3. `POST /api/scan` en `purchase` sobre un producto sin seguir lo crea con cantidad 1, umbral por
   defecto y devuelve `created`. Sobre uno ya seguido suma 1 y devuelve `applied`.
4. Un EAN desconocido devuelve `200` con `unknown`, no cambia nada y queda en «Sin identificar».
5. Deshacer una lectura `created` hace que el producto **deje de seguirse**.
6. Una recarga a mitad de sesión conserva líneas y sin identificar.
7. Cambiar de Compra a Detalle con la cámara encendida **no** la reinicia.
8. Si el audio o la vibración fallan, el escaneo sigue funcionando.
9. `docs/openapi.json` regenerado, backend ≥ 80 %, `ruff` limpio, `npm run check` verde.

## Tests

| Fichero | Casos |
|---|---|
| `tests/services/test_scan.py` | Los cinco `status`; paso de 1; fracción menor que 1; ubicación al crear; `consume` no crea |
| `tests/api/test_scan.py` | Contrato; `422` por modo o EAN inválido; cabecera de origen |
| `src/scanner/scanner.test.ts` | Continuo no se detiene; anti-rebote; código distinto entra; renovación de ventana; un solo disparo intacto |
| `src/screens/Scan*.test.tsx` | Cambio de modo; lectura en Compra llama a `/scan`; hoja; deshacer; encolado de desconocidos |
| `src/hooks/usePurchaseSession.test.tsx` | Alta, suma, deshacer hasta 0, persistencia, almacenamiento bloqueado |
| `src/screens/ReviewPurchase.test.tsx` | Tres bloques; vuelta desde el alta manual; terminar vacía la sesión |

## Fuera de alcance

- Cantidad editable en la propia hoja (se corrige en la revisión o en el detalle).
- Escanear varias unidades del mismo producto de una vez («×6»).
- Reordenar por pasillo, y la ráfaga sin conexión (N-08).


## Verificación (2026-11-03)

**Qué se hizo.** `POST /api/scan` y `ScanService`; modo continuo en `BarcodeCameraScanner` con
anti-rebote; selector Detalle · Compra · Gastar; hoja de resultado con **Deshacer**; sonido y
vibración; sesión de compra persistente; pantalla `/scan/revisar`; el alta manual vuelve a donde se
le pida (`state.returnTo`, solo rutas internas).

**Cómo se comprobó.**

| Comprobación | Resultado |
|---|---|
| Frontend completo | **543 tests** (404 antes), todos verdes; cobertura **95,5 %**; `tsc` limpio |
| Los tests antiguos de `Scan` (modo de un solo disparo) | Pasan **sin modificar**: el modo por defecto sigue siendo Detalle |
| Recorrido real contra el servidor con datos reales (copia): compra → `applied`; desconocido → `200 unknown`; modo y origen inválidos → `422` | Correcto |
| Mutaciones deliberadas (quitar el anti-rebote, persistir la sesión) | Hacen fallar tests; restaurado |
| `vite build` de producción | Compila; las clases de la hoja (`w-[calc(100%-2rem)]`, `bottom-24`, ...) existen en el CSS generado |

**Desviaciones.**

- **La hoja de resultado dura 2500 ms**, no 2000: `RESULT_SHEET_MS`.
- **No es «optimista».** El servidor decide el resultado, así que la hoja aparece al responder el
  `POST` (red local, milisegundos). El pitido se da en ese momento, no al detectar el código.
- **U-06** (no bloquear el detalle esperando al inventario) **no se tocó**: la ráfaga no pasa por el
  detalle, que era donde se medía el coste.
- El modo Detalle se mantiene por defecto en vez de pasar a Compra: no se cambia el flujo conocido.

**Bugs encontrados por los tests.**

- `usePurchaseSession` persistía desde un `useEffect`. «Terminar» vacía la sesión y cambia de
  pantalla en el mismo clic, así que el efecto no llegaba a ejecutarse y **la sesión vieja
  reaparecía** en el siguiente `/scan`. Ahora se calcula y guarda de forma síncrona, con test de
  regresión.

**No verificado.**

- **La cámara en un iPhone real.** La sesión de cámara dura ahora mucho más que antes y Safari es
  el caso delicado (vibración inexistente, `AudioContext` que exige un gesto). Es el riesgo principal.
- **La revisión visual a 380 px** (hoja flotante sobre la barra de 5 pestañas). No había navegador
  utilizable en el entorno; lo único comprobado es que el CSS se genera.
- El anti-rebote de 1,5 s es un valor razonado, no medido con productos reales delante de la cámara.
