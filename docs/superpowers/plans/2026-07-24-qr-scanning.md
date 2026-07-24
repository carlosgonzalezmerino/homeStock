# QR Code Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the scanner to read Mercadona QR codes by extracting the EAN from the scanned URL and passing it through the existing resolution pipeline.

**Architecture:** Two small changes — add `"qr_code"` to the native `BarcodeDetector` format list in `useScanner.ts`, and add an `extractEan` helper in `Scan.tsx` that converts a Mercadona QR URL to an EAN before calling `resolveAndNavigate`. ZXing already handles QR with no changes.

**Tech Stack:** React, TypeScript, Vitest, `@zxing/browser`, native `BarcodeDetector` API.

## Global Constraints

- No new libraries
- No backend changes
- TypeScript strict mode — no `any`
- Test runner: `cd frontend && npm test` (vitest run)
- All copy in Spanish

---

### Task 1: Add `extractEan` helper and unit tests in `Scan.tsx`

**Files:**
- Modify: `frontend/src/screens/Scan.tsx`
- Test: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Produces: `extractEan(raw: string): string` — module-level function at bottom of `Scan.tsx` (below `resolveAndNavigate`)

---

- [ ] **Step 1: Write failing unit tests for `extractEan`**

Add the following `describe` block to `frontend/src/screens/screens.test.tsx`, after the existing imports and before any existing `describe` blocks:

```ts
describe("extractEan", () => {
  it("extracts EAN from a Mercadona QR URL", () => {
    const url = "https://qrtrack.mercadona.es/code/8410376003139/other/path?foo=bar";
    expect(extractEan(url)).toBe("8410376003139");
  });

  it("returns a plain EAN string unchanged", () => {
    expect(extractEan("8410376003139")).toBe("8410376003139");
  });

  it("returns an unrecognised URL unchanged", () => {
    expect(extractEan("https://example.com/product/123")).toBe("https://example.com/product/123");
  });

  it("extracts an 8-digit EAN-8 from a QR URL", () => {
    const url = "https://qrtrack.mercadona.es/code/12345678/x/?z=1";
    expect(extractEan(url)).toBe("12345678");
  });
});
```

Also add the named import at the top of the imports section in `screens.test.tsx`:

```ts
import { Scan, extractEan } from "@/screens/Scan";
```

(Replace the existing `import { Scan } from "@/screens/Scan"` line if present, otherwise add alongside the existing screen imports.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -E "(extractEan|FAIL|PASS|error)"
```

Expected: tests fail with `extractEan is not a function` or similar import error.

- [ ] **Step 3: Add `extractEan` to `Scan.tsx` and export it**

Open `frontend/src/screens/Scan.tsx`. At the very bottom of the file (after the `resolveAndNavigate` function), add:

```ts
export function extractEan(raw: string): string {
  const m = raw.match(/https?:\/\/qrtrack\.mercadona\.es\/code\/(\d{8,13})\//);
  return m ? m[1] : raw;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npm test -- --reporter=verbose 2>&1 | grep -E "(extractEan|FAIL|PASS)"
```

Expected: all 4 `extractEan` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/Scan.tsx frontend/src/screens/screens.test.tsx
git commit -m "feat: add extractEan helper for Mercadona QR URLs"
```

---

### Task 2: Wire `extractEan` into `handleDetect` and update hint text

**Files:**
- Modify: `frontend/src/screens/Scan.tsx`

**Interfaces:**
- Consumes: `extractEan(raw: string): string` from Task 1

---

- [ ] **Step 1: Update `handleDetect` to call `extractEan`**

In `frontend/src/screens/Scan.tsx`, find the `handleDetect` callback (currently lines ~14-24) and replace it with:

```ts
const handleDetect = useCallback(
  async (raw: string) => {
    if (resolving.current) return;
    resolving.current = true;
    scanner.stop();
    await resolveAndNavigate(extractEan(raw), navigate);
    resolving.current = false;
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [navigate]
);
```

- [ ] **Step 2: Update the scanning hint text**

Find the line (currently ~line 94):

```tsx
Apunta al código de barras
```

Replace with:

```tsx
Apunta al código de barras o QR
```

- [ ] **Step 3: Run full test suite to verify no regressions**

```bash
cd frontend && npm test 2>&1 | tail -20
```

Expected: all tests PASS, no failures.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/screens/Scan.tsx
git commit -m "feat: wire extractEan into scan flow, update hint text"
```

---

### Task 3: Enable `qr_code` in native BarcodeDetector

**Files:**
- Modify: `frontend/src/hooks/useScanner.ts`

**Interfaces:**
- No interface changes — internal constant update only.

---

- [ ] **Step 1: Add `qr_code` to `FORMAT_CANDIDATES[0]`**

In `frontend/src/hooks/useScanner.ts`, find `FORMAT_CANDIDATES` (lines ~24-29):

```ts
const FORMAT_CANDIDATES = [
  ["ean_13", "ean_8", "code_128", "upc_e"],
  ["ean_13", "ean_8", "code_128"],
  ["ean_13", "ean_8"],
  ["ean_13"],
];
```

Replace with:

```ts
const FORMAT_CANDIDATES = [
  ["ean_13", "ean_8", "code_128", "upc_e", "qr_code"],
  ["ean_13", "ean_8", "code_128"],
  ["ean_13", "ean_8"],
  ["ean_13"],
];
```

Only the first row changes — the fallback rows are intentionally kept as-is (older devices may not support `qr_code`; they'll still decode barcodes).

- [ ] **Step 2: Run full test suite to verify no regressions**

```bash
cd frontend && npm test 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useScanner.ts
git commit -m "feat: enable qr_code format in native BarcodeDetector"
```
