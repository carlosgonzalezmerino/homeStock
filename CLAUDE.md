# homeStock

Barcode-driven household inventory. FastAPI + SQLModel backend, React PWA frontend.
Start with `README.md`, then `docs/ARCHITECTURE.md`.

## Rules for working here

- **Follow the team style:** `../Trabajo/Desarrollo/DevelopStyle.md`. Specs first, then code.
  Functions up to 30 lines, `try` up to 7 lines, docstrings with Args and Returns on everything
  public, named constants, specific exceptions, no dependency injection beyond what exists.
- **Specs live in `docs/Features/`.** The v0.1 iteration is in `docs/Features/v0.1/`. Its
  `SESSION-2026-11-02.md` says how the last session ended and what is still open.
- **The schema changes only through Alembic.** Never use `create_all` on real data. Rehearse a
  migration on a copy first and keep a backup. See `docs/DATABASE.md`.
- **The API description is committed** (`docs/openapi.json`). After changing an endpoint or a
  schema run `uv run python -m scripts.export_openapi`.
- **Do not commit or push** unless asked. The working tree has many uncommitted changes.

## Commands

```bash
uv run alembic upgrade head
uv run pytest && uv run ruff check . && uv run ruff format --check .
cd frontend && npm run check          # type check + tests. Not only `npm test`.
```

- **If `uv run pytest` says `Failed to spawn: pytest`**, the scripts in `.venv/bin` have a shebang
  from the code-server container (`/config/workspace/...`). The interpreter works: use
  `.venv/bin/python -m pytest` and `.venv/bin/ruff`. Do not rebuild the venv for this.

## Things that are easy to get wrong

- **Every change of a quantity goes through `InventoryService`** (`update`, `adjust`, `start_tracking`,
  `stop_tracking`). It writes the diary (`stock_movements`). Going straight to `InventoryRepository`
  loses the history without any error. `scripts/check_movements.py` finds the gap.
- **`consume` (the scan mode that takes units out) is never remembered** between visits and is not
  drawn in the action green. Both are on purpose; see `docs/Features/v0.3/03-modo-consumir.md`.
- The ORM returns the same object it updates: read the *previous* value before calling the service.
- A screen that clears state and navigates in one click must persist **synchronously**, not from a
  `useEffect` (see `usePurchaseSession`).
- Tests never hard-code the head migration: use `app.migrations.head_revision()`.
- "Low stock" is `quantity == 0 or quantity < threshold`. Exactly at the threshold is not low.
  It is written in the backend (property and SQL) and mirrored in `computeStockStatus`.
  Change them together; both sides' tests share the cases.
- The detail screen has two modes: `/scan/:ean` (register a purchase) and `/despensa/:ean`
  (manage). It must wait for the inventory before it shows anything.
- A stock row exists once per EAN. A product cannot be in two locations.
- Mercadona lookup exists but is disabled in `app/api/deps.py`.
- `npm audit fix` can prune dev tools from `node_modules`. Restore with `npm ci`.
- Files created by an AI session may be owned by `root`. Change them to the project user.
