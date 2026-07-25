# homeStock — Backend

Barcode-driven household inventory. FastAPI + SQLModel over SQLite (local dev)
or MariaDB (docker-compose deployment).

## Setup

```bash
uv sync
```

## Run the API

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The DB (`homestock.db`) and tables are created automatically on startup.

## Docker deployment

`docker-compose.yml` runs the app against its own MariaDB service (`db`),
decoupled from the app container. Its datadir is bind-mounted to
`/mnt/d/homeStock` on the host so it survives container recreation.

> `/mnt/d` is a WSL2 drvfs mount (Windows drive) without real Unix
> permissions/file-locking, which InnoDB relies on — this is a known source of
> MariaDB startup failures or corruption. Kept as-is by choice; switch to a
> named Docker volume if that becomes a problem.

```bash
cp .env.example .env   # set DB_PASSWORD / DB_ROOT_PASSWORD
docker compose up -d --build
```

The app connects via `DATABASE_URL=mysql+pymysql://homestock:${DB_PASSWORD}@db:3306/homestock`
and waits for the `db` service's healthcheck before starting.

### Importing an existing SQLite DB

If you already have a filled-in `homestock.db` (products/inventory entered
locally) and want its data inside the MariaDB service:

```bash
docker compose up -d db   # make sure MariaDB is up first
uv run python -m scripts.migrate_to_mysql \
  --source sqlite:///homestock.db \
  --target mysql+pymysql://homestock:$DB_PASSWORD@localhost:3306/homestock
```

Copies `products`, `off_products`, then `inventory_items` (in that order, so
the `inventory_items.ean` foreign key is satisfied). It creates tables in the
target if missing but does not touch or delete anything in the source SQLite
file. Run it against an **empty** MariaDB database — it always inserts, so
re-running it against a target that already has rows will fail on duplicate
primary keys.

## Import the OpenFoodFacts subset (step 3 of resolution)

Place the OFF export at `data/en.openfoodfacts.org.products.csv` (tab-separated),
then:

```bash
uv run python -m scripts.off_import --csv data/en.openfoodfacts.org.products.csv
```

Re-runnable: it rebuilds only `off_products` and never touches your curated
`products` or `inventory`.

## Tests & linting

```bash
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

## TLS for phone camera access (REQUIRED)

A phone browser only grants camera access over a **secure context** (HTTPS);
a plain `http://192.168.x.x` address will not work. Generate a locally trusted
cert with `mkcert` and serve the API + frontend over TLS:

```bash
# on the home server (one-time)
brew install mkcert            # or your OS package manager
mkcert -install
mkcert 192.168.1.50 localhost  # use your server's LAN IP

# run uvicorn with the generated cert
uv run uvicorn app.main:app --host 0.0.0.0 --port 8443 \
  --ssl-keyfile ./192.168.1.50-key.pem \
  --ssl-certfile ./192.168.1.50.pem
```

Install/trust the mkcert **root CA** on the phone (transfer `rootCA.pem` from
`$(mkcert -CAROOT)` and trust it in the phone's settings) so the browser accepts
the LAN cert and enables the camera.

## Resolution pipeline

`GET /api/resolve/{ean}` tries, in order: local `products` → Mercadona
(best-effort) → local `off_products` → 404 (⇒ manual entry). Every external hit
is written back to `products`, so each EAN hits the network at most once.
