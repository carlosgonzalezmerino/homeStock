# homeStock Frontend PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first React + Vite PWA that scans grocery barcodes, resolves them to products via the existing FastAPI backend, and lets a single user manage household stock levels.

**Architecture:** Layered isolation — screens render UI and call hooks; hooks wrap TanStack Query and call typed `api/*` modules; only `api/client.ts` touches `fetch`. Server state lives in TanStack Query; the only client state is theme (React context + localStorage). React Router drives navigation. Theming uses CSS custom properties (Material-3 token names) with `darkMode: "class"`, so components use one class (`bg-primary`) and get the right value per theme.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, React Router v6, TanStack Query v5, html5-qrcode, vite-plugin-pwa. Tests: Vitest + React Testing Library + MSW.

## Global Constraints

- **Do NOT change the backend.** The frontend consumes the existing API as-is. No files under `app/`, `scripts/`, or `tests/` (backend) may be modified.
- **Do NOT commit any pre-existing uncommitted changes.** The working tree has uncommitted backend refinements — every `git add` in this plan MUST name only `frontend/` paths explicitly. Never use `git add -A` or `git add .` from the repo root.
- **All new frontend code lives under `frontend/`** at the repo root (sibling to `app/`).
- **Stock-only semantics.** No expiry/caducidad concept. An item is low/out when `low === true` (backend computes `low = quantity <= threshold`).
- **API base path is `/api`.** In dev, Vite proxies `/api` → FastAPI over HTTPS (mkcert).
- **Language:** UI copy is Spanish (matches the mockups). Code identifiers are English.
- **Node ≥ 20** (repo has Node 25 / npm 11 available).

## API Contract (verified against backend source — consume, do not change)

| Method | Path | Success | Errors | Body → |
|---|---|---|---|---|
| GET | `/api/health` | `200 {status:"ok"}` | — | — |
| GET | `/api/resolve/{ean}` | `200 ProductOut` | `404 {ean}` | — |
| GET | `/api/inventory?low=<bool>` | `200 InventoryWithProductOut[]` | — | — |
| POST | `/api/inventory` | `201 InventoryOut` | `404 {ean}` (product unknown), `409 {ean}` (already tracked) | `InventoryCreate` |
| PATCH | `/api/inventory/{ean}` | `200 InventoryOut` | `404 {ean}` | `InventoryPatch` |
| DELETE | `/api/inventory/{ean}` | `204` | `404 {ean}` | — |
| POST | `/api/products` | `201 ProductOut` | — | `ProductCreate` (no `source`) |
| GET | `/api/products/{ean}` | `200 ProductOut` | `404 {ean}` | — |
| PATCH | `/api/products/{ean}` | `200 ProductOut` | `404 {ean}` | `ProductPatch` |
| GET | `/api/shopping-list` | `200 ShoppingListItemOut[]` | — | — |

**Schema shapes (TypeScript mirror of `app/schemas.py`):**

```typescript
// per-100g nutrition, all optional
interface Nutrition {
  kcal_per_100g?: number | null;
  fat_per_100g?: number | null;
  saturated_fat_per_100g?: number | null;
  carbs_per_100g?: number | null;
  sugars_per_100g?: number | null;
  fiber_per_100g?: number | null;
  proteins_per_100g?: number | null;
  salt_per_100g?: number | null;
}
interface ProductOut extends Nutrition {
  ean: string; name: string; brand?: string | null; description?: string | null;
  image_url?: string | null; category?: string | null; quantity_desc?: string | null;
  source: string;
}
interface ProductCreate extends Nutrition {   // backend sets source="manual"
  ean: string; name: string; brand?: string | null; description?: string | null;
  image_url?: string | null; category?: string | null; quantity_desc?: string | null;
}
interface InventoryOut {
  id: number; ean: string; quantity: number; threshold: number;
  unit: string; location?: string | null;
}
interface InventoryCreate {
  ean: string; quantity: number; threshold: number;
  unit?: string;            // defaults "units" server-side
  location?: string | null;
}
interface InventoryPatch {
  quantity?: number; threshold?: number; unit?: string; location?: string | null;
}
interface InventoryWithProductOut {
  inventory: InventoryOut; product: ProductOut; low: boolean;
}
interface ShoppingListItemOut {
  ean: string; name: string; quantity: number; threshold: number;
  unit: string; image_url?: string | null;
}
```

## File Structure

```
frontend/
├── index.html                 # Inter + Material Symbols <link>; #root
├── vite.config.ts             # React + PWA plugins; dev proxy /api → FastAPI; mkcert HTTPS
├── vitest.config.ts           # jsdom env, setup file, globals
├── tailwind.config.ts         # darkMode:"class"; colors→rgb(var(--…)); type/spacing scale
├── postcss.config.js
├── tsconfig.json
├── package.json
├── .gitignore                 # node_modules, dist, dev-dist, coverage
├── src/
│   ├── main.tsx               # QueryClientProvider + ThemeProvider + RouterProvider
│   ├── App.tsx                # <Routes> under <AppShell>
│   ├── index.css              # @tailwind layers + :root / .dark CSS vars
│   ├── types.ts               # the interfaces above
│   ├── test/
│   │   ├── setup.ts           # jest-dom, MSW server lifecycle
│   │   ├── server.ts          # MSW server + default handlers
│   │   └── renderWithProviders.tsx  # RTL helper (QueryClient + MemoryRouter)
│   ├── api/
│   │   ├── client.ts          # fetch wrapper + ApiError
│   │   ├── resolve.ts         # getResolve(ean)
│   │   ├── inventory.ts       # listInventory/createInventory/patchInventory/deleteInventory
│   │   ├── products.ts        # createProduct(ean, …)
│   │   └── shoppingList.ts    # getShoppingList()
│   ├── hooks/
│   │   ├── queryKeys.ts       # keys factory
│   │   ├── useInventory.ts
│   │   ├── useShoppingList.ts
│   │   ├── useResolve.ts
│   │   ├── useInventoryMutations.ts   # add/patch/delete
│   │   ├── useCreateProduct.ts
│   │   └── useScanner.ts      # thin html5-qrcode wrapper
│   ├── theme/
│   │   └── ThemeProvider.tsx  # context + toggle + localStorage + .dark on <html>
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── BottomNav.tsx
│   │   ├── Card.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── LevelBar.tsx
│   │   ├── Button.tsx
│   │   ├── QuantityStepper.tsx
│   │   └── States.tsx         # Spinner, EmptyState, ErrorState
│   └── screens/
│       ├── Dashboard.tsx
│       ├── Pantry.tsx
│       ├── Scan.tsx
│       ├── ProductDetail.tsx
│       ├── ManualEntry.tsx
│       └── Settings.tsx
```

**Build order rationale:** scaffolding → types → api client → api modules → theme → query hooks → presentational components → screens → PWA/e2e. Each task produces something independently testable; later tasks consume earlier ones through the interfaces named in each task's **Interfaces** block.

---

### Task 1: Project scaffolding + toolchain + smoke test

Stand up the `frontend/` Vite app with TypeScript, Tailwind (dark-class), Vitest, and the HTTPS dev proxy. Deliverable: `npm test` runs one passing smoke test and `npm run build` succeeds.

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/.gitignore`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `frontend/` workspace. Scripts: `npm run dev` (HTTPS on :5173, proxies `/api`), `npm run build`, `npm test` (Vitest, jsdom), `npm run lint`. Path alias `@/` → `frontend/src/`. Global test setup at `src/test/setup.ts` (jest-dom + MSW lifecycle, wired in Task 6's MSW server; empty-safe until then).

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "homestock-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.62.0",
    "html5-qrcode": "^2.3.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "msw": "^2.7.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vite-plugin-mkcert": "^1.17.6",
    "vite-plugin-pwa": "^0.21.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create TypeScript configs**

`frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "composite": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

`server.https` is enabled by `vite-plugin-mkcert` (camera needs a secure context). The proxy forwards `/api` to the FastAPI dev server; `secure: false` accepts the mkcert cert.

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    mkcert(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "homeStock",
        short_name: "homeStock",
        start_url: "/",
        display: "standalone",
        background_color: "#f7f9fb",
        theme_color: "#006e2f",
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

- [ ] **Step 4: Create `frontend/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

- [ ] **Step 5: Create `frontend/tailwind.config.ts`**

Every color maps to `rgb(var(--token) / <alpha-value>)` so opacity modifiers (`bg-primary/5`) still work; the actual hex values live in `index.css` per theme (Task 5). Spacing / radius / type scale ported from the DESIGN.md files.

```typescript
import type { Config } from "tailwindcss";

const color = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: color("--background"),
        "on-background": color("--on-background"),
        surface: color("--surface"),
        "on-surface": color("--on-surface"),
        "on-surface-variant": color("--on-surface-variant"),
        "surface-container-lowest": color("--surface-container-lowest"),
        "surface-container-low": color("--surface-container-low"),
        "surface-container": color("--surface-container"),
        "surface-container-high": color("--surface-container-high"),
        outline: color("--outline"),
        "outline-variant": color("--outline-variant"),
        primary: color("--primary"),
        "on-primary": color("--on-primary"),
        "primary-container": color("--primary-container"),
        "on-primary-container": color("--on-primary-container"),
        secondary: color("--secondary"),
        tertiary: color("--tertiary"),
        "tertiary-container": color("--tertiary-container"),
        "on-tertiary-container": color("--on-tertiary-container"),
        error: color("--error"),
        "error-container": color("--error-container"),
        "on-error-container": color("--on-error-container"),
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.25rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      spacing: {
        base: "8px",
        "stack-sm": "12px",
        "stack-md": "24px",
        gutter: "16px",
        "container-padding": "20px",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Create `frontend/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>homeStock</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `frontend/src/index.css` (minimal; palettes filled in Task 5)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 247 249 251;
  --on-background: 25 28 30;
  --surface: 247 249 251;
  --on-surface: 25 28 30;
  --on-surface-variant: 61 74 61;
  --surface-container-lowest: 255 255 255;
  --surface-container-low: 242 244 246;
  --surface-container: 236 238 240;
  --surface-container-high: 230 232 234;
  --outline: 109 123 108;
  --outline-variant: 188 203 185;
  --primary: 0 110 47;
  --on-primary: 255 255 255;
  --primary-container: 34 197 94;
  --on-primary-container: 0 75 30;
  --secondary: 84 95 115;
  --tertiary: 157 67 0;
  --tertiary-container: 255 142 77;
  --on-tertiary-container: 109 45 0;
  --error: 186 26 26;
  --error-container: 255 218 214;
  --on-error-container: 147 0 10;
}

.material-symbols-outlined {
  font-family: "Material Symbols Outlined";
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
}
```

- [ ] **Step 9: Create `frontend/src/App.tsx` and `frontend/src/main.tsx`**

`App.tsx`:

```tsx
export default function App() {
  return <div className="text-primary">homeStock</div>;
}
```

`main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 10: Create `frontend/src/test/setup.ts`**

MSW server import is added in Task 6. For now, wire jest-dom only.

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 11: Create `frontend/.gitignore`**

```gitignore
node_modules
dist
dev-dist
coverage
*.local
```

- [ ] **Step 12: Write the failing smoke test — `frontend/src/smoke.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest with the @ alias resolvable", async () => {
    const mod = await import("@/App");
    expect(typeof mod.default).toBe("function");
  });
});
```

- [ ] **Step 13: Install dependencies and run the test to verify it fails, then passes**

Run:
```bash
cd frontend && npm install && npm test
```
Expected: `npm install` succeeds; `npm test` runs and the smoke test PASSES (App resolves via `@/`). If the alias were misconfigured it would FAIL with "Cannot find module '@/App'" — confirming the test exercises the toolchain.

- [ ] **Step 14: Verify the production build compiles**

Run:
```bash
cd frontend && npm run build
```
Expected: `tsc -b` reports no errors and Vite emits `dist/` with no failures.

- [ ] **Step 15: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/vitest.config.ts frontend/tailwind.config.ts frontend/postcss.config.js frontend/index.html frontend/.gitignore frontend/src/main.tsx frontend/src/App.tsx frontend/src/index.css frontend/src/test/setup.ts frontend/src/smoke.test.ts
git commit -m "feat(frontend): scaffold Vite + TS + Tailwind + Vitest toolchain"
```

---

### Task 2: Shared API types (`src/types.ts`)

A single module mirroring `app/schemas.py` exactly. Pure type declarations — no runtime code, so the "test" is a compile-time assertion file that Vitest imports (it must compile under `strict`). This locks the contract every later task consumes.

**Files:**
- Create: `frontend/src/types.ts`
- Test: `frontend/src/types.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: exported interfaces `Nutrition`, `ProductOut`, `ProductCreate`, `InventoryOut`, `InventoryCreate`, `InventoryPatch`, `InventoryWithProductOut`, `ShoppingListItemOut`. These are the exact shapes returned/accepted by the backend; every `api/*` module and hook types against them.

- [ ] **Step 1: Write the failing test — `frontend/src/types.test.ts`**

The test constructs objects that must satisfy each interface and asserts a couple of representative field values. If a field name or optionality drifts from the backend, this file stops compiling and `vitest run` fails.

```typescript
import { describe, it, expect } from "vitest";
import type {
  ProductOut,
  InventoryOut,
  InventoryWithProductOut,
  ShoppingListItemOut,
  InventoryCreate,
  InventoryPatch,
  ProductCreate,
} from "@/types";

describe("api types mirror the backend schema", () => {
  it("ProductOut carries ean/name/source + optional nutrition", () => {
    const p: ProductOut = {
      ean: "8410000000000",
      name: "Leche entera",
      brand: null,
      description: null,
      image_url: null,
      category: null,
      quantity_desc: null,
      source: "off",
      kcal_per_100g: 64,
    };
    expect(p.source).toBe("off");
    expect(p.kcal_per_100g).toBe(64);
  });

  it("InventoryWithProductOut nests inventory + product + low", () => {
    const inv: InventoryOut = {
      id: 1,
      ean: "8410000000000",
      quantity: 2,
      threshold: 1,
      unit: "units",
      location: null,
    };
    const product: ProductOut = { ean: "8410000000000", name: "Leche", source: "off" };
    const row: InventoryWithProductOut = { inventory: inv, product, low: false };
    expect(row.low).toBe(false);
    expect(row.inventory.quantity).toBe(2);
  });

  it("create/patch/product-create shapes accept minimal fields", () => {
    const create: InventoryCreate = { ean: "x", quantity: 1, threshold: 1 };
    const patch: InventoryPatch = { quantity: 0 };
    const prod: ProductCreate = { ean: "x", name: "Manual" };
    const item: ShoppingListItemOut = {
      ean: "x",
      name: "Leche",
      quantity: 0,
      threshold: 1,
      unit: "units",
    };
    expect(create.quantity).toBe(1);
    expect(patch.quantity).toBe(0);
    expect(prod.name).toBe("Manual");
    expect(item.quantity).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/types.test.ts`
Expected: FAIL — `Cannot find module '@/types'` (the file does not exist yet).

- [ ] **Step 3: Create `frontend/src/types.ts`**

Field names, optionality, and nullability copied verbatim from `app/schemas.py`. `Nutrition` fields are `number | null` and optional (Pydantic defaults them to `None`). `unit` and `location` on `InventoryCreate` are optional (backend defaults `unit="units"`). `ProductCreate` is `ProductOut` minus the backend-set `source`.

```typescript
export interface Nutrition {
  kcal_per_100g?: number | null;
  fat_per_100g?: number | null;
  saturated_fat_per_100g?: number | null;
  carbs_per_100g?: number | null;
  sugars_per_100g?: number | null;
  fiber_per_100g?: number | null;
  proteins_per_100g?: number | null;
  salt_per_100g?: number | null;
}

export interface ProductOut extends Nutrition {
  ean: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  quantity_desc?: string | null;
  source: string;
}

export interface ProductCreate extends Nutrition {
  ean: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  quantity_desc?: string | null;
}

export interface InventoryOut {
  id: number;
  ean: string;
  quantity: number;
  threshold: number;
  unit: string;
  location?: string | null;
}

export interface InventoryCreate {
  ean: string;
  quantity: number;
  threshold: number;
  unit?: string;
  location?: string | null;
}

export interface InventoryPatch {
  quantity?: number;
  threshold?: number;
  unit?: string;
  location?: string | null;
}

export interface InventoryWithProductOut {
  inventory: InventoryOut;
  product: ProductOut;
  low: boolean;
}

export interface ShoppingListItemOut {
  ean: string;
  name: string;
  quantity: number;
  threshold: number;
  unit: string;
  image_url?: string | null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/types.test.ts`
Expected: PASS — all three cases compile and assert.

- [ ] **Step 5: Verify strict typecheck**

Run: `cd frontend && npm run lint`
Expected: `tsc --noEmit` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/types.test.ts
git commit -m "feat(frontend): add typed API contract mirroring backend schemas"
```

---

### Task 3: HTTP client + `ApiError` (`src/api/client.ts`)

The only module in the codebase that calls `fetch`. It prefixes `/api`, sends/receives JSON, and maps every non-2xx response into a typed `ApiError { status, body }` so callers branch on `status` (404 on `/resolve` is a real answer, 409 on add is recoverable). Handles the `204 No Content` case (DELETE) by returning `undefined` without parsing a body.

**Files:**
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module over `fetch`).
- Produces:
  - `class ApiError extends Error { status: number; body: unknown; }`
  - `get<T>(path: string): Promise<T>`
  - `post<T>(path: string, body: unknown): Promise<T>`
  - `patch<T>(path: string, body: unknown): Promise<T>`
  - `del(path: string): Promise<void>`
  - All paths are relative to the `/api` base (callers pass `/resolve/123`, not `/api/resolve/123`).

- [ ] **Step 1: Write the failing test — `frontend/src/api/client.test.ts`**

Tests stub the global `fetch` directly (MSW is wired later in Task 6; the client's own unit test controls `fetch` so it can assert exact URL/method/body and construct arbitrary status codes).

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { get, post, patch, del, ApiError } from "@/api/client";

function mockFetch(status: number, body?: unknown, contentType = "application/json") {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("GET prefixes /api and parses a 200 JSON body", async () => {
    const fn = mockFetch(200, { status: "ok" });
    const result = await get<{ status: string }>("/health");
    expect(fn).toHaveBeenCalledWith("/api/health", expect.objectContaining({ method: "GET" }));
    expect(result).toEqual({ status: "ok" });
  });

  it("POST sends JSON body + content-type header", async () => {
    const fn = mockFetch(201, { ean: "x" });
    await post("/inventory", { ean: "x", quantity: 1, threshold: 1 });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("/api/inventory");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ ean: "x", quantity: 1, threshold: 1 });
  });

  it("PATCH sends JSON body", async () => {
    const fn = mockFetch(200, { ean: "x", quantity: 0 });
    await patch("/inventory/x", { quantity: 0 });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("/api/inventory/x");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ quantity: 0 });
  });

  it("DELETE returns void on 204 without parsing a body", async () => {
    mockFetch(204, undefined, "");
    await expect(del("/inventory/x")).resolves.toBeUndefined();
  });

  it("throws ApiError{status,body} on non-2xx", async () => {
    mockFetch(404, { ean: "missing" });
    await expect(get("/resolve/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      body: { ean: "missing" },
    });
    expect(await get("/resolve/missing").catch((e) => e)).toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: FAIL — `Cannot find module '@/api/client'`.

- [ ] **Step 3: Create `frontend/src/api/client.ts`**

```typescript
const BASE = "/api";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  const text = await res.text();
  return text.length > 0 ? text : undefined;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function del(path: string): Promise<void> {
  await request<void>(path, { method: "DELETE" });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: PASS — all five cases green.

- [ ] **Step 5: Verify strict typecheck**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat(frontend): add typed fetch client with ApiError mapping"
```

---

### Task 4: Endpoint modules (`src/api/{resolve,inventory,products,shoppingList}.ts`)

Thin functions that name each backend endpoint and type its request/response against `@/types`. They add no logic beyond building the path and passing the body — error mapping already lives in `client.ts`. This is the surface the Query hooks (Task 6) call.

**Files:**
- Create: `frontend/src/api/resolve.ts`
- Create: `frontend/src/api/inventory.ts`
- Create: `frontend/src/api/products.ts`
- Create: `frontend/src/api/shoppingList.ts`
- Test: `frontend/src/api/endpoints.test.ts`

**Interfaces:**
- Consumes: `get/post/patch/del` from `@/api/client`; all interfaces from `@/types`.
- Produces:
  - `resolveProduct(ean: string): Promise<ProductOut>` — `GET /resolve/{ean}`.
  - `listInventory(low?: boolean): Promise<InventoryWithProductOut[]>` — `GET /inventory?low=<bool>` (omits the query param when `low` is undefined).
  - `addInventory(data: InventoryCreate): Promise<InventoryOut>` — `POST /inventory`.
  - `patchInventory(ean: string, data: InventoryPatch): Promise<InventoryOut>` — `PATCH /inventory/{ean}`.
  - `deleteInventory(ean: string): Promise<void>` — `DELETE /inventory/{ean}`.
  - `createProduct(data: ProductCreate): Promise<ProductOut>` — `POST /products`.
  - `getShoppingList(): Promise<ShoppingListItemOut[]>` — `GET /shopping-list`.

- [ ] **Step 1: Write the failing test — `frontend/src/api/endpoints.test.ts`**

The test mocks the `@/api/client` module so it can assert each endpoint builds the right path/args and forwards the client's return value unchanged. EANs are URL-encoded defensively.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "@/api/client";
import { resolveProduct } from "@/api/resolve";
import {
  listInventory,
  addInventory,
  patchInventory,
  deleteInventory,
} from "@/api/inventory";
import { createProduct } from "@/api/products";
import { getShoppingList } from "@/api/shoppingList";

vi.mock("@/api/client");

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const patch = vi.mocked(client.patch);
const del = vi.mocked(client.del);

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(undefined as never);
  post.mockResolvedValue(undefined as never);
  patch.mockResolvedValue(undefined as never);
  del.mockResolvedValue(undefined as never);
});

describe("endpoint modules", () => {
  it("resolveProduct hits /resolve/{ean}", async () => {
    get.mockResolvedValue({ ean: "8410000000000", name: "Leche", source: "off" } as never);
    const p = await resolveProduct("8410000000000");
    expect(get).toHaveBeenCalledWith("/resolve/8410000000000");
    expect(p).toEqual({ ean: "8410000000000", name: "Leche", source: "off" });
  });

  it("listInventory omits the query param when low is undefined", async () => {
    await listInventory();
    expect(get).toHaveBeenCalledWith("/inventory");
  });

  it("listInventory appends ?low=true / ?low=false", async () => {
    await listInventory(true);
    expect(get).toHaveBeenCalledWith("/inventory?low=true");
    await listInventory(false);
    expect(get).toHaveBeenCalledWith("/inventory?low=false");
  });

  it("addInventory posts to /inventory", async () => {
    const data = { ean: "x", quantity: 2, threshold: 1 };
    await addInventory(data);
    expect(post).toHaveBeenCalledWith("/inventory", data);
  });

  it("patchInventory patches /inventory/{ean}", async () => {
    await patchInventory("x", { quantity: 0 });
    expect(patch).toHaveBeenCalledWith("/inventory/x", { quantity: 0 });
  });

  it("deleteInventory deletes /inventory/{ean}", async () => {
    await deleteInventory("x");
    expect(del).toHaveBeenCalledWith("/inventory/x");
  });

  it("createProduct posts to /products", async () => {
    const data = { ean: "x", name: "Manual" };
    await createProduct(data);
    expect(post).toHaveBeenCalledWith("/products", data);
  });

  it("getShoppingList hits /shopping-list", async () => {
    await getShoppingList();
    expect(get).toHaveBeenCalledWith("/shopping-list");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/endpoints.test.ts`
Expected: FAIL — cannot find `@/api/resolve` (and siblings).

- [ ] **Step 3: Create `frontend/src/api/resolve.ts`**

```typescript
import { get } from "@/api/client";
import type { ProductOut } from "@/types";

export function resolveProduct(ean: string): Promise<ProductOut> {
  return get<ProductOut>(`/resolve/${encodeURIComponent(ean)}`);
}
```

- [ ] **Step 4: Create `frontend/src/api/inventory.ts`**

```typescript
import { get, post, patch, del } from "@/api/client";
import type {
  InventoryWithProductOut,
  InventoryOut,
  InventoryCreate,
  InventoryPatch,
} from "@/types";

export function listInventory(low?: boolean): Promise<InventoryWithProductOut[]> {
  const query = low === undefined ? "" : `?low=${low}`;
  return get<InventoryWithProductOut[]>(`/inventory${query}`);
}

export function addInventory(data: InventoryCreate): Promise<InventoryOut> {
  return post<InventoryOut>("/inventory", data);
}

export function patchInventory(ean: string, data: InventoryPatch): Promise<InventoryOut> {
  return patch<InventoryOut>(`/inventory/${encodeURIComponent(ean)}`, data);
}

export function deleteInventory(ean: string): Promise<void> {
  return del(`/inventory/${encodeURIComponent(ean)}`);
}
```

- [ ] **Step 5: Create `frontend/src/api/products.ts`**

```typescript
import { post } from "@/api/client";
import type { ProductCreate, ProductOut } from "@/types";

export function createProduct(data: ProductCreate): Promise<ProductOut> {
  return post<ProductOut>("/products", data);
}
```

- [ ] **Step 6: Create `frontend/src/api/shoppingList.ts`**

```typescript
import { get } from "@/api/client";
import type { ShoppingListItemOut } from "@/types";

export function getShoppingList(): Promise<ShoppingListItemOut[]> {
  return get<ShoppingListItemOut[]>("/shopping-list");
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/endpoints.test.ts`
Expected: PASS — all eight cases green.

> Note: `encodeURIComponent("8410000000000")` is unchanged for plain digits, so the `/resolve/8410000000000` and `/inventory/x` assertions hold. Only EANs with unusual characters would encode differently.

- [ ] **Step 8: Verify strict typecheck**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api/resolve.ts frontend/src/api/inventory.ts frontend/src/api/products.ts frontend/src/api/shoppingList.ts frontend/src/api/endpoints.test.ts
git commit -m "feat(frontend): add typed endpoint modules for resolve/inventory/products/shopping-list"
```

---

### Task 5: Theme system (`src/theme/ThemeProvider.tsx` + `.dark` palette)

Both DESIGN.md files share identical Material-3 token *names*, so the palette lives in CSS custom properties (RGB triplets) and Tailwind maps `bg-primary` → `rgb(var(--primary) / <alpha-value>)`. `:root` (created in Task 1) holds the light Alimenda palette; this task adds the `.dark` Dark Slate block that overrides the **same** token names. `ThemeProvider` decides which is active: it reads `localStorage.theme`, falls back to `prefers-color-scheme`, toggles `.dark` on `<html>`, and re-persists on change. `useTheme()` is the accessor the Settings screen (Task 8) will consume.

**Files:**
- Create: `frontend/src/theme/ThemeProvider.tsx`
- Test: `frontend/src/theme/ThemeProvider.test.tsx`
- Modify: `frontend/src/index.css` (append the `.dark { … }` block after the existing `:root` block from Task 1)
- Modify: `frontend/src/main.tsx` (wrap the render tree in `<ThemeProvider>`)

**Interfaces:**
- Consumes: nothing from earlier tasks (self-contained; relies only on the `:root` palette declared in Task 1's `index.css`).
- Produces:
  - `ThemeProvider({ children }: { children: ReactNode }): JSX.Element` — context provider; import as `@/theme/ThemeProvider`.
  - `useTheme(): { theme: "light" | "dark"; toggle: () => void }` — throws if used outside the provider.

- [ ] **Step 1: Write the failing test — `frontend/src/theme/ThemeProvider.test.tsx`**

`matchMedia` is not implemented in jsdom, so each case stubs it explicitly. A tiny `ThemeProbe` surfaces the context value and a toggle button.

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("falls back to prefers-color-scheme when localStorage is empty", () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reads the persisted theme from localStorage", () => {
    mockMatchMedia(false);
    localStorage.setItem("theme", "dark");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });

  it("toggle flips theme, updates <html>.dark, and persists", () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("light");
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("useTheme throws outside the provider", () => {
    expect(() => render(<ThemeProbe />)).toThrow(/ThemeProvider/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/theme/ThemeProvider.test.tsx`
Expected: FAIL — cannot find `@/theme/ThemeProvider`.

- [ ] **Step 3: Create `frontend/src/theme/ThemeProvider.tsx`**

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/theme/ThemeProvider.test.tsx`
Expected: PASS — all four cases green.

- [ ] **Step 5: Append the `.dark` palette to `frontend/src/index.css`**

The existing `:root` block (Task 1) holds the light Alimenda palette. Add this Dark Slate block **immediately after it** — every token here overrides a token declared in `:root`, so no `dark:` variants are needed anywhere in the app. Values are RGB triplets from `dark_slate_professional/DESIGN.md`.

```css
.dark {
  --surface: 14 21 14;
  --surface-dim: 14 21 14;
  --surface-bright: 51 59 51;
  --surface-container-lowest: 9 16 9;
  --surface-container-low: 22 29 22;
  --surface-container: 26 34 26;
  --surface-container-high: 36 44 36;
  --surface-container-highest: 47 55 46;
  --on-surface: 220 229 217;
  --on-surface-variant: 188 203 185;
  --inverse-surface: 220 229 217;
  --inverse-on-surface: 42 50 42;
  --outline: 134 149 133;
  --outline-variant: 61 74 61;
  --surface-tint: 74 225 118;
  --primary: 75 226 119;
  --on-primary: 0 57 21;
  --primary-container: 34 197 94;
  --on-primary-container: 0 75 30;
  --inverse-primary: 0 110 47;
  --secondary: 185 199 224;
  --on-secondary: 35 49 68;
  --secondary-container: 60 74 94;
  --on-secondary-container: 171 185 210;
  --tertiary: 255 181 171;
  --on-tertiary: 96 19 13;
  --tertiary-container: 255 139 124;
  --on-tertiary-container: 118 35 27;
  --error: 255 180 171;
  --on-error: 105 0 5;
  --error-container: 147 0 10;
  --on-error-container: 255 218 214;
  --background: 14 21 14;
  --on-background: 220 229 217;
}
```

> Consistency note: the token names in this `.dark` block must exactly match those declared in the `:root` block from Task 1. If Task 1's `:root` names any token not overridden here, dark mode inherits the light value for it — add the missing override.

- [ ] **Step 6: Wire `ThemeProvider` into `frontend/src/main.tsx`**

Wrap the existing render tree so the theme class is applied before first paint. `ThemeProvider` is the outermost app provider; `QueryClientProvider` and the router are nested inside it in later tasks.

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/theme/ThemeProvider";
import App from "@/App";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 7: Verify strict typecheck**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/theme/ThemeProvider.tsx frontend/src/theme/ThemeProvider.test.tsx frontend/src/index.css frontend/src/main.tsx
git commit -m "feat(frontend): add light/dark theme provider with CSS-variable palettes"
```

---

### Task 6: TanStack Query hooks + MSW test infrastructure

All data-fetching lives here. Each hook wraps one (or a family of) TanStack Query calls; the only imports from outside this task are the `api/*` modules from Tasks 3–4 and the types from Task 2. MSW `server` is wired into the Vitest setup file so every subsequent test suite gets network interception for free.

**Files:**
- Create: `frontend/src/hooks/queryKeys.ts`
- Create: `frontend/src/hooks/useInventory.ts`
- Create: `frontend/src/hooks/useShoppingList.ts`
- Create: `frontend/src/hooks/useResolve.ts`
- Create: `frontend/src/hooks/useMutations.ts`
- Create: `frontend/src/hooks/useScanner.ts`
- Create: `frontend/src/hooks/index.ts`
- Create: `frontend/src/test/server.ts`
- Modify: `frontend/src/test/setup.ts` (add MSW lifecycle)
- Test: `frontend/src/hooks/hooks.test.tsx`

**Interfaces:**
- Consumes (from Task 2): `ProductOut`, `InventoryOut`, `InventoryWithProductOut`, `InventoryCreate`, `InventoryPatch`, `ProductCreate`, `ShoppingListItemOut`
- Consumes (from Task 3 — `api/client.ts`): `ApiError`
- Consumes (from Task 3 — `api/inventory.ts`): `listInventory(low?: boolean): Promise<InventoryWithProductOut[]>`, `createInventory(body: InventoryCreate): Promise<InventoryOut>`, `patchInventory(ean: string, body: InventoryPatch): Promise<InventoryOut>`, `deleteInventory(ean: string): Promise<void>`
- Consumes (from Task 3 — `api/resolve.ts`): `resolveEan(ean: string): Promise<ProductOut>`
- Consumes (from Task 3 — `api/products.ts`): `createProduct(body: ProductCreate): Promise<ProductOut>`
- Consumes (from Task 4 — `api/shoppingList.ts`): `getShoppingList(): Promise<ShoppingListItemOut[]>`
- Produces:
  - `queryKeys` — `{ inventory: (low?: boolean) => readonly unknown[]; shoppingList: () => readonly unknown[] }`
  - `useInventory(low?: boolean): UseQueryResult<InventoryWithProductOut[], Error>`
  - `useShoppingList(): UseQueryResult<ShoppingListItemOut[], Error>`
  - `useResolve(ean: string): UseQueryResult<ProductOut, Error>` — `enabled: !!ean`, `retry: false`
  - `useAddInventory(): UseMutationResult<InventoryOut, Error, InventoryCreate>`
  - `usePatchInventory(): UseMutationResult<InventoryOut, Error, { ean: string; body: InventoryPatch }>`
  - `useDeleteInventory(): UseMutationResult<void, Error, string>`
  - `useCreateProduct(): UseMutationResult<ProductOut, Error, ProductCreate>`
  - `useScanner(onDetect: (ean: string) => void): { ref: React.RefObject<HTMLDivElement>; error: string | null }` — wraps html5-qrcode; `ref` is the mount target
  - MSW `server` exported from `frontend/src/test/server.ts` and available in all tests

- [ ] **Step 1: Write the failing tests — `frontend/src/hooks/hooks.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import {
  useInventory,
  useShoppingList,
  useResolve,
  useAddInventory,
  usePatchInventory,
  useDeleteInventory,
  useCreateProduct,
} from "@/hooks";
import type {
  InventoryWithProductOut,
  ShoppingListItemOut,
  ProductOut,
  InventoryOut,
} from "@/types";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// ── fixtures ─────────────────────────────────────────────────────────────────

const product: ProductOut = {
  ean: "1234567890123",
  name: "Leche entera",
  source: "off",
};

const inventoryItem: InventoryWithProductOut = {
  inventory: {
    id: 1,
    ean: "1234567890123",
    quantity: 3,
    threshold: 2,
    unit: "units",
  },
  product,
  low: false,
};

const lowItem: InventoryWithProductOut = {
  inventory: {
    id: 2,
    ean: "9876543210987",
    name: "Pan integral",
    source: "manual",
    quantity: 1,
    threshold: 2,
    unit: "units",
  } as unknown as InventoryOut,
  product: { ean: "9876543210987", name: "Pan integral", source: "manual" },
  low: true,
};

const shoppingItem: ShoppingListItemOut = {
  ean: "9876543210987",
  name: "Pan integral",
  quantity: 1,
  threshold: 2,
  unit: "units",
};

// ── useInventory ──────────────────────────────────────────────────────────────

describe("useInventory", () => {
  it("fetches the full inventory list", async () => {
    server.use(
      http.get("/api/inventory", () =>
        HttpResponse.json([inventoryItem, lowItem]),
      ),
    );
    const { result } = renderHook(() => useInventory(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("passes low=true as a query param", async () => {
    server.use(
      http.get("/api/inventory", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("low") === "true") {
          return HttpResponse.json([lowItem]);
        }
        return HttpResponse.json([inventoryItem, lowItem]);
      }),
    );
    const { result } = renderHook(() => useInventory(true), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].low).toBe(true);
  });
});

// ── useShoppingList ───────────────────────────────────────────────────────────

describe("useShoppingList", () => {
  it("fetches the shopping list", async () => {
    server.use(
      http.get("/api/shopping-list", () =>
        HttpResponse.json([shoppingItem]),
      ),
    );
    const { result } = renderHook(() => useShoppingList(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].ean).toBe("9876543210987");
  });
});

// ── useResolve ────────────────────────────────────────────────────────────────

describe("useResolve", () => {
  it("is disabled when ean is empty", () => {
    const { result } = renderHook(() => useResolve(""), {
      wrapper: makeWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches product when ean is provided", async () => {
    server.use(
      http.get("/api/resolve/:ean", () => HttpResponse.json(product)),
    );
    const { result } = renderHook(
      () => useResolve("1234567890123"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.name).toBe("Leche entera");
  });

  it("does not retry on 404", async () => {
    let callCount = 0;
    server.use(
      http.get("/api/resolve/:ean", () => {
        callCount += 1;
        return HttpResponse.json({ ean: "0000000000000" }, { status: 404 });
      }),
    );
    const { result } = renderHook(
      () => useResolve("0000000000000"),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
  });
});

// ── mutations ─────────────────────────────────────────────────────────────────

describe("useAddInventory", () => {
  it("invalidates inventory and shopping-list on success", async () => {
    let inventoryCalls = 0;
    let shoppingCalls = 0;
    server.use(
      http.post("/api/inventory", () =>
        HttpResponse.json(
          { id: 3, ean: "1234567890123", quantity: 1, threshold: 2, unit: "units" },
          { status: 201 },
        ),
      ),
      http.get("/api/inventory", () => {
        inventoryCalls += 1;
        return HttpResponse.json([inventoryItem]);
      }),
      http.get("/api/shopping-list", () => {
        shoppingCalls += 1;
        return HttpResponse.json([]);
      }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    // Prime the cache so we can observe invalidation
    await qc.fetchQuery({
      queryKey: ["inventory", { low: undefined }],
      queryFn: () => Promise.resolve([inventoryItem]),
    });
    await qc.fetchQuery({
      queryKey: ["shopping-list"],
      queryFn: () => Promise.resolve([shoppingItem]),
    });
    inventoryCalls = 0;
    shoppingCalls = 0;

    const { result } = renderHook(() => useAddInventory(), { wrapper });
    result.current.mutate({
      ean: "1234567890123",
      quantity: 1,
      threshold: 2,
      unit: "units",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Invalidation triggers a refetch of the primed queries
    await waitFor(() => expect(inventoryCalls).toBeGreaterThan(0));
    await waitFor(() => expect(shoppingCalls).toBeGreaterThan(0));
  });
});

describe("usePatchInventory", () => {
  it("calls PATCH /api/inventory/:ean and invalidates caches", async () => {
    let patched = false;
    server.use(
      http.patch("/api/inventory/:ean", () => {
        patched = true;
        return HttpResponse.json({
          id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units",
        });
      }),
      http.get("/api/inventory", () => HttpResponse.json([inventoryItem])),
      http.get("/api/shopping-list", () => HttpResponse.json([])),
    );
    const { result } = renderHook(() => usePatchInventory(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate({ ean: "1234567890123", body: { quantity: 5 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(patched).toBe(true);
  });
});

describe("useDeleteInventory", () => {
  it("calls DELETE /api/inventory/:ean and invalidates caches", async () => {
    let deleted = false;
    server.use(
      http.delete("/api/inventory/:ean", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([])),
    );
    const { result } = renderHook(() => useDeleteInventory(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate("1234567890123");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleted).toBe(true);
  });
});

describe("useCreateProduct", () => {
  it("calls POST /api/products and invalidates caches", async () => {
    server.use(
      http.post("/api/products", () =>
        HttpResponse.json(
          { ean: "1111111111111", name: "Nuevo producto", source: "manual" },
          { status: 201 },
        ),
      ),
      http.get("/api/inventory", () => HttpResponse.json([])),
      http.get("/api/shopping-list", () => HttpResponse.json([])),
    );
    const { result } = renderHook(() => useCreateProduct(), {
      wrapper: makeWrapper(),
    });
    result.current.mutate({ ean: "1111111111111", name: "Nuevo producto" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.source).toBe("manual");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/hooks/hooks.test.tsx`
Expected: FAIL — modules `@/hooks`, `@/test/server` not found yet.

- [ ] **Step 3: Create `frontend/src/test/server.ts`**

```typescript
import { setupServer } from "msw/node";

export const server = setupServer();
```

- [ ] **Step 4: Update `frontend/src/test/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 5: Create `frontend/src/hooks/queryKeys.ts`**

```typescript
export const queryKeys = {
  inventory: (low?: boolean) => ["inventory", { low }] as const,
  shoppingList: () => ["shopping-list"] as const,
};
```

- [ ] **Step 6: Create `frontend/src/hooks/useInventory.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { listInventory } from "@/api/inventory";
import { queryKeys } from "./queryKeys";

export function useInventory(low?: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory(low),
    queryFn: () => listInventory(low),
  });
}
```

- [ ] **Step 7: Create `frontend/src/hooks/useShoppingList.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { getShoppingList } from "@/api/shoppingList";
import { queryKeys } from "./queryKeys";

export function useShoppingList() {
  return useQuery({
    queryKey: queryKeys.shoppingList(),
    queryFn: getShoppingList,
  });
}
```

- [ ] **Step 8: Create `frontend/src/hooks/useResolve.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { resolveEan } from "@/api/resolve";

export function useResolve(ean: string) {
  return useQuery({
    queryKey: ["resolve", ean],
    queryFn: () => resolveEan(ean),
    enabled: !!ean,
    retry: false,
  });
}
```

- [ ] **Step 9: Create `frontend/src/hooks/useMutations.ts`**

Every mutation invalidates both `["inventory"]` and `["shopping-list"]` on success so the Dashboard and Pantry re-fetch automatically after any stock change.

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createInventory,
  patchInventory,
  deleteInventory,
} from "@/api/inventory";
import { createProduct } from "@/api/products";
import type { InventoryCreate, InventoryPatch, ProductCreate } from "@/types";

function useInvalidateBoth() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["inventory"] }),
      qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    ]);
}

export function useAddInventory() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: (body: InventoryCreate) => createInventory(body),
    onSuccess: invalidate,
  });
}

export function usePatchInventory() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: ({ ean, body }: { ean: string; body: InventoryPatch }) =>
      patchInventory(ean, body),
    onSuccess: invalidate,
  });
}

export function useDeleteInventory() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: (ean: string) => deleteInventory(ean),
    onSuccess: invalidate,
  });
}

export function useCreateProduct() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: (body: ProductCreate) => createProduct(body),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 10: Create `frontend/src/hooks/useScanner.ts`**

The hook mounts `Html5Qrcode` on a `<div>` ref, starts the camera, and calls `onDetect` with the decoded EAN. It stops and cleans up on unmount. When camera access is denied or unavailable, `error` is set so the screen can render the manual-entry fallback.

```typescript
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function useScanner(onDetect: (ean: string) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const elementId = ref.current.id || "qr-region";
    if (!ref.current.id) ref.current.id = elementId;

    const scanner = new Html5Qrcode(elementId);
    let active = true;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (active) onDetect(decodedText);
        },
        undefined,
      )
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Cámara no disponible",
        );
      });

    return () => {
      active = false;
      scanner.stop().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, error };
}
```

- [ ] **Step 11: Create `frontend/src/hooks/index.ts`**

```typescript
export { useInventory } from "./useInventory";
export { useShoppingList } from "./useShoppingList";
export { useResolve } from "./useResolve";
export {
  useAddInventory,
  usePatchInventory,
  useDeleteInventory,
  useCreateProduct,
} from "./useMutations";
export { useScanner } from "./useScanner";
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/hooks/hooks.test.tsx`
Expected: all tests PASS.

- [ ] **Step 13: Verify typecheck**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/hooks/queryKeys.ts frontend/src/hooks/useInventory.ts frontend/src/hooks/useShoppingList.ts frontend/src/hooks/useResolve.ts frontend/src/hooks/useMutations.ts frontend/src/hooks/useScanner.ts frontend/src/hooks/index.ts frontend/src/test/server.ts frontend/src/test/setup.ts frontend/src/hooks/hooks.test.tsx
git commit -m "feat(frontend): add TanStack Query hooks and MSW test infrastructure"
```

---

### Task 7: Presentational components

Pure UI atoms. No data fetching — every component takes typed props and returns JSX. These are the building blocks every screen imports. Tests exercise the behaviour rules locked in the spec: `StatusBadge` label/colour mapping, `Card` accent border, `QuantityStepper` clamping, `BottomNav` active-route highlighting.

**Files:**
- Create: `frontend/src/components/AppShell.tsx`
- Create: `frontend/src/components/BottomNav.tsx`
- Create: `frontend/src/components/Card.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`
- Create: `frontend/src/components/LevelBar.tsx`
- Create: `frontend/src/components/Button.tsx`
- Create: `frontend/src/components/QuantityStepper.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Create: `frontend/src/components/Spinner.tsx`
- Create: `frontend/src/components/ErrorState.tsx`
- Create: `frontend/src/components/index.ts`
- Test: `frontend/src/components/components.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom` (`NavLink`, `Outlet`) for `AppShell`/`BottomNav`; no hooks, no api modules.
- Produces (exact prop signatures later tasks depend on):
  - `AppShell(): JSX.Element` — sticky header + `<Outlet />` + `<BottomNav />`; adds `pb-32` to the content area for bottom-nav clearance
  - `BottomNav(): JSX.Element` — 4 `NavLink`s: `/` (home), `/despensa`, `/scan`, `/settings`; active tab gets `bg-primary-container` pill
  - `Card({ children, accent? }: { children: ReactNode; accent?: "error" | "tertiary" | null }): JSX.Element` — `surface-container-lowest` bg, `rounded-lg` (1rem), soft border; when `accent` is set adds a 4px left border in the accent colour
  - `StatusBadge({ low }: { low: boolean }): JSX.Element` — `low === false` → label "EN BUEN ESTADO", `text-primary`; `low === true` → label "STOCK BAJO", `text-tertiary`
  - `LevelBar({ quantity, max }: { quantity: number; max: number }): JSX.Element` — renders a filled bar at `(quantity / max) * 100 %`; clamps to `[0, 100]`
  - `Button({ children, onClick, type?, disabled?, variant? }: ButtonProps): JSX.Element` — pill shape, min-height 56px, `bg-primary-container text-on-primary-container`; `variant="ghost"` → transparent bg, `text-on-surface-variant`
  - `QuantityStepper({ value, onChange }: { value: number; onChange: (n: number) => void }): JSX.Element` — `−` button decrements (minimum 0), `＋` button increments; displays current value between the buttons
  - `EmptyState({ message }: { message: string }): JSX.Element`
  - `Spinner(): JSX.Element`
  - `ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing tests — `frontend/src/components/components.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  Card,
  StatusBadge,
  LevelBar,
  QuantityStepper,
  Button,
  EmptyState,
  Spinner,
  ErrorState,
} from "@/components";

// ── StatusBadge ───────────────────────────────────────────────────────────────

describe("StatusBadge", () => {
  it("shows EN BUEN ESTADO when low is false", () => {
    render(<StatusBadge low={false} />);
    expect(screen.getByText("EN BUEN ESTADO")).toBeInTheDocument();
  });

  it("shows STOCK BAJO when low is true", () => {
    render(<StatusBadge low={true} />);
    expect(screen.getByText("STOCK BAJO")).toBeInTheDocument();
  });
});

// ── Card ──────────────────────────────────────────────────────────────────────

describe("Card", () => {
  it("renders children", () => {
    render(<Card>contenido</Card>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("applies error accent class when accent='error'", () => {
    const { container } = render(<Card accent="error">x</Card>);
    expect(container.firstChild).toHaveClass("border-l-4");
    expect(container.firstChild).toHaveClass("border-l-error");
  });

  it("applies tertiary accent class when accent='tertiary'", () => {
    const { container } = render(<Card accent="tertiary">x</Card>);
    expect(container.firstChild).toHaveClass("border-l-tertiary");
  });

  it("has no accent border when accent is null", () => {
    const { container } = render(<Card accent={null}>x</Card>);
    expect(container.firstChild).not.toHaveClass("border-l-4");
  });
});

// ── LevelBar ──────────────────────────────────────────────────────────────────

describe("LevelBar", () => {
  it("sets width proportional to quantity/max", () => {
    render(<LevelBar quantity={3} max={10} />);
    const fill = document.querySelector("[data-testid='level-bar-fill']");
    expect(fill).toHaveStyle({ width: "30%" });
  });

  it("clamps to 100% when quantity exceeds max", () => {
    render(<LevelBar quantity={15} max={10} />);
    const fill = document.querySelector("[data-testid='level-bar-fill']");
    expect(fill).toHaveStyle({ width: "100%" });
  });

  it("clamps to 0% when quantity is 0", () => {
    render(<LevelBar quantity={0} max={10} />);
    const fill = document.querySelector("[data-testid='level-bar-fill']");
    expect(fill).toHaveStyle({ width: "0%" });
  });
});

// ── QuantityStepper ───────────────────────────────────────────────────────────

describe("QuantityStepper", () => {
  it("displays the current value", () => {
    render(<QuantityStepper value={4} onChange={vi.fn()} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("calls onChange with value + 1 on + click", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "＋" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with value - 1 on − click", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("does not go below 0", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "−" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── Button ────────────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders children and calls onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button onClick={vi.fn()} disabled>Guardar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

// ── EmptyState / Spinner / ErrorState ─────────────────────────────────────────

describe("EmptyState", () => {
  it("renders the message", () => {
    render(<EmptyState message="Tu despensa está vacía" />);
    expect(screen.getByText("Tu despensa está vacía")).toBeInTheDocument();
  });
});

describe("Spinner", () => {
  it("renders without crashing", () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders message and retry button", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error de red" onRetry={onRetry} />);
    expect(screen.getByText("Error de red")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/components.test.tsx`
Expected: FAIL — `@/components` not found yet.

- [ ] **Step 3: Create `frontend/src/components/StatusBadge.tsx`**

```tsx
export function StatusBadge({ low }: { low: boolean }) {
  return low ? (
    <span className="text-label-md uppercase text-tertiary">STOCK BAJO</span>
  ) : (
    <span className="text-label-md uppercase text-primary">EN BUEN ESTADO</span>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/Card.tsx`**

```tsx
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  accent?: "error" | "tertiary" | null;
}

export function Card({ children, accent }: CardProps) {
  const accentClass =
    accent === "error"
      ? "border-l-4 border-l-error"
      : accent === "tertiary"
        ? "border-l-4 border-l-tertiary"
        : "";

  return (
    <div
      className={`bg-surface-container-lowest rounded-lg border border-outline-variant p-4 ${accentClass}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/LevelBar.tsx`**

```tsx
interface LevelBarProps {
  quantity: number;
  max: number;
}

export function LevelBar({ quantity, max }: LevelBarProps) {
  const pct = Math.min(100, Math.max(0, (quantity / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-outline-variant overflow-hidden">
      <div
        data-testid="level-bar-fill"
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/components/QuantityStepper.tsx`**

```tsx
interface QuantityStepperProps {
  value: number;
  onChange: (n: number) => void;
}

export function QuantityStepper({ value, onChange }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        aria-label="−"
        onClick={() => { if (value > 0) onChange(value - 1); }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface text-xl"
        type="button"
      >
        −
      </button>
      <span className="min-w-[2ch] text-center text-headline-md">{value}</span>
      <button
        aria-label="＋"
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-xl"
        type="button"
      >
        ＋
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Create `frontend/src/components/Button.tsx`**

```tsx
import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: "primary" | "ghost";
}

export function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
}: ButtonProps) {
  const base =
    "inline-flex min-h-[56px] items-center justify-center rounded-full px-8 text-body-lg font-semibold transition-opacity disabled:opacity-50";
  const variantClass =
    variant === "ghost"
      ? "bg-transparent text-on-surface-variant"
      : "bg-primary-container text-on-primary-container";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variantClass}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 8: Create `frontend/src/components/EmptyState.tsx`**

```tsx
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl">inventory_2</span>
      <p className="text-body-lg text-center">{message}</p>
    </div>
  );
}
```

- [ ] **Step 9: Create `frontend/src/components/Spinner.tsx`**

```tsx
export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <span
        aria-label="Cargando"
        className="h-10 w-10 animate-spin rounded-full border-4 border-outline-variant border-t-primary"
      />
    </div>
  );
}
```

- [ ] **Step 10: Create `frontend/src/components/ErrorState.tsx`**

```tsx
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-on-surface">
      <span className="material-symbols-outlined text-5xl text-error">error</span>
      <p className="text-body-lg">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-primary underline text-body-lg"
      >
        Reintentar
      </button>
    </div>
  );
}
```

- [ ] **Step 11: Create `frontend/src/components/BottomNav.tsx`**

```tsx
import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Inicio", icon: "home" },
  { to: "/despensa", label: "Despensa", icon: "kitchen" },
  { to: "/scan", label: "Escanear", icon: "qr_code_scanner" },
  { to: "/settings", label: "Ajustes", icon: "settings" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-end justify-around bg-surface-container pb-safe border-t border-outline-variant">
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-4 py-2 rounded-full transition-colors ${
              isActive ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant"
            }`
          }
        >
          <span className="material-symbols-outlined text-2xl">{icon}</span>
          <span className="text-label-md">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

- [ ] **Step 12: Create `frontend/src/components/AppShell.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-outline-variant bg-surface px-container-padding">
        <span className="text-headline-md font-bold text-primary">homeStock</span>
      </header>
      <main className="pb-32 px-container-padding">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 13: Create `frontend/src/components/index.ts`**

```typescript
export { AppShell } from "./AppShell";
export { BottomNav } from "./BottomNav";
export { Card } from "./Card";
export { StatusBadge } from "./StatusBadge";
export { LevelBar } from "./LevelBar";
export { Button } from "./Button";
export { QuantityStepper } from "./QuantityStepper";
export { EmptyState } from "./EmptyState";
export { Spinner } from "./Spinner";
export { ErrorState } from "./ErrorState";
```

- [ ] **Step 14: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/components.test.tsx`
Expected: all tests PASS.

- [ ] **Step 15: Verify typecheck**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 16: Commit**

```bash
git add frontend/src/components/AppShell.tsx frontend/src/components/BottomNav.tsx frontend/src/components/Card.tsx frontend/src/components/StatusBadge.tsx frontend/src/components/LevelBar.tsx frontend/src/components/Button.tsx frontend/src/components/QuantityStepper.tsx frontend/src/components/EmptyState.tsx frontend/src/components/Spinner.tsx frontend/src/components/ErrorState.tsx frontend/src/components/index.ts frontend/src/components/components.test.tsx
git commit -m "feat(frontend): add presentational component library"
```

---

### Task 8: Screens

Wire the six screens together with React Router, TanStack Query, and the presentational components built in Tasks 6–7. Also update `App.tsx` with routing.

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/screens/Dashboard.tsx`
- Create: `frontend/src/screens/Pantry.tsx`
- Create: `frontend/src/screens/Scan.tsx`
- Create: `frontend/src/screens/ProductDetail.tsx`
- Create: `frontend/src/screens/ManualEntry.tsx`
- Create: `frontend/src/screens/Settings.tsx`
- Create: `frontend/src/screens/index.ts`
- Test: `frontend/src/screens/screens.test.tsx`

**Interfaces:**
- Consumes (from Task 5): `@/types` — `InventoryWithProductOut`, `ProductOut`, `InventoryCreate`, `InventoryPatch`
- Consumes (from Task 6): `useInventory`, `useResolve`, `useAddInventory`, `usePatchInventory`, `useDeleteInventory`, `useCreateProduct`, `useScanner`
- Consumes (from Task 7): `AppShell`, `Card`, `StatusBadge`, `LevelBar`, `Button`, `QuantityStepper`, `EmptyState`, `Spinner`, `ErrorState`
- Produces: six screen components + updated `App.tsx` routing

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/screens/screens.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrap(ui: React.ReactElement, { path = "/", initialEntries = ["/"] } = {}) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const inventoryFull = [
  {
    inventory: { id: 1, ean: "1234567890123", quantity: 5, threshold: 2, unit: "units" },
    product: { ean: "1234567890123", name: "Leche Entera", brand: "Hacendado", category: "Lácteos", source: "off" },
    low: false,
  },
];

const inventoryLow = [
  {
    inventory: { id: 2, ean: "9999999999999", quantity: 1, threshold: 2, unit: "units" },
    product: { ean: "9999999999999", name: "Aceite Oliva", brand: "Carbonell", category: "Aceites", source: "off" },
    low: true,
  },
];

const inventoryMixed = [...inventoryFull, ...inventoryLow];

// ─── Dashboard ──────────────────────────────────────────────────────────────

import { Dashboard } from "@/screens/Dashboard";

describe("Dashboard", () => {
  it("shows low-stock carousel items", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Dashboard />);
    await screen.findByText("Alertas de Stock");
    expect(screen.getByText("Aceite Oliva")).toBeInTheDocument();
    expect(screen.queryByText("Leche Entera")).not.toBeInTheDocument();
  });

  it("shows EmptyState when no low-stock items", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull))
    );
    wrap(<Dashboard />);
    await screen.findByText(/sin alertas/i);
  });

  it("shows Spinner while loading", () => {
    server.use(
      http.get("/api/inventory", async () => {
        await new Promise(() => {}); // never resolves
      })
    );
    wrap(<Dashboard />);
    expect(screen.getByRole("status")).toBeInTheDocument(); // Spinner has role="status"
  });
});

// ─── Pantry ─────────────────────────────────────────────────────────────────

import { Pantry } from "@/screens/Pantry";

describe("Pantry", () => {
  it("renders inventory items", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Pantry />);
    await screen.findByText("Leche Entera");
    expect(screen.getByText("Aceite Oliva")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Pantry />);
    await screen.findByText("Leche Entera");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Aceite" } });
    expect(screen.getByText("Aceite Oliva")).toBeInTheDocument();
    expect(screen.queryByText("Leche Entera")).not.toBeInTheDocument();
  });

  it("filters by category chip", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json(inventoryMixed))
    );
    wrap(<Pantry />);
    await screen.findByText("Lácteos");
    fireEvent.click(screen.getByText("Lácteos"));
    expect(screen.getByText("Leche Entera")).toBeInTheDocument();
    expect(screen.queryByText("Aceite Oliva")).not.toBeInTheDocument();
  });

  it("shows EmptyState when pantry is empty", async () => {
    server.use(
      http.get("/api/inventory", () => HttpResponse.json([]))
    );
    wrap(<Pantry />);
    await screen.findByText(/despensa está vacía/i);
  });
});

// ─── ProductDetail ──────────────────────────────────────────────────────────

import { ProductDetail } from "@/screens/ProductDetail";

describe("ProductDetail", () => {
  const ean = "1234567890123";

  it("pre-fills stepper with current quantity for tracked item", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull))
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.getByText("5")).toBeInTheDocument(); // current qty
    expect(screen.getByText("Actualizar")).toBeInTheDocument();
  });

  it("starts stepper at 1 for untracked item", async () => {
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json([])) // not tracked
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Añadir a mi despensa")).toBeInTheDocument();
  });

  it("PATCH (not DELETE) when tracked item reaches 0", async () => {
    let patchCalled = false;
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull)),
      http.patch(`/api/inventory/${ean}`, async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        if (body.quantity === 0) patchCalled = true;
        return HttpResponse.json({ id: 1, ean, quantity: 0, threshold: 2, unit: "units" });
      })
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Leche Entera");
    // decrement 5 times to reach 0
    const minus = screen.getByRole("button", { name: "−" });
    for (let i = 0; i < 5; i++) fireEvent.click(minus);
    expect(screen.getByText("0")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Actualizar"));
    await waitFor(() => expect(patchCalled).toBe(true));
  });

  it("DELETE when 'Quitar de la despensa' is clicked", async () => {
    let deleteCalled = false;
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Leche Entera", source: "off" })
      ),
      http.get("/api/inventory", () => HttpResponse.json(inventoryFull)),
      http.delete(`/api/inventory/${ean}`, () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    wrap(<ProductDetail />, { path: "/scan/:ean", initialEntries: [`/scan/${ean}`] });
    await screen.findByText("Quitar de la despensa");
    fireEvent.click(screen.getByText("Quitar de la despensa"));
    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});

// ─── Scan ───────────────────────────────────────────────────────────────────

import { Scan } from "@/screens/Scan";

// useScanner is mocked because html5-qrcode has no jsdom camera
vi.mock("@/hooks/useScanner", () => ({
  useScanner: (_onDetect: (ean: string) => void) => ({
    ref: { current: null },
    error: "Camera not available in test",
  }),
}));

describe("Scan", () => {
  it("shows manual input fallback when scanner errors", async () => {
    wrap(<Scan />, { path: "/scan", initialEntries: ["/scan"] });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("navigates to /scan/:ean on 200 from resolve", async () => {
    const ean = "5000112637922";
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean, name: "Pasta Fusilli", source: "off" })
      )
    );
    // Render inside a router that has both routes so navigation works
    const qc = makeQC();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/scan"]}>
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/:ean" element={<div>ProductDetail</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: ean } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("ProductDetail");
  });

  it("navigates to /scan/:ean/manual on 404 from resolve", async () => {
    const ean = "0000000000000";
    server.use(
      http.get(`/api/resolve/${ean}`, () =>
        HttpResponse.json({ ean }, { status: 404 })
      )
    );
    const qc = makeQC();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/scan"]}>
          <Routes>
            <Route path="/scan" element={<Scan />} />
            <Route path="/scan/:ean/manual" element={<div>ManualEntry</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: ean } });
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("ManualEntry");
  });
});

// ─── ManualEntry ─────────────────────────────────────────────────────────────

import { ManualEntry } from "@/screens/ManualEntry";

describe("ManualEntry", () => {
  it("pre-fills ean from URL param", async () => {
    const ean = "1111111111111";
    wrap(<ManualEntry />, {
      path: "/scan/:ean/manual",
      initialEntries: [`/scan/${ean}/manual`],
    });
    const eanInput = screen.getByDisplayValue(ean);
    expect(eanInput).toBeInTheDocument();
  });

  it("calls POST /products then POST /inventory on submit", async () => {
    const ean = "2222222222222";
    let productsCalled = false;
    let inventoryCalled = false;
    server.use(
      http.post("/api/products", async () => {
        productsCalled = true;
        return HttpResponse.json({ ean, name: "Producto Manual", source: "manual" }, { status: 201 });
      }),
      http.post("/api/inventory", async () => {
        inventoryCalled = true;
        return HttpResponse.json({ id: 99, ean, quantity: 1, threshold: 1, unit: "units" }, { status: 201 });
      }),
      http.get("/api/inventory", () => HttpResponse.json([]))
    );
    const qc = makeQC();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/scan/${ean}/manual`]}>
          <Routes>
            <Route path="/scan/:ean/manual" element={<ManualEntry />} />
            <Route path="/despensa" element={<div>Pantry</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Producto Manual" } });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(productsCalled).toBe(true));
    await waitFor(() => expect(inventoryCalled).toBe(true));
    await screen.findByText("Pantry");
  });
});

// ─── Settings ────────────────────────────────────────────────────────────────

import { Settings } from "@/screens/Settings";

// ThemeProvider is needed; provide a minimal stub
vi.mock("@/theme", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

describe("Settings", () => {
  it("renders theme toggle button", () => {
    wrap(<Settings />);
    expect(screen.getByRole("button", { name: /tema/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/screens/screens.test.tsx`
Expected: FAIL — all screen imports not found.

- [ ] **Step 3: Update `frontend/src/App.tsx` with routing**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme";
import { AppShell } from "@/components";
import { Dashboard, Pantry, Scan, ProductDetail, ManualEntry, Settings } from "@/screens";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="despensa" element={<Pantry />} />
              <Route path="scan" element={<Scan />} />
              <Route path="scan/:ean" element={<ProductDetail />} />
              <Route path="scan/:ean/manual" element={<ManualEntry />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Create `frontend/src/screens/Dashboard.tsx`**

```tsx
import { useMemo } from "react";
import { useInventory } from "@/hooks";
import { Card, StatusBadge, LevelBar, Spinner, ErrorState, EmptyState } from "@/components";
import type { InventoryWithProductOut } from "@/types";

export function Dashboard() {
  const { data, isLoading, isError, refetch } = useInventory();

  const lowItems = useMemo(
    () => (data ?? []).filter((i) => i.low),
    [data]
  );

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of data ?? []) {
      const cat = i.product.category ?? "Otros";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-stack-md pt-stack-md">
      <section>
        <h2 className="text-headline-md text-on-surface mb-stack-sm">Resumen</h2>
        <div className="grid grid-cols-2 gap-gutter">
          <SummaryCard label="Productos" value={data?.length ?? 0} />
          <SummaryCard label="Stock bajo" value={lowItems.length} accent />
        </div>
      </section>

      {categories.length > 0 && (
        <section>
          <h2 className="text-headline-md text-on-surface mb-stack-sm">Categorías</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(([cat, count]) => (
              <span
                key={cat}
                className="rounded-full bg-secondary-container text-on-secondary-container text-label-md px-3 py-1"
              >
                {cat} ({count})
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-headline-md text-on-surface mb-stack-sm">Alertas de Stock</h2>
        {lowItems.length === 0 ? (
          <EmptyState message="Sin alertas de stock" icon="check_circle" />
        ) : (
          <div className="space-y-stack-sm">
            {lowItems.map((item) => (
              <LowStockCard key={item.inventory.ean} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card accent={accent ? "error" : undefined}>
      <p className="text-label-md text-on-surface-variant">{label}</p>
      <p className="text-headline-md text-on-surface">{value}</p>
    </Card>
  );
}

function LowStockCard({ item }: { item: InventoryWithProductOut }) {
  const { product, inventory } = item;
  return (
    <Card accent="tertiary">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body-lg text-on-surface truncate">{product.name}</p>
          {product.brand && (
            <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
          )}
        </div>
        <StatusBadge low />
      </div>
      <p className="mt-2 text-label-md text-on-surface-variant">
        {inventory.quantity} {inventory.unit} restante{inventory.quantity !== 1 ? "s" : ""}
      </p>
      <LevelBar quantity={inventory.quantity} max={inventory.threshold * 2} />
    </Card>
  );
}
```

- [ ] **Step 5: Create `frontend/src/screens/Pantry.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useInventory } from "@/hooks";
import { Card, StatusBadge, LevelBar, Spinner, ErrorState, EmptyState } from "@/components";

export function Pantry() {
  const { data, isLoading, isError, refetch } = useInventory();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const i of data ?? []) {
      seen.add(i.product.category ?? "Otros");
    }
    return [...seen].sort();
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((i) => {
      const matchesSearch =
        !search ||
        i.product.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.product.brand ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !activeCategory ||
        (i.product.category ?? "Otros") === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [data, search, activeCategory]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-stack-md pt-stack-md">
      <input
        role="searchbox"
        type="search"
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-label-md transition-colors ${
              !activeCategory
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container text-on-surface-variant"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`shrink-0 rounded-full px-3 py-1 text-label-md transition-colors ${
                activeCategory === cat
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (data?.length ?? 0) === 0 ? (
        <EmptyState
          message="Tu despensa está vacía. Escanea tu primer producto"
          icon="kitchen"
        />
      ) : filtered.length === 0 ? (
        <EmptyState message="Sin resultados" icon="search_off" />
      ) : (
        <div className="space-y-stack-sm">
          {filtered.map((item) => (
            <Card key={item.inventory.ean} accent={item.low ? "tertiary" : undefined}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body-lg text-on-surface truncate">{item.product.name}</p>
                  {item.product.brand && (
                    <p className="text-body-sm text-on-surface-variant">{item.product.brand}</p>
                  )}
                  {item.product.category && (
                    <span className="mt-1 inline-block rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant">
                      {item.product.category}
                    </span>
                  )}
                </div>
                <StatusBadge low={item.low} />
              </div>
              <div className="mt-3">
                <p className="text-label-md text-on-surface-variant mb-1">
                  {item.inventory.quantity} {item.inventory.unit}
                </p>
                <LevelBar quantity={item.inventory.quantity} max={item.inventory.threshold * 2} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/screens/Scan.tsx`**

The scanner is mounted on a ref from `useScanner`. When the camera is unavailable (`error !== null`), a manual EAN input is shown. Both paths feed the same resolve logic: 200 → navigate to detail, 404 → navigate to manual entry.

```tsx
import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useScanner } from "@/hooks";
import { apiClient } from "@/api/client";
import type { ApiError } from "@/api/client";

export function Scan() {
  const navigate = useNavigate();
  const [manualEan, setManualEan] = useState("");
  const resolving = useRef(false);

  const handleDetect = useCallback(
    async (ean: string) => {
      if (resolving.current) return;
      resolving.current = true;
      await resolveAndNavigate(ean, navigate);
      resolving.current = false;
    },
    [navigate]
  );

  const { ref, error: cameraError } = useScanner(handleDetect);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ean = manualEan.trim();
    if (!ean) return;
    await resolveAndNavigate(ean, navigate);
  }

  return (
    <div className="flex flex-col items-center gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Escanear producto</h1>

      {!cameraError ? (
        <div
          ref={ref}
          className="w-full max-w-sm aspect-square rounded-lg overflow-hidden bg-surface-container"
        />
      ) : null}

      <p className="text-body-sm text-on-surface-variant">
        {cameraError ? "Cámara no disponible — introduce el código manualmente" : "Apunta al código de barras"}
      </p>

      <form
        role="form"
        onSubmit={handleManualSubmit}
        className="flex w-full max-w-sm gap-2"
        aria-label="Introduir EAN manual"
      >
        <input
          type="text"
          value={manualEan}
          onChange={(e) => setManualEan(e.target.value)}
          placeholder="Código EAN"
          className="flex-1 rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="rounded-full bg-primary-container px-6 py-3 text-label-md text-on-primary-container"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}

async function resolveAndNavigate(ean: string, navigate: ReturnType<typeof useNavigate>) {
  try {
    await apiClient.get(`/api/resolve/${ean}`);
    navigate(`/scan/${ean}`);
  } catch (err) {
    if ((err as ApiError).status === 404) {
      navigate(`/scan/${ean}/manual`);
    }
    // 5xx: stay on page; user can retry
  }
}
```

- [ ] **Step 7: Create `frontend/src/screens/ProductDetail.tsx`**

```tsx
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useResolve, useInventory, usePatchInventory, useAddInventory, useDeleteInventory } from "@/hooks";
import { Card, Button, QuantityStepper, Spinner, ErrorState } from "@/components";

export function ProductDetail() {
  const { ean = "" } = useParams<{ ean: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading: productLoading, isError: productError } = useResolve(ean);
  const { data: inventory } = useInventory();

  const tracked = useMemo(
    () => (inventory ?? []).find((i) => i.inventory.ean === ean),
    [inventory, ean]
  );

  const initialQty = tracked?.inventory.quantity ?? 1;
  const [qty, setQty] = useState<number | null>(null);
  const currentQty = qty ?? initialQty;

  const patch = usePatchInventory();
  const add = useAddInventory();
  const remove = useDeleteInventory();

  if (productLoading) return <Spinner />;
  if (productError || !product) return <ErrorState onRetry={() => navigate(-1)} />;

  function handleUpdate() {
    if (tracked) {
      patch.mutate(
        { ean, data: { quantity: currentQty } },
        { onSuccess: () => navigate("/despensa") }
      );
    } else {
      add.mutate(
        { ean, quantity: currentQty, threshold: 2, unit: "units" },
        { onSuccess: () => navigate("/despensa") }
      );
    }
  }

  function handleDelete() {
    remove.mutate(ean, { onSuccess: () => navigate("/despensa") });
  }

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <Card>
        <div className="flex items-start gap-4">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-20 w-20 rounded-md object-contain bg-surface-container-low"
            />
          )}
          <div>
            <h1 className="text-headline-md text-on-surface">{product.name}</h1>
            {product.brand && (
              <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
            )}
            <span className="mt-1 inline-block rounded-full bg-primary-container px-2 py-0.5 text-label-md text-on-primary-container">
              {product.source === "manual" ? "Manual" : "Reconocido"}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <p className="text-label-md text-on-surface-variant mb-stack-sm">
          {tracked ? "Cantidad actual" : "Cantidad a añadir"}
        </p>
        <QuantityStepper value={currentQty} onChange={setQty} />
      </Card>

      <div className="flex flex-col gap-3">
        <Button onClick={handleUpdate} disabled={patch.isPending || add.isPending}>
          {tracked ? "Actualizar" : "Añadir a mi despensa"}
        </Button>
        {tracked && (
          <Button variant="ghost" onClick={handleDelete} disabled={remove.isPending}>
            Quitar de la despensa
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create `frontend/src/screens/ManualEntry.tsx`**

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useCreateProduct, useAddInventory } from "@/hooks";
import { Button } from "@/components";
import type { ProductCreate } from "@/types";

interface FormValues {
  ean: string;
  name: string;
  brand: string;
  quantity: string;
  threshold: string;
  unit: string;
}

export function ManualEntry() {
  const { ean: paramEan = "" } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const addInventory = useAddInventory();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { ean: paramEan, quantity: "1", threshold: "2", unit: "units" },
  });

  async function onSubmit(values: FormValues) {
    const productData: ProductCreate = {
      ean: values.ean,
      name: values.name,
      ...(values.brand ? { brand: values.brand } : {}),
    };

    await createProduct.mutateAsync(productData);
    await addInventory.mutateAsync({
      ean: values.ean,
      quantity: parseInt(values.quantity, 10),
      threshold: parseInt(values.threshold, 10),
      unit: values.unit || "units",
    });
    navigate("/despensa");
  }

  const isPending = createProduct.isPending || addInventory.isPending;

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Nuevo producto</h1>
      <p className="text-body-sm text-on-surface-variant">
        EAN no reconocido. Rellena los datos del producto.
      </p>

      <form role="form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="EAN" error={errors.ean?.message}>
          <input
            {...register("ean", { required: "Requerido" })}
            readOnly
            className="input-base"
          />
        </Field>

        <Field label="Nombre" error={errors.name?.message}>
          <input
            {...register("name", { required: "Requerido" })}
            aria-label="nombre"
            className="input-base"
          />
        </Field>

        <Field label="Marca (opcional)">
          <input {...register("brand")} className="input-base" />
        </Field>

        <Field label="Cantidad inicial">
          <input
            {...register("quantity", { required: true, min: 1 })}
            type="number"
            min={1}
            className="input-base"
          />
        </Field>

        <Field label="Umbral mínimo">
          <input
            {...register("threshold", { required: true, min: 1 })}
            type="number"
            min={1}
            className="input-base"
          />
        </Field>

        <Field label="Unidad">
          <input {...register("unit")} className="input-base" />
        </Field>

        {(createProduct.isError || addInventory.isError) && (
          <p className="text-body-sm text-error">
            Error al guardar. Inténtalo de nuevo.
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar producto"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      {children}
      {error && <p className="text-label-md text-error">{error}</p>}
    </div>
  );
}
```

Note: `ManualEntry` uses `react-hook-form`. Add it to package.json: `npm install react-hook-form` in the `frontend/` directory. The `input-base` class is a Tailwind utility shorthand defined in `tailwind.config.ts` (or inline as `rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary w-full`).

- [ ] **Step 9: Create `frontend/src/screens/Settings.tsx`**

```tsx
import { useTheme } from "@/theme";

export function Settings() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Ajustes</h1>

      <div className="flex items-center justify-between rounded-lg bg-surface-container p-4">
        <div>
          <p className="text-body-lg text-on-surface">Tema</p>
          <p className="text-body-sm text-on-surface-variant">
            {theme === "light" ? "Claro (Alimenda)" : "Oscuro (Dark Slate)"}
          </p>
        </div>
        <button
          aria-label="Cambiar tema"
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
        >
          <span className="material-symbols-outlined">
            {theme === "light" ? "dark_mode" : "light_mode"}
          </span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Create `frontend/src/screens/index.ts`**

```typescript
export { Dashboard } from "./Dashboard";
export { Pantry } from "./Pantry";
export { Scan } from "./Scan";
export { ProductDetail } from "./ProductDetail";
export { ManualEntry } from "./ManualEntry";
export { Settings } from "./Settings";
```

- [ ] **Step 11: Install react-hook-form**

Run: `cd frontend && npm install react-hook-form`
Expected: package added to `frontend/package.json` and `frontend/package-lock.json`.

- [ ] **Step 12: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/screens/screens.test.tsx`
Expected: all tests PASS.

- [ ] **Step 13: Verify typecheck**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/App.tsx frontend/src/screens/Dashboard.tsx frontend/src/screens/Pantry.tsx frontend/src/screens/Scan.tsx frontend/src/screens/ProductDetail.tsx frontend/src/screens/ManualEntry.tsx frontend/src/screens/Settings.tsx frontend/src/screens/index.ts frontend/src/screens/screens.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add screens — Dashboard, Pantry, Scan, ProductDetail, ManualEntry, Settings"
```

---

### Task 9: PWA completion

Verify and wire up the `vite-plugin-pwa` manifest so the app is installable and caches its shell. The plugin was added in Task 1; this task fills in the manifest details and validates the install flow.

**Files:**
- Modify: `frontend/vite.config.ts` (update VitePWA manifest entries)
- Modify: `frontend/index.html` (ensure `<meta name="theme-color">` and `<link rel="apple-touch-icon">` are present)

**Interfaces:**
- Consumes: `vite-plugin-pwa` already installed in Task 1
- Produces: installable PWA with a valid web app manifest, service worker in `autoUpdate` mode

- [ ] **Step 1: Update `frontend/vite.config.ts` — fill in manifest**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    https: true, // mkcert certificates loaded via plugin-basic-ssl or mkcert directly
    proxy: {
      "/api": {
        target: "https://localhost:8000",
        secure: false,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "homeStock",
        short_name: "homeStock",
        description: "Gestión de despensa doméstica",
        theme_color: "#006e2f",
        background_color: "#f7f9fb",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 2: Add icons placeholder directory**

Create `frontend/public/icons/.gitkeep`. Real icons (192×192 and 512×512 PNGs) are needed for full PWA install; the gitkeep marks the directory. Lighthouse will warn about missing icons but the app will still function.

Run: `mkdir -p frontend/public/icons && touch frontend/public/icons/.gitkeep`

- [ ] **Step 3: Verify `frontend/index.html` has PWA meta tags**

Ensure `frontend/index.html` contains at minimum:

```html
<meta name="theme-color" content="#006e2f" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

The `<link rel="manifest">` is injected automatically by `vite-plugin-pwa` during build; during dev it is served by the plugin's dev server integration. Add only the `theme-color` and `apple-touch-icon` meta/link tags if they are missing.

- [ ] **Step 4: Verify dev build produces a manifest**

Run: `cd frontend && npm run build`
Expected: `frontend/dist/manifest.webmanifest` is present, `frontend/dist/sw.js` is present, no build errors.

```bash
ls frontend/dist/manifest.webmanifest frontend/dist/sw.js
```

- [ ] **Step 5: Commit**

```bash
git add frontend/vite.config.ts frontend/index.html frontend/public/icons/.gitkeep
git commit -m "feat(frontend): complete PWA manifest and service worker registration"
```
