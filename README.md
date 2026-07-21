# homeStock — Backend

Barcode-driven household inventory. FastAPI + SQLModel over SQLite.

## Setup

```bash
uv sync
```

## Run the API

```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The DB (`homestock.db`) and tables are created automatically on startup.

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
