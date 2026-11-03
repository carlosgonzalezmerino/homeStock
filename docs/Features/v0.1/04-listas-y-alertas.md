# Spec 04 · Listas y alertas

**Cubre:** F-13 (alerta abre el detalle), F-15 (icono de producto manual)
**Estado:** implementada.
**Depende de:** Spec 02, para el destino al guardar desde el detalle

## F-13 · Abrir el detalle desde una alerta

**Causa:** `LowStockCard` (`Dashboard.tsx:116`) no tiene acción. `Card` ya admite `onClick`, con soporte de teclado y rol de botón.

**Comportamiento:**

- Toda la tarjeta abre `/despensa/{ean}`, con el EAN pasado por `encodeURIComponent`, como en la lista.
- Volver con la flecha, o guardar una cantidad, regresa a Inicio.

**Cambio:** `LowStockCard` usa `useNavigate` y pasa `onClick` a `Card`.

**Tests:**

- Pulsar una alerta navega a `/despensa/:ean`.
- Un EAN `CUSTOM-` también funciona.

## F-15 · Identificar productos añadidos a mano

**Causa:** el origen solo se muestra en el detalle (`ProductDetail.tsx:135`).

**Comportamiento:**

- Los productos con `source === "manual"` muestran el icono `edit_note` de Material Symbols junto al nombre, en las pestañas Despensa y Congelador. Esto incluye los creados con "Añadir sin código".
- El icono va en color `on-surface-variant`. No usa verde, porque no es interactivo ni un dato destacado (Spec 06).
- Tamaño de 16 px, sin ocupar una línea propia y sin empujar el stepper. El nombre sigue truncándose.
- Accesibilidad: `aria-label="Añadido a mano"`.
- No aparece en las alertas, porque F-15 solo pide las listas.

**Cambio:** nuevo componente `ManualSourceIcon`, usado en `PantryItem` (`Pantry.tsx:197`).

**Tests:**

- Un producto con `source: "manual"` muestra el icono.
- Un producto con `source: "openfoodfacts"` no lo muestra.

## Criterios de aceptación

- [ ] Pulsar una alerta abre el detalle de ese producto.
- [ ] Al volver del detalle estoy de nuevo en Inicio.
- [ ] Los productos manuales muestran un icono en las dos pestañas.
- [ ] Los productos reconocidos no lo muestran.
- [ ] Con un nombre largo, el icono y el stepper siguen visibles en un móvil.

## Fuera de alcance

- Filtrar por origen.
- Mostrar el icono en las alertas.

## Verificación (2026-11-02)

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| Pulsar una alerta abre el detalle | ✔ | `Dashboard.test.tsx` (incluye un producto `CUSTOM-`) |
| Al volver del detalle estoy en Inicio | ✔ | `AppRoutes.flow.test.tsx` |
| Los manuales muestran icono en las dos pestañas | ✔ | `Pantry.test.tsx` |
| Los reconocidos no lo muestran | ✔ | `Pantry.test.tsx` |
| Con un nombre largo, icono y stepper siguen visibles | ⚠ | Requiere un navegador. El nombre se trunca por CSS, no está comprobado a 380 px |
