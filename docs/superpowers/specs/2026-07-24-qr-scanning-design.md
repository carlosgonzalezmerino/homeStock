# QR Code Scanning — Design Spec

**Date:** 2026-07-24
**Status:** Approved

> **Actualización 2026-11-02.** El formato real del QR de Mercadona es `/01/<GTIN-14>/…`, no `/code/<EAN>/…` como supone esta spec (corregido en commits posteriores). Un código que no sea un EAN válido ni un QR conocido ya no se abre: se muestra su valor (`Features/v0.1/03`).

## Context

Some products come with a Mercadona QR code instead of a plain EAN barcode. The QR encodes a URL of the form:

```
https://qrtrack.mercadona.es/code/<EAN>/…?params
```

The query params contain store/weight/expiry info — not needed for now. The EAN is the path segment immediately after `/code/`.

## Goal

Extract the EAN from Mercadona QR URLs and pass it through the existing `resolveAndNavigate` pipeline. No new screens, no backend changes, no new libraries.

## Non-Goals

- Parsing query params (weight, expiry, store) — deferred
- Supporting QR formats from other retailers
- Backend URL parsing

## Design

### 1. `useScanner.ts` — enable `qr_code` in native detector

`FORMAT_CANDIDATES[0]` currently lists only EAN/barcode formats. Add `"qr_code"` so the native `BarcodeDetector` (Chrome/Android/iOS 17.4+) picks up QR codes alongside barcodes.

```ts
const FORMAT_CANDIDATES = [
  ["ean_13", "ean_8", "code_128", "upc_e", "qr_code"],
  // fallback rows unchanged
```

ZXing (`BrowserMultiFormatReader`) already decodes QR with no config change.

### 2. `Scan.tsx` — inline EAN extraction

Add a small helper before the `handleDetect` callback:

```ts
function extractEan(raw: string): string {
  const m = raw.match(/https?:\/\/qrtrack\.mercadona\.es\/code\/(\d{8,13})\//);
  return m ? m[1] : raw;
}
```

Call it inside `handleDetect` before `resolveAndNavigate`:

```ts
const handleDetect = useCallback(async (raw: string) => {
  if (resolving.current) return;
  resolving.current = true;
  scanner.stop();
  await resolveAndNavigate(extractEan(raw), navigate);
  resolving.current = false;
}, [navigate]);
```

Plain barcodes pass through unchanged (`raw` is numeric, regex doesn't match).

### 3. UI hint (optional, low-effort)

Change the scanning hint text from "Apunta al código de barras" to "Apunta al código de barras o QR" when scanning is active.

## Data Flow

```
camera frame
  ↓
ZXing / BarcodeDetector
  ↓
raw = "https://qrtrack.mercadona.es/code/8410376003139/…" OR "8410376003139"
  ↓
extractEan(raw) → "8410376003139"
  ↓
resolveAndNavigate("8410376003139", navigate)   [unchanged]
```

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/hooks/useScanner.ts` | Add `"qr_code"` to `FORMAT_CANDIDATES[0]` |
| `frontend/src/screens/Scan.tsx` | Add `extractEan` helper, call it in `handleDetect`, update hint text |

## Testing

- Manual: scan a Mercadona QR code → should resolve same as scanning its barcode
- Manual: scan a plain EAN barcode → unchanged behaviour
- Unit: `extractEan` with a valid QR URL returns the EAN; with a plain EAN string returns it unchanged; with an unrecognised URL returns it unchanged
