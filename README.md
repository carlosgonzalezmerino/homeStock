# homeStock

Barcode-driven household inventory for one home. Scan what you buy, keep track of what is
left in the pantry and in the freezer, and see what is running low.

- **Backend:** FastAPI + SQLModel, SQLite for development, MariaDB on the home server.
- **Frontend:** React 18 + Vite + Tailwind, installable as a PWA, used from a phone on the LAN.
- **Schema changes:** Alembic migrations. The app never creates tables by itself.

## What it does

| Area | Behaviour |
|---|---|
| Scanning | Reads EAN barcodes and Mercadona QR codes with the phone camera, or a code typed by hand. The camera only runs while you ask for it. |
| Product lookup | Local catalogue first, then the imported OpenFoodFacts subset. Unknown codes go to a manual form. Every hit is cached in the catalogue. |
| Stock | One stock row per product, with a quantity, an alert threshold, a unit and a location (pantry or freezer). Quantities accept decimals such as `0,5`. |
| Freezer | A freezer item can carry a drawer (1 to 4) and the date it was frozen. The pantry list shows how long ago, and flags anything past 6 months. |
| Notes | Free text per stock row, up to 500 characters. |
| Alerts | The dashboard lists what is low on stock. Each alert opens the product. |
| Shopping list | `/lista` lists what is low on stock, with how much to buy. Check items off while shopping and register the whole batch in one go. |
| Products without a barcode | "Añadir sin código" creates a product with a generated `CUSTOM-` code. |

### When is a product "low"?

| Quantity | Threshold | Low? |
|---|---|---|
| 0 | any | yes, nothing is left |
| 1 | 2 | yes, below the threshold |
| 2 | 2 | no, exactly at the threshold is not low |
| 0,5 | 0 | no, a threshold of 0 means "alert only when it runs out" |

The same rule is used by the stock list, the alerts and the shopping list.

### Known gaps

- A product can be in one location only. Having the same product in the pantry and in the
  freezer at once is not supported.
- Mercadona lookup is implemented and tested but **disabled** in `app/api/deps.py`, because
  deriving its product id from the EAN is unreliable.

## Quick start (development)

You need Python 3.11+, [uv](https://docs.astral.sh/uv/) and Node 20+.

```bash
uv sync
uv run alembic upgrade head                      # creates homestock.db
uv run uvicorn app.main:app --reload --port 8000

cd frontend
npm install
npm run dev                                      # https://localhost:5173, proxies /api to :8000
```

The development server uses a local HTTPS certificate (`vite-plugin-mkcert`) because browsers
only allow camera access on secure pages. See
[TLS for phone camera access](#tls-for-phone-camera-access-required).

## Project layout

```text
app/                  Backend
  api/                HTTP routers and dependency providers
  services/           Business rules (resolver, inventory, shopping list)
  repositories/       Database access, the only layer that queries
  sources/            Product sources: OpenFoodFacts table, Mercadona client
  models.py           SQLModel tables
  schemas.py          Request and response models, with validation
  migrations.py       Runs Alembic from Python
alembic/              Migration environment and revisions
scripts/              OpenFoodFacts import, SQLite to MariaDB copy, OpenAPI export, icon generator
tests/                Backend tests (unit, API, integration, migrations)
frontend/             React PWA (see frontend/README.md)
docs/                 Architecture, API, database, testing and feature specs
docker/               Static file server used by the image
```

## Configuration

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `DATABASE_URL` | backend, Alembic | `sqlite:///homestock.db` | SQLAlchemy URL of the database |
| `MERCADONA_BASE_URL` | Mercadona client | Mercadona product API | Only used if the source is enabled |
| `MERCADONA_TIMEOUT` | Mercadona client | `3.0` | Seconds to wait for Mercadona |
| `DB_PASSWORD`, `DB_ROOT_PASSWORD` | docker compose | none | MariaDB passwords. Copy `.env.example` to `.env` and change them |

## Database and migrations

The schema changes only through the Alembic revisions in `alembic/versions/`. The full guide,
including backups and rollbacks, is in [docs/DATABASE.md](docs/DATABASE.md). The essentials:

```bash
uv run alembic upgrade head          # new database, or apply pending revisions
```

A database created **before** migrations existed already has the `0001` tables. Back it up,
then mark it instead of re-creating anything:

```bash
DATABASE_URL=sqlite:///homestock.db uv run alembic stamp 0001
DATABASE_URL=sqlite:///homestock.db uv run alembic upgrade head
```

| Revision | What it does |
|---|---|
| `0001` | The original schema: `products`, `off_products`, `inventory_items` |
| `0002` | Adds `drawer`, `frozen_at` and `notes` to `inventory_items`. Nullable columns, no data changed |

## Import the OpenFoodFacts subset

Place the OpenFoodFacts export at `data/en.openfoodfacts.org.products.csv` (tab separated), then:

```bash
uv run python -m scripts.off_import --csv data/en.openfoodfacts.org.products.csv
```

Only products sold at Mercadona are kept, one row per EAN. The import rebuilds `off_products`
and never touches your catalogue or your stock. It applies the migrations first, so it works on
a new database too.

## Docker deployment

`docker-compose.yml` runs the app against its own MariaDB service, decoupled from the app
container. The MariaDB data directory is bind-mounted to `/mnt/d/homeStock` on the host so it
survives container recreation.

> `/mnt/d` is a WSL2 drvfs mount (Windows drive) without real Unix permissions or file
> locking, which InnoDB relies on. This is a known source of MariaDB start-up failures or
> corruption. It is kept by choice; switch to a named Docker volume if it becomes a problem.
> **Back up the database before every deploy** (see [docs/DATABASE.md](docs/DATABASE.md)).

```bash
cp .env.example .env        # set DB_PASSWORD and DB_ROOT_PASSWORD
docker compose up -d --build
```

The image runs `alembic upgrade head` before it starts the server, so new revisions are applied
on deploy. **An existing database must be stamped first** (see above), otherwise the container
tries to create tables that already exist and stops.

The app connects with `DATABASE_URL=mysql+pymysql://homestock:${DB_PASSWORD}@db:3306/homestock`
and waits for the `db` health check before starting.

### Copying an existing SQLite database into MariaDB

Run this from the host, against an **empty** MariaDB:

```bash
docker compose up -d db
uv run python -m scripts.migrate_to_mysql \
  --source sqlite:///homestock.db \
  --target mysql+pymysql://homestock:$DB_PASSWORD@localhost:3306/homestock
```

The script creates the target schema with the migrations, copies `products`, `off_products` and
`inventory_items` in that order, and never modifies the source. A source created before
revision `0002` is fine: the columns it lacks stay empty in the target. It always inserts, so
running it twice against the same target fails on duplicate keys.

It relies on the `3306:3306` port mapping in `docker-compose.yml`, which also publishes MariaDB
to your LAN. Remove that mapping afterwards if you do not want that.

## TLS for phone camera access (REQUIRED)

A phone browser only grants camera access over a **secure context** (HTTPS). A plain
`http://192.168.x.x` address does not work. Generate a locally trusted certificate with
`mkcert` and serve the app over TLS:

```bash
mkcert -install
mkcert 192.168.1.50 localhost        # use your server's LAN IP

uv run uvicorn app.main:app --host 0.0.0.0 --port 8443 \
  --ssl-keyfile ./192.168.1.50-key.pem \
  --ssl-certfile ./192.168.1.50.pem
```

Install and trust the mkcert **root CA** on the phone (copy `rootCA.pem` from
`$(mkcert -CAROOT)`), so the browser accepts the certificate. In the Docker setup Traefik
terminates TLS with the same kind of certificate.

## Tests and quality

```bash
uv run pytest                                     # backend tests
uv run pytest --cov=app --cov=scripts             # coverage, target 80%
uv run ruff check . && uv run ruff format --check .

cd frontend
npm run check                                     # type check, then the tests
npx vitest run --coverage                         # coverage, target 80%
```

The strategy, conventions and the evaluation of the existing tests are in
[docs/TESTING.md](docs/TESTING.md).

## Documentation

| Document | Content |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, data model, business rules, frontend structure |
| [docs/API.md](docs/API.md) | Every endpoint with its requests, responses and errors |
| [docs/DATABASE.md](docs/DATABASE.md) | Tables, migrations, backups and rollbacks |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy, conventions, coverage, known gaps |
| [frontend/README.md](frontend/README.md) | Frontend scripts, structure and conventions |
| [docs/openapi.json](docs/openapi.json) | Machine-readable API description. A test keeps it in sync |
| [docs/Features/v0.1/](docs/Features/v0.1/README.md) | Specs of the v0.1 iteration and the session log |
| [docs/Features/v0.2/](docs/Features/v0.2/README.md) | Specs of the v0.2 iteration. `docs/Features/version0.2.md` is the full catalogue of proposals |
| [docs/Features/v0.3/](docs/Features/v0.3/README.md) | Specs of the v0.3 iteration, on usability and friction. `docs/Features/version0.3.md` is the full catalogue, including the hardware options |
| [docs/superpowers/](docs/superpowers) | Earlier specs and plans, with notes where they are superseded |

## Conventions

Development follows the team's `DevelopStyle`: small methods, one responsibility each, docstrings
on everything public, no magic numbers, specific exceptions, tests named
`test_<method>_<scenario>_<expected_result>`. The file lives in the workspace at
`Trabajo/Desarrollo/DevelopStyle.md`. Specs come first: a feature is specified, reviewed, and
only then implemented.
