# homeStock frontend

React 18 + TypeScript (strict) + Vite + Tailwind 3.4. An installable PWA that talks to the
FastAPI backend under `/api`. Read [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) first for
the whole picture.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on `https://localhost:5173` (local certificate). Proxies `/api` to `127.0.0.1:8000`. |
| `npm run build` | Type check and production build into `dist/`, with the service worker. |
| `npm test` | All tests, once. |
| `npm run lint` | TypeScript check only. |
| `npm run check` | Type check, then all tests. **Use this before you finish.** |
| `npx vitest run --coverage` | Tests with coverage (target 80%). |

## Structure

```text
src/
  AppRoutes.tsx        Route table, shared by the app and the flow tests
  App.tsx              Providers and the browser router
  api/                 The only code that calls fetch: client, endpoint modules, HTTP status names
  components/          Presentational pieces: Card, Button, QuantityStepper, SegmentedControl ...
  constants/           Named values (default threshold, drawers, note length)
  hooks/               TanStack Query hooks, the scanner hook, the product editor, small helpers
  location/            ActiveLocationProvider: the pantry or freezer the user is working in
  scanner/             BarcodeCameraScanner and the native detector setup
  screens/             One file per screen; screens/detail/ holds the pieces of the detail screen
  theme/               Light and dark theme provider
  utils/               Pure functions: parsing, formatting, stock status, freezer rules, dates
  test/                Setup, shared render helper, fixtures and the in-memory fake backend
  types.ts             TypeScript mirror of the API schemas (checked against docs/openapi.json)
```

Dependency direction: `screens` use `hooks` and `components`; `hooks` use `api` and `utils`;
`components` use only `utils` and `constants`. Components never call `fetch`.

## Conventions

- Follow `Trabajo/Desarrollo/DevelopStyle.md`: functions up to 30 lines, one responsibility each,
  a JSDoc with `@param` and `@returns` on everything exported, named constants instead of
  numbers, `try` blocks up to 7 lines.
- A component takes its props through a named `interface` that is documented.
- Server data goes through TanStack Query hooks. Writes invalidate `["inventory"]` and
  `["shopping-list"]`.
- Every `localStorage` access is inside a `try`, and failure only logs a warning.
- Text typed by the user stays as text until it is validated and parsed (`utils/parse.ts`).
  Numbers shown to the user go through `formatQuantity`.
- Colours come from the tokens in `src/index.css`. Do not write hexadecimal colours in components.
  Green is for actions, active states and live data only.
- Interface text is in Spanish. Code, comments and tests are in English.

## Tests

See [../docs/TESTING.md](../docs/TESTING.md). In short:

- Screens are tested with `renderInApp` (query client, active location and router) and `msw`.
- Flows that cross screens use `installFakeBackend`, a small in-memory API.
- `src/contract.test.ts` compares `types.ts` with `docs/openapi.json`. After a backend change,
  regenerate the file with `uv run python -m scripts.export_openapi` from the project root.
- Tests start with an empty `localStorage` and no leftover `msw` handlers.

## Known issues

- `npm audit` reports two moderate vulnerabilities in `react-router` 6. The fixed version is 7,
  which changes the API, so the upgrade is a task of its own. The app has no server-side
  rendering and builds its links from encoded codes, so the exposure on a home network is low.
- The shopping list endpoint has a hook (`useShoppingList`) but no screen.
