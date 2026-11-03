# homeStock v0.1 — Fallos y mejoras de uso real

## Contexto para la próxima sesión

- **Archivo de origen:** el usuario pidió `docs/Features/version01.1.md`, que no existe. Se trabajó sobre `docs/Features/version0.1.md`, que estaba vacío al inicio y luego se rellenó con la lista de fallos.
- **Estado del trabajo:** solo se ha escrito este documento. No se ha modificado código, tests ni la base de datos.
- **Verificado en código:** las causas marcadas como "verificada" (F-01, F-03, F-04, F-08, F-13, F-14, F-15, S-01 a S-06 y la parte de F-11). Las marcadas como "pendiente de verificar" (F-02, F-05, F-09, F-12 y el resto de F-11) necesitan reproducirse antes de cambiar nada.
- **Modelo de datos:** `InventoryItem.ean` es `unique`, así que hay una sola fila de inventario por producto (`app/models.py`). Cualquier cambio de ubicación múltiple o de campos nuevos (cajón, fecha de congelación, comentario) requiere migración de la base de datos (`homestock.db`).
- **Estilo:** el frontend usa Tailwind 3.4 (no v4). Los tokens ya están en `frontend/src/index.css` y `frontend/tailwind.config.ts`.
- **Permisos:** la carpeta `docs/Features/` y el archivo son propiedad de `root`. Se pudo escribir, pero conviene revisarlo si da errores en la próxima sesión.
- **Git:** `git status` falla con "dubious ownership" en este WSL. Hay que añadir el directorio a `safe.directory` antes de comprobar cambios. Git muestra muchos archivos modificados del frontend que no son de esta tarea.
- **Idioma:** el usuario trabaja en español y prefiere iterar sobre la lista paso a paso, pidiendo confirmación en las decisiones.

Lista de fallos y mejoras detectados en el uso diario. Cada ítem tiene un ID (`F-xx`), el síntoma observado, la causa (verificada en código o pendiente de verificar) y el criterio de aceptación.

**Estado:** `pendiente` · `en curso` · `hecho` · `decisión` (requiere decisión antes de implementar)

---

## Resumen

| Área | IDs | Tipo |
|---|---|---|
| Alta de productos | F-01 a F-05 | Fallos |
| Congelador y ubicaciones | F-06 a F-10 | Fallos + modelo de datos |
| Escáner y cámara | F-11, F-12 | Fallos |
| Alertas | F-13 | Fallo |
| Comentarios e iconos | F-14, F-15 | Mejora |
| Estilo visual (`.claude/style.md`) | S-01 a S-06 | Tarea de migración |

---

## 1. Alta de productos

### F-01 · Tras añadir un producto manual vuelve al inicio
- **Síntoma:** al guardar un producto manual, la app vuelve a la pantalla de escaneo en lugar de quedarse donde estaba.
- **Causa (verificada):** `ManualEntry.tsx:112` navega a `/scan` con `state: { added: true }`. `Scan.tsx:64-68` arranca la cámara al detectar ese estado.
- **Criterio de aceptación:** tras guardar, el usuario vuelve a la lista de la ubicación en la que estaba (despensa o congelador) con un aviso de confirmación, sin arrancar la cámara.
- **Nota relacionada:** `CustomEntry.tsx:215` navega siempre a `/despensa`, aunque el usuario haya elegido congelador. Se corrige en el mismo cambio.

### F-02 · No se distingue si el producto es nuevo o ya existía
- **Síntoma:** al añadir un producto, se muestran las unidades actuales sin indicar si el producto ya estaba en el inventario o se crea ahora.
- **Causa:** pendiente de verificar en el flujo de `POST /api/products` y `POST /api/inventory`.
- **Criterio de aceptación:** antes de guardar se muestra "Producto nuevo" o "Ya existe: X unidades en {ubicación}, se sumarán N".

### F-03 · No admite cantidades decimales (ej. 0,5)
- **Causa (verificada):** `ManualEntry.tsx:87` y `CustomEntry.tsx:250` usan `parseWholeNumber`. Sin embargo, `InventoryItem.quantity` es `float` (`app/models.py:39`) y existe `parseOptionalDecimal` en `utils/parse`.
- **Criterio de aceptación:** se aceptan `0,5` y `0.5`, se guardan como número y se muestran con coma decimal.

### F-04 · No se puede poner el umbral a 0 (ej. hamburguesa)
- **Causa (verificada):** `ManualEntry.tsx:221` valida `min: 1`. `CustomEntry.tsx:251` usa `parseWholeNumber` con `DEFAULT_THRESHOLD` como respaldo.
- **Criterio de aceptación:** el umbral acepta `0` (y decimales, ver F-03). Un umbral de 0 significa "avisar solo si se agota".

### F-05 · Algunos productos no ofrecen congelador ni despensa
- **Síntoma:** pepperoni y queso rallado no muestran la elección de ubicación. Gazpacho sí.
- **Causa:** pendiente de verificar. Hay que comparar el registro de `pepperoni` y `gazpacho` (origen `source`, tipo de producto, flujo de alta usado).
- **Criterio de aceptación:** todo producto, sea cual sea su origen, permite elegir ubicación al añadirlo.

---

## 2. Congelador y ubicaciones

### F-06 · Indicar el cajón del congelador
- **Síntoma:** en el congelador no se sabe en qué cajón está cada producto.
- **Causa:** `InventoryItem` no tiene campo para esto (`app/models.py:34-44`). Requiere campo nuevo.
- **Criterio de aceptación:** campo opcional `drawer` (texto corto) en el inventario, editable desde el detalle del producto y visible en la lista del congelador.
- **Decisión:** ¿cajón libre (texto) o lista fija de cajones (1, 2, 3…)?
- **Respuesta:** Lista de cajones (1,2,3,4)

### F-07 · Fecha de congelación
- **Síntoma:** no se registra cuándo se congeló un producto.
- **Causa:** no existe el campo (fuera de alcance en el diseño de congelador, `docs/superpowers/specs/2026-07-23-freezer-management-design.md`).
- **Criterio de aceptación:** campo opcional `frozen_at` (fecha). Se rellena por defecto con la fecha de hoy al añadir al congelador y se puede editar. Se muestra en el detalle.

### F-08 · Un producto no puede estar en congelador y en frigorífico a la vez
- **Síntoma:** no se puede tener una hamburguesa congelada y otra en el frigorífico.
- **Causa (verificada):** `InventoryItem.ean` tiene `unique=True` (`app/models.py:38`). Cada producto tiene **una sola** fila de inventario, con **una sola** ubicación.
- **Decisión requerida:**
  - **A (recomendado):** permitir una fila por par `(ean, location)`. Cambia la restricción de unicidad, la agregación en listados y el stock total del producto.
  - **B:** mantener una fila por producto y documentarlo como limitación. Los dos lotes se tratan como dos productos distintos (ej. "Hamburguesa congelada" y "Hamburguesa fresca").
- **Criterio de aceptación (A):** se pueden registrar ambas ubicaciones; el listado muestra cada una por separado; el stock total suma ambas.

### F-09 · El escaneo no permite elegir congelador
- **Síntoma:** al leer un código de barras no se puede marcar la ubicación congelador.
- **Causa:** pendiente de verificar. Revisar si el flujo de escaneo pasa `location` al formulario de alta y si `Scan.tsx` ofrece el selector.
- **Criterio de aceptación:** tras escanear, el selector de ubicación aparece con "Despensa" y "Congelador" y respeta la ubicación desde la que se entró.

### F-10 · Añadir directamente al congelador
- **Síntoma:** solo se puede añadir a la despensa desde el flujo normal.
- **Causa:** `CustomEntry.tsx:12` y `ManualEntry.tsx:52` fijan el valor por defecto de ubicación.
- **Criterio de aceptación:** desde la pestaña Congelador, el alta preselecciona congelador (ya diseñado en el spec de congelador) en todos los flujos: escaneo, manual y sin código.
- **Nota:** este ítem y F-09 están relacionados. Se pueden implementar juntos.

---

## 3. Escáner y cámara

### F-11 · La cámara se activa todo el tiempo en iPhone
- **Síntoma:** en iPhone la cámara arranca y permanece activa aunque no se esté escaneando.
- **Causa (parcial, verificada):** tras añadir un producto, `Scan.tsx:64-68` arranca la cámara automáticamente. El origen del resto del uso continuo está pendiente de verificar en `useScanner.ts` y `BarcodeCameraScanner.ts`.
- **Criterio de aceptación:** la cámara solo se activa cuando el usuario pulsa "Escanear". Se detiene al salir de la pantalla y al pasar la app a segundo plano.

### F-12 · Gnocchi no detecta la etiqueta de jardinera ni de pan de centeno
- **Síntoma:** el escáner no reconoce estos dos productos.
- **Causa:** pendiente de verificar. Hay que determinar si falla la lectura del código de barras (`barcodeDetector.ts`), la búsqueda en Open Food Facts o el nombre devuelto.
- **Criterio de aceptación:** los dos productos se reconocen, o en su defecto se ofrece alta manual con el EAN ya rellenado.
- **Dato necesario:** el código EAN de cada producto y, si es posible, una foto de la etiqueta.

---

## 4. Alertas

### F-13 · Desde una alerta no se puede abrir el detalle del producto
- **Síntoma:** las alertas de stock no llevan al producto.
- **Causa (verificada):** `Dashboard.tsx:66` (`AlertsSection`) muestra los elementos sin enlace al detalle.
- **Criterio de aceptación:** cada alerta es un enlace a la pantalla de detalle del producto (`ProductDetail`), con el EAN en la ruta.

---

## 5. Comentarios e iconos

### F-14 · Poder añadir comentarios a un producto
- **Ejemplo:** "Hay 5 muslitos".
- **Causa (verificada):** no existe campo de texto libre en `Product` ni en `InventoryItem` (`app/models.py`).
- **Decisión requerida:** ¿el comentario va en el producto (una nota para todas sus unidades) o en la fila de inventario (una nota por ubicación)? Con F-08 opción A, la segunda es más natural.
- **Criterio de aceptación:** campo opcional `notes` (texto), editable desde el detalle y visible en la lista.

### F-15 · Distinguir productos añadidos a mano
- **Síntoma:** no hay forma visual rápida de ver qué productos se añadieron a mano.
- **Causa (verificada):** `ProductDetail.tsx:134` muestra "Manual" o "Reconocido" solo en el detalle. Las listas no lo muestran.
- **Criterio de aceptación:** los productos con `source === "manual"` muestran un icono pequeño en las listas de despensa y congelador.

---

## 6. Estilo visual (`.claude/style.md`)

**Estado de partida:** la migración ya está iniciada. `frontend/src/index.css` define los tokens como variables RGB, `frontend/tailwind.config.ts` los expone como clases, y no hay colores hexadecimales literales en los componentes. Falta auditar pantallas, radios, tipografía y reglas de uso.

**Stack:** React 18 + Vite + Tailwind **3.4** (no v4). Usar `tailwind.config.ts` y variables CSS, no la sintaxis `@theme` del style guide.

### S-01 · Auditoría de tokens y radios
- **Tarea:** revisar todas las clases `rounded-*` (`rounded-pill`, `rounded-lg`, `rounded-full`, `rounded-sm`) contra el style guide: botones 56px, tarjetas 20px, tarjetas grandes 60px, elementos pequeños 10px.
- **Criterio de aceptación:** cada radio mapea a un token documentado; no quedan valores sueltos. Ningún color ni sombra fuera de la paleta.

### S-02 · Tipografía
- **Síntoma:** no hay `@font-face` cargado. Aeonik y AeonikFono no se usan en la app aunque estén en el style guide.
- **Decisión requerida:** ¿licencia de Aeonik/AeonikFono o usar el sustituto indicado en el style guide (Inter / Inter Display)? Aeonik es una fuente comercial. 
- **Respuesta** Usemos el sustito que se propone
- **Criterio de aceptación:** cuerpo en peso 400 con tracking -0.08px a 16px; display en peso 500 como máximo; ningún peso superior a 500.

### S-03 · Botones
- **Criterio de aceptación:**
  - Primario: fondo `neon-pulse` (#3ddc91), texto `obsidian-shell`, pill de 56px, sin borde.
  - Secundario (ghost): fondo transparente, borde blanco de 1.5px, texto blanco.
  - Terciario: sin fondo ni borde.
  - Todos con radio 56px.

### S-04 · Uso del verde
- **Regla:** el verde (#3ddc91) solo en acciones primarias, estados activos (pestañas, navegación) y destacados de datos. No se usa como decoración.
- **Tarea:** revisar `StatTile` y otros componentes que colorean valores en verde sin ser interactivos.

### S-05 · Ritmo claro/oscuro y superficies
- **Criterio de aceptación:**
  - Fondo `obsidian-shell`; tarjetas de contenido en `mint-frost` con radio 60px.
  - Nunca una tarjeta clara junto a otra clara sin banda oscura entre ambas.
  - Sombras máximo `rgba(0,0,0,0.04) 1px 0px 9px 2px`. Sin gradientes (actualmente 0 usos, mantener).

### S-06 · Componentes de la guía
- **Pestañas (Despensa / Congelador):** pastillas de 56px, activa en verde con texto oscuro, inactiva en `slate-text`.
- **Etiquetas en mayúsculas:** 9px, tracking 0.45px, encima de los títulos de sección.
- **Stat tiles:** número en 48px peso 500, etiqueta en 9px mayúsculas con 50% de opacidad.
- **Criterio de aceptación:** las pantallas Despensa, Congelador, Dashboard y Detalle usan estos componentes.

---

## Orden de iteración propuesto

1. **Rápidos y de bajo riesgo** (sin cambios de modelo): F-01, F-03, F-04, F-13, F-15, F-11.
2. **Requieren verificar primero** (reproducir y localizar la causa): F-02, F-05, F-09, F-12.
3. **Requieren decisión** antes de tocar el modelo: F-06, F-07, F-08, F-14.
4. **Dependen de 3:** F-10 (después de F-08 y F-09).
5. **Estilo (S-01 a S-06):** en paralelo con los bloques 1 y 2, porque no tocan la lógica. S-01 y S-03 primero, luego S-04 a S-06. S-02 espera a la decisión de la fuente. Conviene hacerlo después de F-06 a F-08 para no rehacer componentes que cambian.

## Decisiones pendientes

- **F-06:** cajón como texto libre o lista fija.
- **F-08:** opción A (varias filas por producto y ubicación) o B (una fila, limitación documentada). Esta funcinoalidad no la vamos a implementar en la primera iteracion
- **F-14:** comentario por producto o por ubicación.
- **F-12:** EAN de los productos que fallan.
- **S-02:** licencia de Aeonik o sustituto Inter.

## Estado de implementación (2026-11-02)

El detalle de cada punto, con los tests que lo demuestran, está en [`v0.1/`](v0.1/README.md).

| ID | Estado | Spec | Notas |
|---|---|---|---|
| F-01 | `hecho` | 02 | También cubre editar desde la lista, que llevaba al escáner |
| F-02 | `hecho` | 02 | «Producto nuevo» o «Ya existe: X en Y. Se sumarán N» |
| F-03 | `hecho` | 01 | Decimales con coma o punto, hasta 2 decimales |
| F-04 | `hecho` | 01 | Hizo falta cambiar la regla de «bajo»: con `<` un umbral 0 nunca avisaba |
| F-05 | `hecho` | 02 | Misma causa que F-09. No se reprodujo con esos productos concretos |
| F-06 | `hecho` | 05 | Lista fija de cajones 1 a 4, como respondiste |
| F-07 | `hecho` | 05 | Migración Alembic `0002` |
| F-08 | `fuera de esta iteración` | — | Decidido por ti. El modelo actual no lo impide en el futuro |
| F-09 | `hecho` | 02 | |
| F-10 | `hecho` | 02 | La ubicación activa se comparte y se recuerda |
| F-11 | `hecho, sin probar en iPhone` | 03 | Seis causas corregidas. Falta comprobarlo en el dispositivo |
| F-12 | `en curso` | 03 | Validación y modo diagnóstico hechos. Faltan los EAN de los productos que fallan |
| F-13 | `hecho` | 04 | |
| F-14 | `hecho` | 05 | La nota va en el inventario |
| F-15 | `hecho` | 04 | |
| S-01 a S-06 | `hecho`, salvo Inicio | 06 | Inter como sustituto. Falta el bloque claro de Inicio y la prueba visual |

### Decisiones

| Decisión | Resolución |
|---|---|
| F-06: cajón libre o lista fija | Lista fija 1, 2, 3 y 4 (tuya) |
| F-08: una o varias filas por producto | Fuera de esta iteración (tuya) |
| S-02: Aeonik o Inter | Inter (tuya) |
| F-14: nota por producto o por ubicación | Por ubicación, en el inventario (propuesta, pendiente de tu visto bueno) |
| F-12: EAN de los productos | **Pendiente.** Los necesito para saber si el fallo es de lectura o de catálogo |
