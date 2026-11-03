# Spec 03 · Escáner y cámara

**Cubre:** F-11 (cámara siempre activa), F-12 (productos no detectados)
**Estado:** F-11 y F-12 (validación y diagnóstico) implementadas. Pendiente: probar F-11 en iPhone y el análisis de los productos de F-12.
**Depende de:** nada

---

## F-11 · La cámara solo funciona cuando se pide

### Causas

Todas salen de leer el código. **Ninguna se ha reproducido todavía en un iPhone.**

| # | Causa | Dónde | Efecto |
|---|---|---|---|
| 1 | La cámara arranca sola al volver de un alta | `Scan.tsx:67` | Se enciende sin pedirlo |
| 2 | Editar desde la lista también lleva al escáner | `useProductEditor.ts:12` | Agrava la causa 1. Se corrige en la Spec 02 |
| 3 | `stop()` no cancela un arranque en curso | `BarcodeCameraScanner.ts:73-83` | Si sales mientras `getUserMedia` espera (por ejemplo, con el aviso de permisos de iOS), al resolverse se marca activa y **la cámara queda encendida sin ninguna pantalla que la apague** |
| 4 | No se reacciona al pasar a segundo plano | `useScanner.ts` | El flujo de vídeo sigue abierto |
| 5 | El bucle de ZXing no se puede detener | `BarcodeCameraScanner.ts:182` | `decodeOnceFromVideoElement` sigue intentando hasta encontrar un código, y no expone cómo pararlo. Tras `stop()` queda consumiendo batería |
| 6 | Si falla crear el detector nativo, la cámara sigue encendida | `BarcodeCameraScanner.ts:166-169` | Se ve "Apunta al código", pero nunca detectará nada |

Sospecho que la causa 3 es la que hace que quede "todo el tiempo" activa. Es la única que deja la cámara encendida sin nada que la pueda apagar.

### Comportamiento

- La cámara solo arranca al pulsar **"Escanear"** (hoy "Activar cámara").
- Se apaga al detectar un código, al salir de la pantalla y al pasar la app a segundo plano.
- Al volver de segundo plano **no** se reanuda sola: hay que pulsar de nuevo.
- Si falla el detector, se apaga y muestra un error.

### Cambios

- `Scan.tsx`: `useAddedProductToast` deja de recibir y llamar a `startCamera`.
- `BarcodeCameraScanner.ts`:
  - Cada arranque recibe un identificador. Si `stop()` ocurrió durante `getUserMedia` o `play()`, al resolverse se libera el flujo y no se activa nada.
  - `isStarting` se reinicia en `stop()`, para poder volver a pulsar enseguida.
  - El camino de ZXing pasa a decodificar **un fotograma cada vez**: copia el vídeo a un canvas y llama a `reader.decodeFromCanvas(canvas)`. Es una llamada síncrona, así que parar el bucle la detiene de verdad.
  - El intervalo entre intentos es una constante, unos 100 ms, para no gastar un fotograma de CPU en cada refresco.
  - Si falla el detector nativo, llama a `stop()` y pasa al estado de error.
- `useScanner.ts`: escucha `visibilitychange` y `pagehide` y llama a `stop()`.

El cambio de ZXing necesita probarse en el iPhone. El historial muestra que `decodeFromVideoElement` ya dio problemas en Safari (`95bdb0d`), y este camino es el que usa iOS cuando no hay `BarcodeDetector`.

### Tests

- `start` seguido de `stop` antes de resolverse `getUserMedia`: el flujo se libera y el estado es `idle`.
- Dos `start` seguidos: solo se pide la cámara una vez.
- `stop` detiene todas las pistas y no se programan más fotogramas.
- Fallo del detector nativo: estado `error` y pistas detenidas.
- `visibilitychange` a oculto: llama a `stop`.
- `Scan` con `state.added`: muestra el aviso y **no** pide la cámara.

### Criterios de aceptación

Se comprueban **en el iPhone**, con el indicador de cámara de iOS:

- [ ] Abrir la pantalla Escanear no enciende la cámara.
- [ ] Volver tras añadir un producto no enciende la cámara.
- [ ] Salir de la pantalla la apaga.
- [ ] Pasar a otra app la apaga, y al volver sigue apagada hasta pulsar "Escanear".
- [ ] Pulsar "Escanear" y salir enseguida, aceptando el permiso o no, deja la cámara apagada.
- [ ] El escaneo de EAN-13 y de QR de Mercadona sigue funcionando.

---

## F-12 · Productos que no se detectan

### Qué se sabe

"No detecta" puede ser cuatro cosas distintas, y hoy no se pueden distinguir, porque el panel de diagnóstico solo existe en desarrollo (`Scan.tsx:124`) y no se puede ver en el iPhone con la app desplegada.

| Fallo | Qué se ve | Solución |
|---|---|---|
| A. No lee el código | La cámara sigue buscando | Depende del formato |
| B. Lee algo que no se interpreta | Va a una pantalla rota o vacía | Ampliar `extractEan` |
| C. Lee un EAN que no está en el catálogo | Abre el alta manual con el EAN relleno | **Ya cumple el criterio de F-12** |
| D. Encuentra un producto con datos malos | Abre otro nombre | Editar el producto |

La opción C es probable. El catálogo local solo tiene productos de OpenFoodFacts con Mercadona como tienda (11.442), y la fuente de Mercadona está desactivada (`deps.py:35`). Esto es solo una hipótesis: en esa copia local sí hay varios gnocchi, jardineras y panes de centeno de Hacendado, pero sin el EAN no se puede saber si son estos.

### Parte lista para implementar

**Error real encontrado (fallo B).** `useScanPage` (`Scan.tsx:87`) no valida lo leído. Un QR que no sea de Mercadona se trata como EAN y se navega a `/scan/https://...`, una ruta que no existe.

- Tras `extractEan`, se aplica `isValidEan`. Los `CUSTOM-` no pasan por aquí.
- Si no es válido, no se navega y se muestra: "Código leído, pero no reconocido: {valor}", con la opción de volver a escanear.

**Modo diagnóstico.**

- Se añade un interruptor en Ajustes que muestra `ScannerDebugPanel` también en producción, guardado en `localStorage`.
- Reemplaza la condición `import.meta.env.DEV`.

### Parte pendiente

Después de desplegar lo anterior:

1. Escanear cada producto con el modo diagnóstico activo.
2. Anotar el valor leído y clasificarlo en A, B, C o D.
3. Crear una tarea solo para los casos A y B. **No se cambia nada del lector sin ese dato.**

Si son etiquetas de peso variable (EAN que empieza por 2, con el precio dentro), necesitarán su propio diseño, porque cada paquete tiene un código distinto.

### Tests

- `normalizeScannedCode`: EAN válido, QR de Mercadona, URL desconocida y texto suelto.
- `Scan`: un código no reconocido no navega y muestra el mensaje.
- `Settings`: el interruptor persiste, y `Scan` muestra el panel cuando está activo.

### Criterios de aceptación

- [ ] Un código no reconocido muestra un mensaje con su valor y no lleva a una pantalla rota.
- [ ] Con el modo diagnóstico puedo ver en el iPhone el valor leído.
- [ ] Hay un resultado (A, B, C o D) para cada producto de F-12.
- [ ] Cada producto se reconoce, o se ofrece el alta manual con el EAN relleno. Si el fallo es A, el EAN se puede escribir a mano.

### Datos que faltan

- ¿Qué productos son exactamente? El título de F-12 cita tres (gnocchi, jardinera y pan de centeno), pero el texto habla de dos.
- El EAN impreso de cada uno, y si es posible una foto de la etiqueta.

---

## Fuera de alcance

- Reactivar la fuente de Mercadona.
- Ampliar el catálogo más allá de Mercadona.
- Soporte para peso variable, salvo que salga del diagnóstico.

## Verificación (2026-11-02)

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| Abrir Escanear no enciende la cámara | ✔ | `Scan.detection.test.tsx` |
| Volver tras añadir no enciende la cámara | ✔ | `Scan.detection.test.tsx`, `AppRoutes.flow.test.tsx` |
| Salir de la pantalla la apaga | ✔ | `useScanner.test.tsx` (desmontaje) |
| Pasar a otra app la apaga y no se reanuda sola | ✔ | `useScanner.test.tsx` (`visibilitychange`, `pagehide`, vuelta a visible) |
| Pulsar «Escanear» y salir enseguida la deja apagada | ✔ | `scanner.test.ts` (parar mientras se abre la cámara) |
| El escaneo de EAN-13 y QR de Mercadona sigue funcionando | ✔ | `Scan.detection.test.tsx` |
| El camino de ZXing (iPhone) decodifica y se detiene | ✔ | `zxingPath.test.ts` con un lector simulado |
| Un código no reconocido muestra su valor y no navega | ✔ | `Scan.detection.test.tsx` |
| El interruptor de diagnóstico persiste | ✔ | `Settings.test.tsx`, `diagnostics.test.ts` |
| **La cámara en un iPhone real se comporta así** | ⚠ | Los tests cubren la lógica. El comportamiento del dispositivo hay que comprobarlo a mano |
| **Ver el valor leído en el iPhone con el diagnóstico** | ⚠ | Igual: el interruptor está probado, el dispositivo no |
| **Resultado A, B, C o D para cada producto de F-12** | ⚠ | Pendiente: faltan los EAN de los productos que fallan |

**Decisión sobre ZXing:** se decodifica un fotograma copiado a un canvas como máximo cada 100 ms. Antes se
usaba `decodeOnceFromVideoElement`, que abre un bucle interno que no se puede parar.
