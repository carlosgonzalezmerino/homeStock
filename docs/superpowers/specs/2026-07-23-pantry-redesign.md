# Spec: Rediseño pantalla Despensa (Pantry)

**Fecha:** 2026-07-23  
**Alcance:** Solo pantalla Despensa (`Pantry.tsx`) y los componentes que toca.  
**Dashboard:** fuera de scope en esta iteración.

> **Actualización 2026-11-02.** Las tarjetas de la despensa muestran además el cajón, la nota y el icono de producto manual. El `＋` de cada fila es neutro (el verde se reserva a acciones y estados) y la cantidad admite decimales. El estado «bajo» usa `cantidad < umbral`.

---

## Objetivo

Hacer que actualizar cantidades sea rápido (sin entrar al detalle) y que cada producto sea identificable de un vistazo mediante imagen prominente y cantidad en grande.

## Flujos cubiertos

1. **Llegada del súper** — el usuario sube el stock de varios productos seguidos sin salir de la lista.
2. **Revisión de stock** — el usuario distingue de un vistazo qué productos están bien, bajos o agotados.

---

## Layout de tarjeta

```
┌─────────────────────────────────────┐
│ [img] Nombre del producto      [●]  │
│       Marca                         │
│                                     │
│                        −  3 uds  +  │
└─────────────────────────────────────┘
```

### Zona izquierda — thumbnail
- Tamaño: 56×56px, `rounded-md`, `object-contain`, fondo `surface-container-low`.
- Si no hay `image_url`: placeholder con icono genérico de producto (Material Symbols `grocery`).

### Zona central — identidad
- Nombre: `text-body-lg font-medium text-on-surface`, truncado a 1 línea.
- Marca: `text-body-sm text-on-surface-variant`, truncado a 1 línea. Oculto si no existe.

### Esquina superior derecha — badge de estado
- Círculo de 12px de diámetro, sin texto, sin label accesible visible.
- Verde (`bg-primary`): quantity > threshold.
- Amarillo (`bg-tertiary`): quantity > 0 y quantity ≤ threshold (stock bajo).
- Rojo (`bg-error`): quantity = 0 (agotado).
- `aria-label` en el círculo para accesibilidad: "Stock OK" / "Stock bajo" / "Agotado".

### Zona inferior derecha — stepper inline
- Botones `−` y `+`: touch target mínimo 44×44px, `text-headline-sm`, fondo `surface-container-high`, `rounded-full`.
- Cantidad: `text-headline-md font-bold text-on-surface`, seguida de la unidad en `text-body-sm text-on-surface-variant`.
- El conjunto stepper tiene más peso visual que nombre y marca.

---

## Interacciones

### Tap en tarjeta (fuera del stepper)
- Navega a `/despensa/:ean` (ProductDetail), igual que ahora.
- El área de tap del stepper no propaga el click a la tarjeta (`e.stopPropagation()`).

### Stepper — mutación optimista
- Al pulsar `−` o `+`, la cantidad se actualiza visualmente de inmediato (estado local).
- Se lanza `PATCH /inventory/:ean` con `{ quantity: newQty }` en background via `usePatchInventory`.
- En caso de error: se revierte al valor anterior y se muestra un toast/snackbar de error.
- Mínimo: 0 (botón `−` deshabilitado en 0). Sin máximo definido.

---

## Cambios en componentes

### `QuantityStepper`
- Nueva prop opcional `size?: "sm" | "lg"`. Default `"sm"` (comportamiento actual en ProductDetail). `"lg"` aplica el estilo prominente de la tarjeta.
- La lógica de min/max no cambia.

### `StatusBadge`
- Cambia de chip con texto a círculo de color puro.
- Props: `status: "ok" | "low" | "empty"`. Se elimina la prop `low: boolean` actual (breaking change interno, solo se usa en Pantry y Dashboard).
- Añadir `aria-label` según estado.

### `Pantry.tsx`
- La tarjeta inline actual se extrae a un componente `PantryItem` en el mismo archivo.
- `PantryItem` recibe `item: InventoryWithProductOut` y llama a `usePatchInventory` para el stepper.
- El `onClick` de la tarjeta excluye el área del stepper.

---

## Lo que NO cambia

- Barra de búsqueda (posición, comportamiento, estilos).
- Lógica de filtrado por nombre/marca.
- Estados de carga y error (`Spinner`, `ErrorState`, `EmptyState`).
- Navegación al `ProductDetail`.
- Orden de la lista.
- Pantalla Dashboard, Scan, Settings, ProductDetail.

---

## Criterios de aceptación

- [ ] Puedo subir/bajar la cantidad de un producto sin salir de la lista de la Despensa.
- [ ] Cada tarjeta muestra la imagen del producto (o placeholder si no hay).
- [ ] La cantidad es el elemento más grande y visible de la tarjeta.
- [ ] El badge de estado es un círculo de color: verde/amarillo/rojo, sin texto.
- [ ] Un error de red al actualizar revierte la cantidad y notifica al usuario.
- [ ] El tap fuera del stepper sigue navegando al detalle del producto.
- [ ] Los tests existentes de `Pantry` y `StatusBadge` siguen pasando (actualizar los que cambien de interfaz).
