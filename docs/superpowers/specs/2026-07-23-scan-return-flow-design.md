# Spec: Return to Scan after adding a product

**Date:** 2026-07-23

## Problem

After scanning a barcode and adding (or updating) a product, the app navigates to `/despensa`. The user has to manually go back to the Scan tab and reactivate the camera. This is friction for a batch-scanning workflow.

## Goal

After adding a product, return to the Scan screen with:
- 1-second visual confirmation toast ("✓ Producto añadido")
- Camera activated automatically at the same time

## Scope

### In scope
- `ProductDetail` — "Añadir a mi despensa" and "Actualizar cantidad" actions
- `ManualEntry` — "Guardar producto" action

### Out of scope
- `ProductDetail` — "Quitar de la despensa" action (deletion navigates to `/despensa` as before)

## Design

### Navigation change (ProductDetail & ManualEntry)

Replace `navigate('/despensa')` with:

```ts
navigate('/scan', { state: { added: true }, replace: true })
```

`replace: true` prevents the intermediate product/manual-entry route from accumulating in history, keeping the back-button experience clean.

### Scan screen changes

On mount, read `location.state?.added`:

1. If `true`: show toast and call `scanner.start()` immediately
2. Clear the location state by calling `navigate('.', { state: {}, replace: true })` to prevent the toast re-appearing on back navigation
3. After 1000 ms: hide the toast (local `useState` flag)

Toast appearance: green success banner at the top of the Scan screen content, text "✓ Producto añadido", styled with `text-on-secondary-container bg-secondary-container` (reuses existing design tokens).

## Files to change

| File | Change |
|------|--------|
| `frontend/src/screens/ProductDetail.tsx` | `navigate('/despensa')` → `navigate('/scan', { state: { added: true }, replace: true })` in `handleUpdate` only |
| `frontend/src/screens/ManualEntry.tsx` | Same replacement in `onSubmit` |
| `frontend/src/screens/Scan.tsx` | Read `location.state`, auto-start camera, show/hide toast |

## Non-goals

- No global toast system — this is a local, single-screen concern
- No persistence of the toast state — it is ephemeral and disappears on refresh
