# Spec 05 · Cajón, fecha de congelación y notas

**Cubre:** F-06 (cajón), F-07 (fecha de congelación), F-14 (notas)
**Estado:** implementada, con migración Alembic. Decisiones D3 y D4 aplicadas como propuestas.
**Depende de:** Spec 02, porque añade campos a `StockFields`

## Objetivo

Guardar dónde y desde cuándo está algo en el congelador, y permitir anotaciones libres. Es la **única spec con cambios de base de datos**.

## Decisiones

- **F-06, ya respondida por ti:** lista fija de cajones 1, 2, 3 y 4.
- **F-14, decisión D4:** la nota va en el **inventario**, no en el producto. "Hay 5 muslitos" describe lo que tienes, no lo que es el producto. Hoy los dos sitios serían equivalentes en la práctica, pero en el inventario encajará mejor si F-08 llega más adelante. Al quitar un producto del inventario, su nota se borra con él.
- **F-08, ya respondida por ti:** queda fuera. Se mantiene una fila por producto, y estos campos no dificultan cambiarlo después.

## Modelo de datos

`inventory_items` añade tres columnas, todas opcionales:

| Columna | Tipo | Regla |
|---|---|---|
| `drawer` | entero, nullable | 1 a 4. Solo en congelador |
| `frozen_at` | fecha, nullable | Solo en congelador |
| `notes` | texto, nullable | Máximo 500 caracteres. Vacío se guarda como `null` |

Las filas que ya están en el congelador quedan con `frozen_at = null`. No se rellenan con la fecha de la migración porque sería un dato falso.

## Reglas

| Acción | Resultado |
|---|---|
| Crear en congelador sin `frozen_at` | `frozen_at` = hoy |
| Mover a congelador sin `frozen_at` | `frozen_at` = hoy |
| Mover fuera del congelador | `drawer` y `frozen_at` pasan a `null` |
| Enviar `drawer` o `frozen_at` para algo fuera del congelador | 422, con un mensaje claro |
| Cambiar la cantidad o la nota | No toca `frozen_at` |
| Sumar unidades a un producto congelado | Conserva `frozen_at` |

La última fila es una limitación conocida: con una fila por producto, una compra nueva comparte fecha con las anteriores. Se puede editar a mano, y se resolvería de verdad con lotes.

Estas reglas van en `InventoryService`, para que se apliquen igual desde cualquier flujo. El frontend envía la fecha local del dispositivo, y la fecha del servidor solo se usa si no se envía ninguna.

La API no rechaza fechas futuras. El campo lo limita con `max`, y al validarlo en el servidor se podría rechazar una fecha correcta por la diferencia de zona horaria.

## API

- `InventoryCreate` e `InventoryPatch` añaden `drawer`, `frozen_at` y `notes`.
- `InventoryOut` devuelve los tres.
- Validación con Pydantic: `drawer` entre 1 y `FREEZER_DRAWER_COUNT`, y `notes` hasta `NOTES_MAX_LENGTH`.
- `InventoryPatch` usa `exclude_unset`, de modo que un `null` explícito borra el valor.
- Nueva excepción `FreezerFieldsError` → 422 con "El cajón y la fecha de congelación solo se aplican a productos del congelador".

## Interfaz

| Elemento | Dónde | Comportamiento |
|---|---|---|
| Selector de cajón (—, 1, 2, 3, 4) | Alta y detalle, solo con Congelador | Se guarda al instante en el detalle, igual que la ubicación |
| Fecha de congelación | Alta y detalle, solo con Congelador | Empieza en hoy en el alta, con `max` en hoy. Se muestra "Sin fecha" si está vacía |
| "Cajón N" | Fila de la pestaña Congelador | Junto a la marca. No aparece si no tiene cajón |
| Notas | Detalle | Área de texto con botón Guardar, activo solo si hay cambios (como el umbral). Contador al acercarse al límite |
| Nota | Fila de la lista | Una línea truncada bajo el nombre. No aparece si está vacía |

La fecha se muestra solo en el detalle, como pide F-07. Las notas no se piden en el alta, para no alargar el formulario.

### Cambios en el frontend

- `types.ts`: añadir los campos.
- `constants/inventory.ts`: `FREEZER_DRAWERS`, `NOTES_MAX_LENGTH`.
- `components/DrawerPicker.tsx` (nuevo).
- `components/StockFields.tsx`: cajón y fecha, condicionados a Congelador.
- `ProductDetail.tsx`: nuevas tarjetas `FreezerCard` y `NotesCard`.
- `useProductDrafts.ts`: generaliza `useThresholdDraft` en un `useSavedFieldDraft<T>` para reutilizarlo con las notas.
- `Pantry.tsx`: `PantryItem` muestra el cajón y la nota.

## Migración (decisión D3)

`create_all` no añade columnas a tablas existentes. **Si se despliega este cambio sin migrar, cualquier lectura del inventario dará error en producción.** Además, `README` y `docker-compose.yml` indican que producción usa MariaDB, no el `homestock.db` local.

Propongo **Alembic**, porque F-08 y las caducidades también cambiarán el modelo:

1. Añadir `alembic` a las dependencias y una carpeta `alembic/` con la URL tomada de `settings`.
2. `0001`: el esquema actual tal como está.
3. `0002`: las tres columnas.
4. `_bootstrap` (`app/main.py`) deja de llamar a `create_db_and_tables`. Los tests lo siguen usando.
5. `Dockerfile`: copiar `alembic/` y `alembic.ini`. Ejecutar `alembic upgrade head` antes de uvicorn.

**Despliegue en la base de datos existente, solo una vez:**

1. Copia de seguridad con `mariadb-dump`. Importa especialmente por el riesgo documentado de tener los datos en `/mnt/d`.
2. `alembic stamp 0001`, antes de arrancar la imagen nueva.
3. Desplegar. El arranque aplica `0002`.
4. Comprobar que los datos siguen ahí.

**Reversión:** `alembic downgrade 0001` elimina las columnas y pierde lo que se haya escrito en ellas. Si algo sale mal, se restaura la copia de seguridad.

`scripts/migrate_to_mysql.py` crea las tablas con `create_db_and_tables`, así que tras usarlo habrá que hacer `alembic stamp head`. Se documenta en el `README`.

## Tests

**Backend**

- `test_start_tracking_freezer_without_date_sets_today`
- `test_start_tracking_pantry_with_drawer_raises_error`
- `test_update_move_to_pantry_clears_freezer_fields`
- `test_update_move_to_freezer_sets_frozen_at`
- `test_update_quantity_keeps_frozen_at`
- `test_update_drawer_on_pantry_item_raises_error`
- `test_patch_inventory_drawer_out_of_range_returns_422`: con 0 y 5.
- `test_patch_inventory_notes_too_long_returns_422`
- `test_patch_inventory_empty_notes_stores_null`
- Migración: `upgrade` y `downgrade` sobre SQLite, y que `0001` + `0002` coincidan con los modelos.

**Frontend**

- Cajón y fecha solo aparecen con Congelador, y al cambiar a Despensa se ocultan y no se envían.
- La fecha empieza en hoy.
- La fila muestra "Cajón 2" y la nota, y no muestra nada si están vacíos.
- Guardar una nota envía el PATCH, y el botón solo se activa con cambios.

## Criterios de aceptación

- [ ] **F-06:** Elijo cajón 1 a 4 en el alta y en el detalle, y lo veo en la lista del Congelador.
- [ ] **F-07:** Al añadir al congelador la fecha es hoy, la puedo cambiar y la veo en el detalle.
- [ ] **F-14:** Escribo una nota en el detalle y la veo en la lista.
- [ ] Mover un producto a Despensa elimina su cajón y su fecha.
- [ ] Una fila anterior a la migración muestra "Sin fecha" y sigue funcionando.
- [ ] La migración se ha probado sobre una copia real antes de aplicarla en producción.

## Fuera de alcance

- Filtrar u ordenar por cajón o por fecha.
- Avisos por tiempo en el congelador.
- Fechas por lote y caducidades.
- Número de cajones configurable.

## Verificación (2026-11-02)

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| F-06: elegir cajón 1 a 4 en el alta y el detalle, verlo en la lista | ✔ | `ProductDetail.test.tsx`, `ManualEntry.test.tsx`, `CustomEntry.test.tsx`, `Pantry.test.tsx` |
| F-07: fecha de hoy por defecto, editable, visible en el detalle | ✔ | `ProductDetail.test.tsx`, `ManualEntry.test.tsx`, `test_inventory_freezer.py` |
| F-14: escribir una nota en el detalle y verla en la lista | ✔ | `ProductDetail.test.tsx`, `Pantry.test.tsx` |
| Mover a Despensa elimina cajón y fecha | ✔ | `test_inventory_freezer.py`, `test_api_on_migrated_database.py`, `ProductDetail.test.tsx` |
| Una fila anterior a la migración muestra «Sin fecha» y funciona | ✔ | `ProductDetail.test.tsx`, `test_migrations.py` |
| La migración se probó sobre una copia real | ✔ | Ensayo sobre una copia de `homestock.db`: 24, 11.442 y 18 filas, contenido de las columnas antiguas idéntico |
| Migraciones y modelos coinciden | ✔ | `test_migrations.py` (compara con los modelos, deshace y rehace) |
| **Aplicada en la base de producción (MariaDB)** | ⚠ | No se ha tocado. Hay que hacer `stamp 0001` antes del primer despliegue (ver `docs/DATABASE.md`) |
| **La imagen de Docker arranca y migra** | ⚠ | No se ha podido construir en este entorno. Se probó el arranque equivalente con uvicorn |

La migración **sí se aplicó** a la `homestock.db` local, con copia de seguridad previa y comprobación posterior.

**Corregido durante la verificación:** `scripts/off_import.py` creaba todas las tablas con `create_all`, y
`scripts/migrate_to_mysql.py` fallaba con una base anterior a `0002`. Ambos usan ahora las migraciones.
