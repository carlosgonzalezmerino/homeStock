# Testing

This project follows the team's `DevelopStyle`: every public method has a test for the happy path,
the edge cases and the error cases; tests are independent and repeatable; coverage is at least 80%.

## Running the tests

```bash
# Backend
uv run pytest                                      # all tests
uv run pytest tests/integration -v                 # one folder
uv run pytest --cov=app --cov=scripts --cov-report=term-missing
uv run ruff check . && uv run ruff format --check .

# Frontend (from frontend/)
npm run check                                      # type check, then all tests
npm test                                           # tests only
npx vitest run src/screens/ProductDetail.test.tsx  # one file
npx vitest run --coverage
```

> **Run `npm run check`, not only `npm test`.** Vitest removes types before it runs, so it cannot
> see a TypeScript error. The contract test between the frontend types and the API relies on
> `tsc` to catch a missing field.

## What is tested at each level

| Level | Backend | Frontend |
|---|---|---|
| **Unit** | Models, schemas, services with an in-memory database, repositories, source clients with a fake HTTP transport, the import and copy scripts | Pure functions (`parse`, `format`, `stock`, `freezer`, `date`), components, hooks, the scanner class with doubles for the camera and the decoders |
| **Screen** | API routes through `TestClient` | One screen at a time with `msw` answering the network |
| **Integration** | `tests/integration/`: the real API over a database built by the **real migrations** | `src/AppRoutes.flow.test.tsx`: several screens wired together over an in-memory fake backend |
| **Contract** | `tests/test_openapi_contract.py`: `docs/openapi.json` must match the application | `src/contract.test.ts`: the TypeScript types must have the keys of the backend schemas |
| **Migrations** | `tests/migrations/`: apply, roll back and compare with the models | none |
| **Accessibility** | none | `src/a11y.forms.test.tsx`: every text field has an accessible name |

There are **151 backend tests** and **340 frontend tests**. Coverage: backend 98%, frontend 94%
(target 80%).

| Backend area | Tests | Frontend area | Tests |
|---|---|---|---|
| `api` | 47 | `screens` | 109 |
| `services` | 23 | `utils` | 76 |
| `scripts` | 23 | `components` | 49 |
| `repositories` | 21 | `hooks` | 33 |
| root (`db`, schemas, health, search, contract) | 18 | `scanner` | 26 |
| `migrations` | 7 | root (flows, contract, accessibility) | 24 |
| `sources` | 6 | `api` | 13 |
| `integration` | 6 | `location`, `theme` | 10 |

## Conventions

- **Names:** `test_<method>_<scenario>_<expected_result>`, for example
  `test_update_moved_out_of_freezer_clears_drawer_and_date`. A reader should know what broke from
  the name alone.
- **One idea per test**, and short: under 30 lines, like any other method.
- **Independent:** no shared mutable state and no order dependency. Each backend test builds its
  own database. Each frontend test starts with an empty `localStorage` (`src/test/setup.ts`) and a
  clean set of `msw` handlers.
- **Fixed time:** tests that depend on today's date replace `app.services.inventory.today`, or
  compare with `localIsoDate()` instead of a literal date.
- **Shared helpers, not copies:**
  - Backend: `tests/conftest.py` (`client`, `seed_product`), `tests/repositories/__init__.py` (the
    low-stock cases).
  - Frontend: `src/test/helpers.tsx` (`renderInApp` wraps the providers the app uses),
    `src/test/fixtures.ts`, `src/test/fakeBackend.ts` (an in-memory API for flow tests) and
    `src/scanner/testDoubles.ts`.
- **Both sides share the same cases** for the low-stock rule, so the backend and the frontend
  cannot silently disagree.

## Evaluation of the tests that existed

Reviewed on 2026-11-02, before adding new ones.

### What is solid

| Tests | Why they are worth keeping |
|---|---|
| Resolver, repositories, search, shopping list | They test behaviour through the public interface, cover the boundary (`quantity == threshold`) and are named by scenario. |
| `test_off_import` | Uses a real CSV fixture, covers duplicates, filtering, huge fields and idempotence. |
| Hooks (`hooks.test.tsx`) | Check what matters: which request is sent and which caches are invalidated, and that a 404 is not retried. |
| `client`, `endpoints` | Pin the URL and method of every call. |
| `ThemeProvider`, drafts, scanner | Behaviour with real edge cases (blocked storage, a user edit that must not be overwritten). |

### What was weak, and what was done

| Finding | Action |
|---|---|
| `types.test.ts` only built object literals. It checked nothing at runtime, because `tsc` already does that. | **Replaced** by `contract.test.ts`, which compares the types with the backend schemas. |
| The ZXing frame loop (used on iPhone) had **no test**. Only the native detector was covered. | Added `zxingPath.test.ts` with a mocked reader. |
| `scripts/migrate_to_mysql.py` had **0% coverage**. | Added `test_migrate_to_mysql.py`, including a source from before the last migration. |
| The API's 404 paths for edits and deletes, and an unknown `location`, were not covered. | Added `test_not_found_and_validation.py`. |
| Tests built the schema with `create_all`, so nothing checked that migrations and models agree. | Added `tests/migrations/` and `tests/integration/`, which use the real migrations. |
| `smoke.test.ts` and "Spinner renders without crashing" assert almost nothing. | Kept as cheap canaries. They are not counted as coverage of behaviour. |
| About 70 older frontend tests are named as sentences ("calls onChange with value + 1 on + click") instead of `test_<method>_<scenario>_<expected_result>`. | **Not renamed**, to avoid a large mechanical diff with no behaviour change. New and rewritten tests follow the convention. This is the one known deviation. |
| Backend names such as `test_patch_product` do not say the scenario. | Few and clear from context. Rename when touched. |

### Bugs the new tests found

Writing the tests for behaviour, not for lines, exposed real problems:

| Bug | Found by |
|---|---|
| `scripts/off_import.py` created every table with `create_all`, so a new database got tables with no migration version and the next deploy failed. | Reading the script while writing its test. |
| `migrate_to_mysql.py` read every model column and failed on a database from before `0002`. | `test_copy_table_source_without_new_columns_copies_the_shared_ones`. |
| A quantity of 12345 was shown as "12.345", which the editable field rejects when read back. | The round-trip test of `formatQuantity` and `parseDecimal`. |
| The EAN field of the manual form and the brand field of the custom form had no accessible name. | `a11y.forms.test.tsx`. |
| The PWA icons did not exist, and the manifest used the old colours. | Checking the build output while writing the docs. |

## Do the tests catch mistakes? (manual mutation check)

Coverage says which lines run, not whether a test would notice a wrong result. To check that, 18
behaviours were broken on purpose, one at a time, and the relevant tests were run. **17 of 18 were
caught.**

Examples that were caught: treating "exactly at the threshold" as low; dropping the `quantity == 0`
case; not setting the frozen date when moving into the freezer; not clearing the drawer when moving
out; accepting negative quantities; removing the duplicate-product `409`; giving a migration column
the wrong type; copying columns the source does not have; summing replaced instead of added;
opening unrecognised codes; running a creation twice; letting the stepper go below zero; adding a
thousands separator; decoding ZXing on every frame; not remembering the active location.

The one that "survived" Vitest, removing a field from a TypeScript type, is caught by `tsc`
(see the note above). Run `npm run check`.

To repeat the check, break one behaviour by hand and run the tests for that area.

## Known gaps and what to add next

| Gap | Suggested test | Why it is not there yet |
|---|---|---|
| Nothing runs the real browser | End-to-end tests with Playwright against the built app and a migrated SQLite database: scan by typing an EAN, add, edit, move to the freezer | Needs a browser in the environment, and the camera cannot be automated. |
| The camera on a phone | Manual checklist on an iPhone: it starts only when asked, stops on leaving and on going to the background | jsdom has no camera. The logic is unit tested, the device is not. |
| MariaDB is never tested | Run the migration and the API tests against a MariaDB container in CI | SQLite hides differences in types and `ALTER TABLE`. |
| Visual style | Screenshot comparison of the main screens in both themes | The style rules are checked by class, not by pixels. |
| Automatic accessibility rules | Add `axe` to the screen tests | Today only accessible names are checked. |
| Concurrency | Two clients adding the same product at once | The `409` is tested, the race is not. |
| Old test names | Rename to the convention | See above. |
