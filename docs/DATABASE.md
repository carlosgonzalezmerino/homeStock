# Database

SQLite in development (`homestock.db`) and MariaDB on the home server. The schema is defined by
the models in `app/models.py` and **changed only by Alembic migrations** in `alembic/versions/`.
The application does not create tables when it starts: run `alembic upgrade head` first.

## Tables

### `products`: the catalogue

One row per known EAN. It is the source of truth and the cache of external lookups.

| Column | Type | Notes |
|---|---|---|
| `ean` | text, primary key | The barcode, or `CUSTOM-XXXXXXXX` |
| `name` | text, required | |
| `brand`, `description`, `image_url`, `quantity_desc` | text, optional | |
| `category` | long text, optional | |
| `kcal_per_100g` ... `salt_per_100g` | float, optional | The eight nutrition values |
| `source` | text, required | `manual`, `openfoodfacts` or `mercadona` |
| `created_at`, `updated_at` | datetime | |

### `inventory_items`: the stock

One row per tracked product.

| Column | Type | Notes |
|---|---|---|
| `id` | integer, primary key | |
| `ean` | text, required | Foreign key to `products`, **unique**, indexed |
| `quantity` | float, required | `>= 0`, at most 2 decimals |
| `threshold` | float, required | `>= 0`. The item is low when `quantity == 0` or `quantity < threshold` |
| `unit` | text, required | Defaults to `units` |
| `location` | text, optional | `pantry`, `freezer` or `null` (the pantry) |
| `drawer` | integer, optional | 1 to 4. Only for freezer items. Added in `0002` |
| `frozen_at` | date, optional | Only for freezer items. Added in `0002` |
| `notes` | long text, optional | At most 500 characters. Added in `0002` |
| `created_at`, `updated_at` | datetime | |

### `off_products`: imported OpenFoodFacts subset

Same descriptive and nutrition columns as `products`, with `ean` as the indexed primary key.
It is dropped and rebuilt by `scripts/off_import.py`, and only read by the resolver.

### `alembic_version`

Created by Alembic. Holds the revision the database is at.

## Migrations

| Revision | File | What it does |
|---|---|---|
| `0001` | `0001_initial_schema.py` | The original three tables and their indexes |
| `0002` | `0002_freezer_fields.py` | Adds `drawer`, `frozen_at` and `notes`. Nullable. Nothing is backfilled, so a date is never invented for rows that existed before |

### Common commands

```bash
uv run alembic current               # which revision is this database at
uv run alembic upgrade head          # apply what is missing
uv run alembic history               # the list of revisions
DATABASE_URL=sqlite:///other.db uv run alembic upgrade head   # another database
```

`DATABASE_URL` selects the database. Without it, `sqlite:///homestock.db` is used.

### A database that already exists

A database created before migrations existed has the `0001` tables but no `alembic_version`.
**Never run `upgrade` on it directly:** revision `0001` would try to create tables that exist.
Mark it first:

1. Back it up (see below).
2. `alembic stamp 0001` records that it is at the original schema without changing anything.
3. `alembic upgrade head` applies the revisions after it.

The migration was rehearsed this way on a copy of the real database: the row counts and the
contents of every old column were identical before and after.

### Writing a new migration

1. Change the model in `app/models.py` and the schemas in `app/schemas.py`.
2. Create the revision: `uv run alembic revision -m "what it does"`. Fill `upgrade()` and
   `downgrade()` by hand. Prefer nullable columns, so existing rows stay valid.
3. `uv run pytest tests/migrations`. One test applies every revision to an empty database and
   compares the result with the models, so a missing or wrongly typed column fails there.
4. Rehearse it on a copy of the real data and compare row counts before and after.
5. Back up, then deploy. The container applies the revision when it starts.

Use `op.batch_alter_table` for changes to existing tables: SQLite cannot alter most things in
place, and the batch mode works on both databases.

### Rolling back

`alembic downgrade 0001` removes the freezer columns **and the data stored in them**. If the data
matters, restore the backup instead.

## Backups

Take one before every migration and every deploy.

```bash
# SQLite: copy the file while the app is stopped
cp homestock.db "homestock-$(date +%F).db"

# MariaDB
docker compose exec db mariadb-dump -u root -p"$DB_ROOT_PASSWORD" homestock > backup.sql
```

The MariaDB data directory is bind-mounted from `/mnt/d/homeStock`, a Windows drive mounted in
WSL2. It has no real Unix file locking, which InnoDB relies on, so corruption is possible. A
named Docker volume avoids the risk. Until then, backups are not optional.

## Other databases and scripts

- **`scripts/off_import.py`** applies the migrations to its database first, so it also works on a
  new one. It rebuilds only `off_products`.
- **`scripts/migrate_to_mysql.py`** creates the target schema with the migrations and copies the
  rows. It reads only the columns the source has, so a database from before `0002` can be copied.
  The target must be empty.
- **`app.db.create_db_and_tables`** builds the tables from the models **without** recording a
  revision. It exists for tests that need a throwaway database. Never use it on real data.
