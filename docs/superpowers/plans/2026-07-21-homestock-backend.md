# homeStock Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI + SQLModel backend for homeStock: a barcode-driven household inventory with a 4-step EAN resolution pipeline, inventory CRUD, and a derived shopping list.

**Architecture:** Layered — Routers (HTTP only) → Services (business logic) → Repositories (all DB access). External product sources (Mercadona, OpenFoodFacts) sit behind a common `ProductSource` protocol so the resolver depends on the abstraction. SQLite is the single-file DB and the local `products` table is both source of truth and cache. Dependency injection via FastAPI `Depends` for DB sessions and services, so tests substitute fakes.

**Tech Stack:** Python 3.11+, FastAPI, SQLModel (SQLAlchemy), SQLite, Pydantic v2, httpx (Mercadona client), pytest + FastAPI `TestClient`, Ruff (lint + format). Managed with `uv`.

## Global Constraints

- **Python 3.11+**, dependency & venv management via `uv`.
- **Full type hints everywhere** (functions, methods, models). Not machine-checked (no mypy for now), but written comprehensively.
- **Pydantic models at every I/O boundary**; strict, explicit schemas. Bad input ⇒ 422 with field detail.
- **Ruff** for linting + formatting (replaces black/isort/flake8). No mypy / pre-commit for now.
- **TDD (red-green-refactor):** failing test first, make it pass, then refactor. Follow the Superpowers `test-driven-development` skill.
- **Layered architecture:** Routers → Services → Repositories. Routers contain no business logic; only repositories touch the DB.
- **Sources behind an interface:** `ProductSource` protocol `lookup(ean: str) -> ProductData | None`. Resolver depends on the abstraction.
- **External sources are best-effort:** timeouts on all network calls; any exception, non-200, or unparseable body ⇒ log and fall through. Never 500 on a bad external response.
- **`resolve` returns a clean 404** (not an error) when nothing found — normal signal for manual entry.
- **EAN is the natural key** throughout. `products.ean` is TEXT PK; `inventory_items.ean` is a UNIQUE FK.
- **REAL quantities** (allow 1.5 kg / half-units); default UX treats them as integers.
- **Shopping list is a query, not a table:** `WHERE quantity <= threshold` (`≤` includes equality).
- **OFF data file:** `data/en.openfoodfacts.org.products.csv` — **tab-separated** (TSV despite `.csv`), millions of rows; never load fully into memory. Relevant columns (0-based header names): `code`→`ean`, `product_name`→`name`, `brands`, `image_url`, `categories`, `quantity`→`quantity_desc`, `energy-kcal_100g`, `fat_100g`, `saturated-fat_100g`, `carbohydrates_100g`, `sugars_100g`, `fiber_100g`, `proteins_100g`, `salt_100g`.

## File Structure

```
homeStock/
├── pyproject.toml                      # uv project, deps, ruff config
├── app/
│   ├── __init__.py
│   ├── main.py                         # FastAPI app factory, router wiring
│   ├── db.py                           # engine, session, get_session dependency
│   ├── models.py                       # SQLModel tables: Product, InventoryItem, OffProduct
│   ├── schemas.py                      # Pydantic I/O models (requests/responses)
│   ├── sources/
│   │   ├── __init__.py
│   │   ├── base.py                     # ProductSource protocol + ProductData dataclass
│   │   ├── mercadona.py                # best-effort Mercadona client
│   │   └── openfoodfacts.py            # queries local off_products table
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── products.py                 # ProductRepository
│   │   ├── inventory.py                # InventoryRepository
│   │   └── off.py                      # OffProductRepository
│   ├── services/
│   │   ├── __init__.py
│   │   ├── resolver.py                 # ProductResolver: 4-step pipeline
│   │   ├── inventory.py                # InventoryService
│   │   └── shopping_list.py            # ShoppingListService
│   └── api/
│       ├── __init__.py
│       ├── deps.py                     # DI wiring for services/repos
│       ├── resolve.py                  # GET /api/resolve/{ean}
│       ├── products.py                 # products router
│       ├── inventory.py                # inventory router
│       └── shopping_list.py            # shopping-list router
├── scripts/
│   └── off_import.py                   # standalone, re-runnable OFF importer
└── tests/
    ├── conftest.py                     # temp-DB fixtures, TestClient, fakes
    ├── sources/test_mercadona.py
    ├── repositories/test_products.py
    ├── repositories/test_inventory.py
    ├── services/test_resolver.py
    ├── services/test_shopping_list.py
    ├── api/test_resolve.py
    ├── api/test_products.py
    ├── api/test_inventory.py
    ├── api/test_shopping_list.py
    └── scripts/test_off_import.py
```

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `pyproject.toml`
- Create: `app/__init__.py` (empty)
- Create: `app/main.py`
- Create: `tests/__init__.py` (empty)
- Test: `tests/test_health.py`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `app.main.create_app() -> FastAPI` — app factory used by every API test and by the ASGI entry point `app = create_app()`.

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "homestock"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "sqlmodel>=0.0.16",
    "httpx>=0.27",
    "uvicorn[standard]>=0.29",
]

[dependency-groups]
dev = [
    "pytest>=8.0",
    "ruff>=0.4",
]

[tool.ruff]
line-length = 88
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: Install deps**

Run: `uv sync`
Expected: creates `.venv` and `uv.lock`, installs fastapi/sqlmodel/httpx/pytest/ruff.

- [ ] **Step 3: Write the failing test**

`tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it fails**

Run: `uv run pytest tests/test_health.py -v`
Expected: FAIL — `ImportError` / `ModuleNotFoundError: No module named 'app.main'`.

- [ ] **Step 5: Write minimal implementation**

`app/main.py`:

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="homeStock")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

Create empty `app/__init__.py` and `tests/__init__.py`.

- [ ] **Step 6: Run test to verify it passes**

Run: `uv run pytest tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 7: Lint & format**

Run: `uv run ruff format . && uv run ruff check .`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold FastAPI project with health endpoint"
```

---

### Task 2: Database models & session

**Files:**
- Create: `app/db.py`
- Create: `app/models.py`
- Test: `tests/repositories/test_models.py`
- Create: `tests/repositories/__init__.py` (empty)

**Interfaces:**
- Consumes: nothing DB-specific yet.
- Produces:
  - `app.db.get_engine(url: str = DATABASE_URL) -> Engine`
  - `app.db.create_db_and_tables(engine: Engine) -> None`
  - `app.db.get_session() -> Iterator[Session]` — FastAPI dependency.
  - `app.models.Product` (table, PK `ean: str`), fields per spec incl. 8 nutrition floats, `source: str`, `created_at`/`updated_at: datetime`.
  - `app.models.InventoryItem` (table, `id: int` PK, `ean: str` UNIQUE FK, `quantity: float`, `threshold: float`, `unit: str = "units"`, `location: str | None`, timestamps).
  - `app.models.OffProduct` (table, PK `ean: str`, catalog columns + 8 nutrition floats).

- [ ] **Step 1: Write the failing test**

`tests/repositories/test_models.py`:

```python
from datetime import datetime

from sqlmodel import Session, select

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, Product


def test_product_and_inventory_roundtrip() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    with Session(engine) as session:
        session.add(
            Product(ean="123", name="Milk", source="manual", kcal_per_100g=42.0)
        )
        session.add(InventoryItem(ean="123", quantity=2, threshold=1, unit="L"))
        session.commit()

        product = session.exec(select(Product).where(Product.ean == "123")).one()
        item = session.exec(
            select(InventoryItem).where(InventoryItem.ean == "123")
        ).one()

    assert product.name == "Milk"
    assert product.source == "manual"
    assert isinstance(product.created_at, datetime)
    assert item.quantity == 2
    assert item.unit == "L"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/repositories/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.db'`.

- [ ] **Step 3: Write `app/db.py`**

```python
from collections.abc import Iterator

from sqlalchemy import Engine
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = "sqlite:///homestock.db"

_engine: Engine | None = None


def get_engine(url: str = DATABASE_URL) -> Engine:
    connect_args = {"check_same_thread": False}
    return create_engine(url, connect_args=connect_args)


def create_db_and_tables(engine: Engine) -> None:
    SQLModel.metadata.create_all(engine)


def set_engine(engine: Engine) -> None:
    global _engine
    _engine = engine


def get_session() -> Iterator[Session]:
    assert _engine is not None, "engine not initialized; call set_engine()"
    with Session(_engine) as session:
        yield session
```

- [ ] **Step 4: Write `app/models.py`**

```python
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Product(SQLModel, table=True):
    __tablename__ = "products"

    ean: str = Field(primary_key=True)
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None
    source: str
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class InventoryItem(SQLModel, table=True):
    __tablename__ = "inventory_items"

    id: int | None = Field(default=None, primary_key=True)
    ean: str = Field(foreign_key="products.ean", unique=True, index=True)
    quantity: float
    threshold: float
    unit: str = "units"
    location: str | None = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class OffProduct(SQLModel, table=True):
    __tablename__ = "off_products"

    ean: str = Field(primary_key=True, index=True)
    name: str
    brand: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/repositories/test_models.py -v`
Expected: PASS.

- [ ] **Step 6: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add SQLModel tables and session management"
```

---

### Task 3: Source interface & OFF source

**Files:**
- Create: `app/sources/__init__.py` (empty)
- Create: `app/sources/base.py`
- Create: `app/sources/openfoodfacts.py`
- Create: `app/repositories/__init__.py` (empty)
- Create: `app/repositories/off.py`
- Test: `tests/sources/test_openfoodfacts.py`
- Create: `tests/sources/__init__.py` (empty)

**Interfaces:**
- Consumes: `app.models.OffProduct`, `app.db` (Session).
- Produces:
  - `app.sources.base.ProductData` — frozen dataclass: `ean: str`, `name: str`, `brand: str | None`, `description: str | None`, `image_url: str | None`, `category: str | None`, `quantity_desc: str | None`, and the 8 nutrition floats (all `float | None`), plus `source: str`. All keyword args; every field except `ean`, `name`, `source` defaults to `None`.
  - `app.sources.base.ProductSource` — `typing.Protocol` with `name: str` and `lookup(ean: str) -> ProductData | None`.
  - `app.repositories.off.OffProductRepository(session: Session)` with `get(ean: str) -> OffProduct | None`.
  - `app.sources.openfoodfacts.OffSource(repo: OffProductRepository)` implementing `ProductSource`; `name = "openfoodfacts"`; `lookup` maps an `OffProduct` row to `ProductData(source="openfoodfacts")`.

- [ ] **Step 1: Write the failing test**

`tests/sources/test_openfoodfacts.py`:

```python
from sqlmodel import Session

from app.db import create_db_and_tables, get_engine
from app.models import OffProduct
from app.repositories.off import OffProductRepository
from app.sources.openfoodfacts import OffSource


def _seed() -> Session:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    session.add(OffProduct(ean="55", name="Beans", brand="ACME", kcal_per_100g=90.0))
    session.commit()
    return session


def test_off_source_hit_maps_to_product_data() -> None:
    session = _seed()
    source = OffSource(OffProductRepository(session))
    result = source.lookup("55")
    assert result is not None
    assert result.name == "Beans"
    assert result.brand == "ACME"
    assert result.kcal_per_100g == 90.0
    assert result.source == "openfoodfacts"


def test_off_source_miss_returns_none() -> None:
    session = _seed()
    source = OffSource(OffProductRepository(session))
    assert source.lookup("does-not-exist") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/sources/test_openfoodfacts.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.sources.base'`.

- [ ] **Step 3: Write `app/sources/base.py`**

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ProductData:
    ean: str
    name: str
    source: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None


class ProductSource(Protocol):
    name: str

    def lookup(self, ean: str) -> ProductData | None: ...
```

- [ ] **Step 4: Write `app/repositories/off.py`**

```python
from sqlmodel import Session, select

from app.models import OffProduct


class OffProductRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, ean: str) -> OffProduct | None:
        return self._session.exec(
            select(OffProduct).where(OffProduct.ean == ean)
        ).first()
```

- [ ] **Step 5: Write `app/sources/openfoodfacts.py`**

```python
from app.repositories.off import OffProductRepository
from app.sources.base import ProductData


class OffSource:
    name = "openfoodfacts"

    def __init__(self, repo: OffProductRepository) -> None:
        self._repo = repo

    def lookup(self, ean: str) -> ProductData | None:
        row = self._repo.get(ean)
        if row is None:
            return None
        return ProductData(
            ean=row.ean,
            name=row.name,
            source="openfoodfacts",
            brand=row.brand,
            image_url=row.image_url,
            category=row.category,
            quantity_desc=row.quantity_desc,
            kcal_per_100g=row.kcal_per_100g,
            fat_per_100g=row.fat_per_100g,
            saturated_fat_per_100g=row.saturated_fat_per_100g,
            carbs_per_100g=row.carbs_per_100g,
            sugars_per_100g=row.sugars_per_100g,
            fiber_per_100g=row.fiber_per_100g,
            proteins_per_100g=row.proteins_per_100g,
            salt_per_100g=row.salt_per_100g,
        )
```

- [ ] **Step 6: Run test to verify it passes**

Run: `uv run pytest tests/sources/test_openfoodfacts.py -v`
Expected: PASS.

- [ ] **Step 7: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add ProductSource protocol and OFF source"
```

---

### Task 4: Mercadona source (best-effort client)

**Files:**
- Create: `app/sources/mercadona.py`
- Test: `tests/sources/test_mercadona.py`

**Interfaces:**
- Consumes: `app.sources.base.ProductData`, `httpx`.
- Produces: `app.sources.mercadona.MercadonaSource(client: httpx.Client | None = None, timeout: float = 3.0)` implementing `ProductSource`; `name = "mercadona"`. `lookup(ean)` returns `ProductData(source="mercadona")` on a clean hit, else `None`. **Any** exception, non-200, or unparseable body ⇒ log at WARNING and return `None` (never raises).

- [ ] **Step 1: Write the failing tests**

`tests/sources/test_mercadona.py`:

```python
import httpx

from app.sources.mercadona import MercadonaSource


def _client(handler: httpx.MockTransport) -> httpx.Client:
    return httpx.Client(transport=handler)


def test_hit_returns_product_data() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "ean": "84001",
                "display_name": "Leche Hacendado",
                "brand": "Hacendado",
                "thumbnail": "http://img/leche.jpg",
                "nutrition_information": {"energy_kcal": 47.0},
            },
        )

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    result = source.lookup("84001")
    assert result is not None
    assert result.name == "Leche Hacendado"
    assert result.brand == "Hacendado"
    assert result.source == "mercadona"


def test_non_200_falls_through_to_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    assert source.lookup("84001") is None


def test_timeout_falls_through_to_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("boom")

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    assert source.lookup("84001") is None


def test_garbage_body_falls_through_to_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>not json</html>")

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    assert source.lookup("84001") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/sources/test_mercadona.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.sources.mercadona'`.

- [ ] **Step 3: Write `app/sources/mercadona.py`**

```python
import logging

import httpx

from app.sources.base import ProductData

logger = logging.getLogger(__name__)

# NOTE: exact endpoint shape is best-effort and must be verified during
# implementation (see spec "Open Implementation Notes"). On ANY failure we
# fall through — so an inexact URL degrades to "miss", never a crash.
_BASE_URL = "https://tienda.mercadona.es/api/products/{ean}"


class MercadonaSource:
    name = "mercadona"

    def __init__(
        self, client: httpx.Client | None = None, timeout: float = 3.0
    ) -> None:
        self._client = client or httpx.Client(timeout=timeout)

    def lookup(self, ean: str) -> ProductData | None:
        try:
            response = self._client.get(_BASE_URL.format(ean=ean))
            if response.status_code != 200:
                logger.warning("mercadona non-200 for %s: %s", ean, response.status_code)
                return None
            body = response.json()
            name = body["display_name"]
        except Exception as exc:  # best-effort: never propagate
            logger.warning("mercadona lookup failed for %s: %s", ean, exc)
            return None

        nutrition = body.get("nutrition_information") or {}
        return ProductData(
            ean=ean,
            name=name,
            source="mercadona",
            brand=body.get("brand"),
            image_url=body.get("thumbnail"),
            category=body.get("category"),
            quantity_desc=body.get("packaging"),
            kcal_per_100g=nutrition.get("energy_kcal"),
            fat_per_100g=nutrition.get("total_fat"),
            saturated_fat_per_100g=nutrition.get("saturated_fat"),
            carbs_per_100g=nutrition.get("carbohydrates"),
            sugars_per_100g=nutrition.get("total_sugars"),
            fiber_per_100g=nutrition.get("dietary_fiber"),
            proteins_per_100g=nutrition.get("proteins"),
            salt_per_100g=nutrition.get("salt"),
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/sources/test_mercadona.py -v`
Expected: PASS (all four).

- [ ] **Step 5: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add best-effort Mercadona source client"
```

---

### Task 5: Product & inventory repositories

**Files:**
- Create: `app/repositories/products.py`
- Create: `app/repositories/inventory.py`
- Test: `tests/repositories/test_products.py`
- Test: `tests/repositories/test_inventory.py`

**Interfaces:**
- Consumes: `app.models.Product`, `app.models.InventoryItem`, `app.sources.base.ProductData`.
- Produces:
  - `app.repositories.products.ProductRepository(session)`:
    - `get(ean: str) -> Product | None`
    - `upsert_from_source(data: ProductData) -> Product` — insert or update by EAN; sets `source` from `data.source`; bumps `updated_at`.
    - `create(product: Product) -> Product`
    - `update_fields(ean: str, fields: dict[str, object]) -> Product | None` — patch given columns, bump `updated_at`.
  - `app.repositories.inventory.InventoryRepository(session)`:
    - `get(ean: str) -> InventoryItem | None`
    - `list_all() -> list[InventoryItem]`
    - `list_low() -> list[InventoryItem]` — `quantity <= threshold`.
    - `create(item: InventoryItem) -> InventoryItem`
    - `update_fields(ean: str, fields: dict[str, object]) -> InventoryItem | None`
    - `delete(ean: str) -> bool`

- [ ] **Step 1: Write the failing tests**

`tests/repositories/test_products.py`:

```python
from sqlmodel import Session

from app.db import create_db_and_tables, get_engine
from app.models import Product
from app.repositories.products import ProductRepository
from app.sources.base import ProductData


def _repo() -> ProductRepository:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    return ProductRepository(Session(engine))


def test_upsert_inserts_then_updates() -> None:
    repo = _repo()
    repo.upsert_from_source(ProductData(ean="1", name="Old", source="mercadona"))
    updated = repo.upsert_from_source(
        ProductData(ean="1", name="New", source="openfoodfacts")
    )
    assert updated.name == "New"
    assert updated.source == "openfoodfacts"
    assert repo.get("1").name == "New"


def test_update_fields_patches_only_given() -> None:
    repo = _repo()
    repo.create(Product(ean="9", name="Keep", brand="B", source="manual"))
    result = repo.update_fields("9", {"name": "Renamed"})
    assert result.name == "Renamed"
    assert result.brand == "B"


def test_update_fields_missing_returns_none() -> None:
    repo = _repo()
    assert repo.update_fields("nope", {"name": "x"}) is None
```

`tests/repositories/test_inventory.py`:

```python
from sqlmodel import Session

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository


def _repo_with_products() -> InventoryRepository:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    for ean in ("a", "b", "c"):
        session.add(Product(ean=ean, name=ean.upper(), source="manual"))
    session.commit()
    return InventoryRepository(session)


def test_list_low_uses_less_than_or_equal() -> None:
    repo = _repo_with_products()
    repo.create(InventoryItem(ean="a", quantity=5, threshold=2))   # ok
    repo.create(InventoryItem(ean="b", quantity=2, threshold=2))   # low (==)
    repo.create(InventoryItem(ean="c", quantity=1, threshold=2))   # low (<)
    low_eans = {item.ean for item in repo.list_low()}
    assert low_eans == {"b", "c"}


def test_delete_removes_row() -> None:
    repo = _repo_with_products()
    repo.create(InventoryItem(ean="a", quantity=1, threshold=1))
    assert repo.delete("a") is True
    assert repo.get("a") is None
    assert repo.delete("a") is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/repositories/test_products.py tests/repositories/test_inventory.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.repositories.products'`.

- [ ] **Step 3: Write `app/repositories/products.py`**

```python
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import Product
from app.sources.base import ProductData

_CATALOG_FIELDS = (
    "name", "brand", "description", "image_url", "category", "quantity_desc",
    "kcal_per_100g", "fat_per_100g", "saturated_fat_per_100g", "carbs_per_100g",
    "sugars_per_100g", "fiber_per_100g", "proteins_per_100g", "salt_per_100g",
)


class ProductRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, ean: str) -> Product | None:
        return self._session.exec(
            select(Product).where(Product.ean == ean)
        ).first()

    def create(self, product: Product) -> Product:
        self._session.add(product)
        self._session.commit()
        self._session.refresh(product)
        return product

    def upsert_from_source(self, data: ProductData) -> Product:
        product = self.get(data.ean)
        if product is None:
            product = Product(ean=data.ean, name=data.name, source=data.source)
        for field in _CATALOG_FIELDS:
            setattr(product, field, getattr(data, field))
        product.source = data.source
        product.updated_at = datetime.now(timezone.utc)
        self._session.add(product)
        self._session.commit()
        self._session.refresh(product)
        return product

    def update_fields(self, ean: str, fields: dict[str, object]) -> Product | None:
        product = self.get(ean)
        if product is None:
            return None
        for key, value in fields.items():
            setattr(product, key, value)
        product.updated_at = datetime.now(timezone.utc)
        self._session.add(product)
        self._session.commit()
        self._session.refresh(product)
        return product
```

- [ ] **Step 4: Write `app/repositories/inventory.py`**

```python
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import InventoryItem


class InventoryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, ean: str) -> InventoryItem | None:
        return self._session.exec(
            select(InventoryItem).where(InventoryItem.ean == ean)
        ).first()

    def list_all(self) -> list[InventoryItem]:
        return list(self._session.exec(select(InventoryItem)).all())

    def list_low(self) -> list[InventoryItem]:
        return list(
            self._session.exec(
                select(InventoryItem).where(
                    InventoryItem.quantity <= InventoryItem.threshold
                )
            ).all()
        )

    def create(self, item: InventoryItem) -> InventoryItem:
        self._session.add(item)
        self._session.commit()
        self._session.refresh(item)
        return item

    def update_fields(
        self, ean: str, fields: dict[str, object]
    ) -> InventoryItem | None:
        item = self.get(ean)
        if item is None:
            return None
        for key, value in fields.items():
            setattr(item, key, value)
        item.updated_at = datetime.now(timezone.utc)
        self._session.add(item)
        self._session.commit()
        self._session.refresh(item)
        return item

    def delete(self, ean: str) -> bool:
        item = self.get(ean)
        if item is None:
            return False
        self._session.delete(item)
        self._session.commit()
        return True
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/repositories/ -v`
Expected: PASS.

- [ ] **Step 6: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add product and inventory repositories"
```

---

### Task 6: Product resolver pipeline (the core)

**Files:**
- Create: `app/services/__init__.py` (empty)
- Create: `app/services/resolver.py`
- Test: `tests/services/test_resolver.py`
- Create: `tests/services/__init__.py` (empty)

**Interfaces:**
- Consumes: `app.repositories.products.ProductRepository`, `app.sources.base.ProductSource`, `app.models.Product`.
- Produces: `app.services.resolver.ProductResolver(products: ProductRepository, sources: list[ProductSource])`. Method `resolve(ean: str) -> Product | None`:
  1. If `products.get(ean)` hits → return it (no source calls, no write-back).
  2. Else try each source in order; first non-`None` `ProductData` → `products.upsert_from_source(data)` → return the persisted `Product`.
  3. All miss → return `None`.
  Sources are passed in resolution order (Mercadona then OFF); resolver does not know their concrete types.

- [ ] **Step 1: Write the failing tests**

`tests/services/test_resolver.py`:

```python
from app.models import Product
from app.services.resolver import ProductResolver
from app.sources.base import ProductData


class FakeProductRepo:
    def __init__(self, existing: dict[str, Product] | None = None) -> None:
        self.store = existing or {}
        self.upserts: list[ProductData] = []

    def get(self, ean: str) -> Product | None:
        return self.store.get(ean)

    def upsert_from_source(self, data: ProductData) -> Product:
        self.upserts.append(data)
        product = Product(ean=data.ean, name=data.name, source=data.source)
        self.store[data.ean] = product
        return product


class FakeSource:
    def __init__(self, name: str, result: ProductData | None) -> None:
        self.name = name
        self._result = result
        self.calls: list[str] = []

    def lookup(self, ean: str) -> ProductData | None:
        self.calls.append(ean)
        return self._result


def test_local_hit_skips_sources() -> None:
    repo = FakeProductRepo({"1": Product(ean="1", name="Local", source="manual")})
    merc = FakeSource("mercadona", None)
    resolver = ProductResolver(repo, [merc])
    result = resolver.resolve("1")
    assert result.name == "Local"
    assert merc.calls == []          # never queried a source
    assert repo.upserts == []        # no write-back


def test_first_source_hit_writes_back_and_stops() -> None:
    repo = FakeProductRepo()
    merc = FakeSource("mercadona", ProductData(ean="2", name="M", source="mercadona"))
    off = FakeSource("openfoodfacts", ProductData(ean="2", name="O", source="openfoodfacts"))
    resolver = ProductResolver(repo, [merc, off])
    result = resolver.resolve("2")
    assert result.name == "M"
    assert result.source == "mercadona"
    assert off.calls == []           # short-circuited before OFF
    assert len(repo.upserts) == 1    # written back once


def test_falls_through_to_second_source() -> None:
    repo = FakeProductRepo()
    merc = FakeSource("mercadona", None)
    off = FakeSource("openfoodfacts", ProductData(ean="3", name="O", source="openfoodfacts"))
    resolver = ProductResolver(repo, [merc, off])
    result = resolver.resolve("3")
    assert result.source == "openfoodfacts"
    assert merc.calls == ["3"] and off.calls == ["3"]


def test_all_miss_returns_none() -> None:
    repo = FakeProductRepo()
    resolver = ProductResolver(repo, [FakeSource("m", None), FakeSource("o", None)])
    assert resolver.resolve("404") is None
    assert repo.upserts == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/services/test_resolver.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.resolver'`.

- [ ] **Step 3: Write `app/services/resolver.py`**

```python
import logging

from app.models import Product
from app.repositories.products import ProductRepository
from app.sources.base import ProductSource

logger = logging.getLogger(__name__)


class ProductResolver:
    def __init__(
        self, products: ProductRepository, sources: list[ProductSource]
    ) -> None:
        self._products = products
        self._sources = sources

    def resolve(self, ean: str) -> Product | None:
        local = self._products.get(ean)
        if local is not None:
            return local

        for source in self._sources:
            data = source.lookup(ean)
            if data is not None:
                logger.info("resolved %s via %s", ean, source.name)
                return self._products.upsert_from_source(data)

        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest tests/services/test_resolver.py -v`
Expected: PASS (all four).

- [ ] **Step 5: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add product resolver pipeline"
```

---

### Task 7: Inventory & shopping-list services

**Files:**
- Create: `app/services/inventory.py`
- Create: `app/services/shopping_list.py`
- Test: `tests/services/test_inventory.py`
- Test: `tests/services/test_shopping_list.py`

**Interfaces:**
- Consumes: `app.repositories.inventory.InventoryRepository`, `app.repositories.products.ProductRepository`, `app.models.InventoryItem`, `app.models.Product`.
- Produces:
  - `app.services.inventory.InventoryService(inventory: InventoryRepository, products: ProductRepository)`:
    - `list_items(low_only: bool = False) -> list[tuple[InventoryItem, Product]]` — joins each item to its product.
    - `start_tracking(ean, quantity, threshold, unit, location) -> InventoryItem` — raises `ProductNotFoundError` if the EAN has no product row; raises `AlreadyTrackedError` if already tracked.
    - `update(ean, fields: dict) -> InventoryItem | None`.
    - `stop_tracking(ean) -> bool`.
  - `app.services.inventory.ProductNotFoundError`, `app.services.inventory.AlreadyTrackedError` (both subclass `Exception`).
  - `app.services.shopping_list.ShoppingListService(inventory: InventoryRepository, products: ProductRepository)` with `items() -> list[tuple[InventoryItem, Product]]` — the low items joined to product info.

- [ ] **Step 1: Write the failing tests**

`tests/services/test_inventory.py`:

```python
import pytest
from sqlmodel import Session

from app.db import create_db_and_tables, get_engine
from app.models import Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository
from app.services.inventory import (
    AlreadyTrackedError,
    InventoryService,
    ProductNotFoundError,
)


def _service() -> InventoryService:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    session.add(Product(ean="p", name="Prod", source="manual"))
    session.commit()
    return InventoryService(InventoryRepository(session), ProductRepository(session))


def test_start_tracking_creates_item() -> None:
    service = _service()
    item = service.start_tracking("p", quantity=3, threshold=1, unit="units", location=None)
    assert item.ean == "p"
    assert item.quantity == 3


def test_start_tracking_unknown_product_raises() -> None:
    service = _service()
    with pytest.raises(ProductNotFoundError):
        service.start_tracking("ghost", quantity=1, threshold=1, unit="units", location=None)


def test_start_tracking_twice_raises() -> None:
    service = _service()
    service.start_tracking("p", quantity=1, threshold=1, unit="units", location=None)
    with pytest.raises(AlreadyTrackedError):
        service.start_tracking("p", quantity=2, threshold=1, unit="units", location=None)


def test_list_items_joins_product() -> None:
    service = _service()
    service.start_tracking("p", quantity=1, threshold=1, unit="units", location=None)
    rows = service.list_items()
    assert len(rows) == 1
    item, product = rows[0]
    assert product.name == "Prod"
```

`tests/services/test_shopping_list.py`:

```python
from sqlmodel import Session

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository
from app.services.shopping_list import ShoppingListService


def test_shopping_list_returns_only_low_with_product_info() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    session.add(Product(ean="milk", name="Milk", source="manual"))
    session.add(Product(ean="eggs", name="Eggs", source="manual"))
    session.add(InventoryItem(ean="milk", quantity=1, threshold=2))  # low
    session.add(InventoryItem(ean="eggs", quantity=9, threshold=2))  # ok
    session.commit()

    service = ShoppingListService(
        InventoryRepository(session), ProductRepository(session)
    )
    rows = service.items()
    assert len(rows) == 1
    item, product = rows[0]
    assert product.name == "Milk"
    assert item.quantity == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest tests/services/test_inventory.py tests/services/test_shopping_list.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.inventory'`.

- [ ] **Step 3: Write `app/services/inventory.py`**

```python
from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository


class ProductNotFoundError(Exception):
    """Raised when tracking an EAN with no catalog row."""


class AlreadyTrackedError(Exception):
    """Raised when an EAN is already tracked in inventory."""


class InventoryService:
    def __init__(
        self, inventory: InventoryRepository, products: ProductRepository
    ) -> None:
        self._inventory = inventory
        self._products = products

    def list_items(
        self, low_only: bool = False
    ) -> list[tuple[InventoryItem, Product]]:
        items = (
            self._inventory.list_low() if low_only else self._inventory.list_all()
        )
        result: list[tuple[InventoryItem, Product]] = []
        for item in items:
            product = self._products.get(item.ean)
            if product is not None:
                result.append((item, product))
        return result

    def start_tracking(
        self,
        ean: str,
        quantity: float,
        threshold: float,
        unit: str,
        location: str | None,
    ) -> InventoryItem:
        if self._products.get(ean) is None:
            raise ProductNotFoundError(ean)
        if self._inventory.get(ean) is not None:
            raise AlreadyTrackedError(ean)
        return self._inventory.create(
            InventoryItem(
                ean=ean,
                quantity=quantity,
                threshold=threshold,
                unit=unit,
                location=location,
            )
        )

    def update(self, ean: str, fields: dict[str, object]) -> InventoryItem | None:
        return self._inventory.update_fields(ean, fields)

    def stop_tracking(self, ean: str) -> bool:
        return self._inventory.delete(ean)
```

- [ ] **Step 4: Write `app/services/shopping_list.py`**

```python
from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository


class ShoppingListService:
    def __init__(
        self, inventory: InventoryRepository, products: ProductRepository
    ) -> None:
        self._inventory = inventory
        self._products = products

    def items(self) -> list[tuple[InventoryItem, Product]]:
        result: list[tuple[InventoryItem, Product]] = []
        for item in self._inventory.list_low():
            product = self._products.get(item.ean)
            if product is not None:
                result.append((item, product))
        return result
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/services/ -v`
Expected: PASS.

- [ ] **Step 6: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add inventory and shopping-list services"
```

---

### Task 8: Pydantic schemas & DI wiring

**Files:**
- Create: `app/schemas.py`
- Create: `app/api/__init__.py` (empty)
- Create: `app/api/deps.py`
- Test: `tests/test_schemas.py`

**Interfaces:**
- Consumes: `app.db`, all repositories, `ProductResolver`, `InventoryService`, `ShoppingListService`, `MercadonaSource`, `OffSource`.
- Produces:
  - `app.schemas` Pydantic models: `ProductOut`, `ProductCreate`, `ProductPatch`, `InventoryCreate`, `InventoryPatch`, `InventoryOut`, `ShoppingListItemOut`, `EanNotFound`. All use `model_config = ConfigDict(from_attributes=True)` where read from ORM rows. `ProductPatch`/`InventoryPatch` fields all `Optional` with default `None` (partial update).
  - `app.api.deps` FastAPI dependency providers: `get_product_repo`, `get_inventory_repo`, `get_off_repo`, `get_resolver`, `get_inventory_service`, `get_shopping_list_service` — each `Depends(get_session)` and composes the layers.

- [ ] **Step 1: Write the failing test**

`tests/test_schemas.py`:

```python
from app.models import InventoryItem, Product
from app.schemas import InventoryOut, ProductOut, ProductPatch


def test_product_out_reads_from_orm() -> None:
    product = Product(ean="1", name="Milk", source="manual", kcal_per_100g=42.0)
    out = ProductOut.model_validate(product)
    assert out.ean == "1"
    assert out.kcal_per_100g == 42.0


def test_product_patch_all_optional() -> None:
    patch = ProductPatch()
    assert patch.model_dump(exclude_unset=True) == {}


def test_inventory_out_reads_from_orm() -> None:
    item = InventoryItem(ean="1", quantity=2, threshold=1, unit="L")
    out = InventoryOut.model_validate(item)
    assert out.quantity == 2
    assert out.unit == "L"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas'`.

- [ ] **Step 3: Write `app/schemas.py`**

```python
from pydantic import BaseModel, ConfigDict


class _NutritionMixin(BaseModel):
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None


class ProductOut(_NutritionMixin):
    model_config = ConfigDict(from_attributes=True)

    ean: str
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None
    source: str


class ProductCreate(_NutritionMixin):
    ean: str
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None


class ProductPatch(_NutritionMixin):
    name: str | None = None
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None


class InventoryCreate(BaseModel):
    ean: str
    quantity: float
    threshold: float
    unit: str = "units"
    location: str | None = None


class InventoryPatch(BaseModel):
    quantity: float | None = None
    threshold: float | None = None
    unit: str | None = None
    location: str | None = None


class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ean: str
    quantity: float
    threshold: float
    unit: str
    location: str | None = None


class InventoryWithProductOut(BaseModel):
    inventory: InventoryOut
    product: ProductOut
    low: bool


class ShoppingListItemOut(BaseModel):
    ean: str
    name: str
    quantity: float
    threshold: float
    unit: str
    image_url: str | None = None


class EanNotFound(BaseModel):
    ean: str
```

- [ ] **Step 4: Write `app/api/deps.py`**

```python
from collections.abc import Iterator

from fastapi import Depends
from sqlmodel import Session

from app.db import get_session
from app.repositories.inventory import InventoryRepository
from app.repositories.off import OffProductRepository
from app.repositories.products import ProductRepository
from app.services.inventory import InventoryService
from app.services.resolver import ProductResolver
from app.services.shopping_list import ShoppingListService
from app.sources.mercadona import MercadonaSource
from app.sources.openfoodfacts import OffSource


def get_product_repo(session: Session = Depends(get_session)) -> ProductRepository:
    return ProductRepository(session)


def get_inventory_repo(
    session: Session = Depends(get_session),
) -> InventoryRepository:
    return InventoryRepository(session)


def get_off_repo(session: Session = Depends(get_session)) -> OffProductRepository:
    return OffProductRepository(session)


def get_resolver(
    products: ProductRepository = Depends(get_product_repo),
    off_repo: OffProductRepository = Depends(get_off_repo),
) -> ProductResolver:
    sources = [MercadonaSource(), OffSource(off_repo)]
    return ProductResolver(products, sources)


def get_inventory_service(
    inventory: InventoryRepository = Depends(get_inventory_repo),
    products: ProductRepository = Depends(get_product_repo),
) -> InventoryService:
    return InventoryService(inventory, products)


def get_shopping_list_service(
    inventory: InventoryRepository = Depends(get_inventory_repo),
    products: ProductRepository = Depends(get_product_repo),
) -> ShoppingListService:
    return ShoppingListService(inventory, products)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/test_schemas.py -v`
Expected: PASS.

- [ ] **Step 6: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add Pydantic schemas and DI wiring"
```

---

### Task 9: API routers & test harness

**Files:**
- Create: `tests/conftest.py`
- Create: `tests/api/__init__.py` (empty)
- Create: `app/api/resolve.py`
- Create: `app/api/products.py`
- Create: `app/api/inventory.py`
- Create: `app/api/shopping_list.py`
- Modify: `app/main.py` (wire routers + create tables on startup)
- Test: `tests/api/test_resolve.py`
- Test: `tests/api/test_products.py`
- Test: `tests/api/test_inventory.py`
- Test: `tests/api/test_shopping_list.py`

**Interfaces:**
- Consumes: `app.api.deps.*`, `app.schemas.*`, services.
- Produces:
  - `tests/conftest.py`: `client` fixture — builds an in-memory (or temp-file) SQLite engine, `set_engine`, `create_db_and_tables`, overrides `MercadonaSource` in `get_resolver` with a fake that always misses (so tests are deterministic/offline), returns a `TestClient`. Also exports a `seed_product` helper fixture.
  - Routers, each with `prefix="/api"`:
    - `resolve.router`: `GET /api/resolve/{ean}` → `ProductOut` or `404 EanNotFound`.
    - `products.router`: `POST /api/products` (201 `ProductOut`), `GET /api/products/{ean}` (`ProductOut`/404), `PATCH /api/products/{ean}` (`ProductOut`/404).
    - `inventory.router`: `GET /api/inventory?low=false` (`list[InventoryWithProductOut]`), `POST /api/inventory` (201/404 unknown product/409 already tracked), `PATCH /api/inventory/{ean}` (`InventoryOut`/404), `DELETE /api/inventory/{ean}` (204/404).
    - `shopping_list.router`: `GET /api/shopping-list` → `list[ShoppingListItemOut]`.

- [ ] **Step 1: Write `tests/conftest.py`**

```python
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import db as db_module
from app.api.deps import get_resolver
from app.db import create_db_and_tables, get_engine, set_engine
from app.models import Product
from app.repositories.off import OffProductRepository
from app.repositories.products import ProductRepository
from app.services.resolver import ProductResolver
from app.sources.openfoodfacts import OffSource


class _MissingSource:
    name = "fake-mercadona"

    def lookup(self, ean: str):  # always miss → deterministic offline tests
        return None


@pytest.fixture
def client() -> Iterator[TestClient]:
    engine = get_engine("sqlite://")
    set_engine(engine)
    create_db_and_tables(engine)

    from app.main import create_app

    app = create_app()

    def _offline_resolver(
        session: Session = None,  # noqa: overridden below
    ) -> ProductResolver:
        # Fresh session per request via the real dependency chain.
        with Session(engine) as s:
            products = ProductRepository(s)
            off = OffSource(OffProductRepository(s))
            yield ProductResolver(products, [_MissingSource(), off])

    app.dependency_overrides[get_resolver] = _offline_resolver
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def seed_product():
    def _seed(ean: str = "1", name: str = "Milk", source: str = "manual") -> None:
        assert db_module._engine is not None
        with Session(db_module._engine) as session:
            session.add(Product(ean=ean, name=name, source=source))
            session.commit()

    return _seed
```

- [ ] **Step 2: Write `app/api/resolve.py`**

```python
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_resolver
from app.schemas import ProductOut
from app.services.resolver import ProductResolver

router = APIRouter(prefix="/api", tags=["resolve"])


@router.get("/resolve/{ean}", response_model=ProductOut)
def resolve_ean(
    ean: str, resolver: ProductResolver = Depends(get_resolver)
) -> object:
    product = resolver.resolve(ean)
    if product is None:
        return JSONResponse(status_code=404, content={"ean": ean})
    return product
```

- [ ] **Step 3: Write `app/api/products.py`**

```python
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_product_repo
from app.models import Product
from app.repositories.products import ProductRepository
from app.schemas import ProductCreate, ProductOut, ProductPatch

router = APIRouter(prefix="/api/products", tags=["products"])


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductCreate, repo: ProductRepository = Depends(get_product_repo)
) -> Product:
    product = Product(source="manual", **payload.model_dump())
    return repo.create(product)


@router.get("/{ean}", response_model=ProductOut)
def get_product(
    ean: str, repo: ProductRepository = Depends(get_product_repo)
) -> Product:
    product = repo.get(ean)
    if product is None:
        raise HTTPException(status_code=404, detail={"ean": ean})
    return product


@router.patch("/{ean}", response_model=ProductOut)
def patch_product(
    ean: str,
    payload: ProductPatch,
    repo: ProductRepository = Depends(get_product_repo),
) -> Product:
    product = repo.update_fields(ean, payload.model_dump(exclude_unset=True))
    if product is None:
        raise HTTPException(status_code=404, detail={"ean": ean})
    return product
```

- [ ] **Step 4: Write `app/api/inventory.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.api.deps import get_inventory_service
from app.schemas import (
    InventoryCreate,
    InventoryOut,
    InventoryPatch,
    InventoryWithProductOut,
    ProductOut,
)
from app.services.inventory import (
    AlreadyTrackedError,
    InventoryService,
    ProductNotFoundError,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryWithProductOut])
def list_inventory(
    low: bool = Query(default=False),
    service: InventoryService = Depends(get_inventory_service),
) -> list[InventoryWithProductOut]:
    rows = service.list_items(low_only=low)
    return [
        InventoryWithProductOut(
            inventory=InventoryOut.model_validate(item),
            product=ProductOut.model_validate(product),
            low=item.quantity <= item.threshold,
        )
        for item, product in rows
    ]


@router.post("", response_model=InventoryOut, status_code=201)
def create_inventory(
    payload: InventoryCreate,
    service: InventoryService = Depends(get_inventory_service),
) -> InventoryOut:
    try:
        item = service.start_tracking(
            payload.ean,
            payload.quantity,
            payload.threshold,
            payload.unit,
            payload.location,
        )
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"ean": payload.ean}) from exc
    except AlreadyTrackedError as exc:
        raise HTTPException(status_code=409, detail={"ean": payload.ean}) from exc
    return InventoryOut.model_validate(item)


@router.patch("/{ean}", response_model=InventoryOut)
def patch_inventory(
    ean: str,
    payload: InventoryPatch,
    service: InventoryService = Depends(get_inventory_service),
) -> InventoryOut:
    item = service.update(ean, payload.model_dump(exclude_unset=True))
    if item is None:
        raise HTTPException(status_code=404, detail={"ean": ean})
    return InventoryOut.model_validate(item)


@router.delete("/{ean}", status_code=204)
def delete_inventory(
    ean: str, service: InventoryService = Depends(get_inventory_service)
) -> Response:
    if not service.stop_tracking(ean):
        raise HTTPException(status_code=404, detail={"ean": ean})
    return Response(status_code=204)
```

- [ ] **Step 5: Write `app/api/shopping_list.py`**

```python
from fastapi import APIRouter, Depends

from app.api.deps import get_shopping_list_service
from app.schemas import ShoppingListItemOut
from app.services.shopping_list import ShoppingListService

router = APIRouter(prefix="/api", tags=["shopping-list"])


@router.get("/shopping-list", response_model=list[ShoppingListItemOut])
def get_shopping_list(
    service: ShoppingListService = Depends(get_shopping_list_service),
) -> list[ShoppingListItemOut]:
    return [
        ShoppingListItemOut(
            ean=item.ean,
            name=product.name,
            quantity=item.quantity,
            threshold=item.threshold,
            unit=item.unit,
            image_url=product.image_url,
        )
        for item, product in service.items()
    ]
```

- [ ] **Step 6: Update `app/main.py` to wire routers**

```python
from fastapi import FastAPI

from app.api import inventory, products, resolve, shopping_list
from app.db import create_db_and_tables, get_engine, set_engine


def create_app() -> FastAPI:
    app = FastAPI(title="homeStock")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(resolve.router)
    app.include_router(products.router)
    app.include_router(inventory.router)
    app.include_router(shopping_list.router)
    return app


def _bootstrap() -> FastAPI:
    engine = get_engine()
    set_engine(engine)
    create_db_and_tables(engine)
    return create_app()


app = _bootstrap()
```

- [ ] **Step 7: Write `tests/api/test_resolve.py`**

```python
def test_resolve_local_hit(client, seed_product) -> None:
    seed_product(ean="1", name="Milk")
    response = client.get("/api/resolve/1")
    assert response.status_code == 200
    assert response.json()["name"] == "Milk"


def test_resolve_miss_returns_404_with_ean(client) -> None:
    response = client.get("/api/resolve/999")
    assert response.status_code == 404
    assert response.json() == {"ean": "999"}
```

- [ ] **Step 8: Write `tests/api/test_products.py`**

```python
def test_create_and_get_product(client) -> None:
    payload = {"ean": "5", "name": "Rice", "brand": "ACME"}
    created = client.post("/api/products", json=payload)
    assert created.status_code == 201
    assert created.json()["source"] == "manual"

    fetched = client.get("/api/products/5")
    assert fetched.status_code == 200
    assert fetched.json()["brand"] == "ACME"


def test_patch_product(client) -> None:
    client.post("/api/products", json={"ean": "5", "name": "Rice"})
    patched = client.patch("/api/products/5", json={"name": "Brown Rice"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Brown Rice"


def test_get_missing_product_404(client) -> None:
    assert client.get("/api/products/nope").status_code == 404
```

- [ ] **Step 9: Write `tests/api/test_inventory.py`**

```python
def test_track_list_patch_delete_flow(client, seed_product) -> None:
    seed_product(ean="1", name="Milk")

    created = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 3, "threshold": 1, "unit": "L"},
    )
    assert created.status_code == 201

    listing = client.get("/api/inventory")
    assert listing.status_code == 200
    body = listing.json()
    assert len(body) == 1
    assert body[0]["product"]["name"] == "Milk"
    assert body[0]["low"] is False

    patched = client.patch("/api/inventory/1", json={"quantity": 0})
    assert patched.status_code == 200
    assert patched.json()["quantity"] == 0

    low = client.get("/api/inventory", params={"low": "true"})
    assert len(low.json()) == 1  # now at/under threshold

    deleted = client.delete("/api/inventory/1")
    assert deleted.status_code == 204
    assert client.get("/api/inventory").json() == []


def test_track_unknown_product_404(client) -> None:
    response = client.post(
        "/api/inventory", json={"ean": "ghost", "quantity": 1, "threshold": 1}
    )
    assert response.status_code == 404


def test_track_twice_409(client, seed_product) -> None:
    seed_product(ean="1")
    client.post("/api/inventory", json={"ean": "1", "quantity": 1, "threshold": 1})
    dup = client.post(
        "/api/inventory", json={"ean": "1", "quantity": 2, "threshold": 1}
    )
    assert dup.status_code == 409
```

- [ ] **Step 10: Write `tests/api/test_shopping_list.py`**

```python
def test_shopping_list_lists_low_items(client, seed_product) -> None:
    seed_product(ean="milk", name="Milk")
    seed_product(ean="eggs", name="Eggs")
    client.post("/api/inventory", json={"ean": "milk", "quantity": 1, "threshold": 2})
    client.post("/api/inventory", json={"ean": "eggs", "quantity": 9, "threshold": 2})

    response = client.get("/api/shopping-list")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["name"] == "Milk"
```

- [ ] **Step 11: Run the full suite**

Run: `uv run pytest -v`
Expected: PASS (all tests across all tasks).

- [ ] **Step 12: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add API routers, DI overrides, and full API test suite"
```

---

### Task 10: OFF import script

**Files:**
- Create: `scripts/__init__.py` (empty)
- Create: `scripts/off_import.py`
- Test: `tests/scripts/test_off_import.py`
- Create: `tests/scripts/__init__.py` (empty)
- Create: `tests/scripts/fixtures/off_sample.csv` (tiny TSV fixture)

**Interfaces:**
- Consumes: `app.db` (engine), `app.models.OffProduct`.
- Produces:
  - `scripts.off_import.parse_row(row: dict[str, str]) -> OffProduct | None` — maps OFF header names to `OffProduct`; returns `None` if `code` or `product_name` is empty/blank. Blank numeric cells → `None` (not `0.0`).
  - `scripts.off_import.import_off(csv_path: str, engine: Engine, chunk_size: int = 1000) -> int` — streams the TSV with `csv.DictReader(delimiter="\t")`, drops+recreates the `off_products` table (idempotent; never touches `products`/`inventory`), upserts row-by-row, commits per chunk, returns count imported.
  - `scripts.off_import.main(argv: list[str] | None = None) -> None` — CLI: `python -m scripts.off_import --csv data/en.openfoodfacts.org.products.csv [--db sqlite:///homestock.db]`.

- [ ] **Step 1: Create the fixture `tests/scripts/fixtures/off_sample.csv`**

A 3-line tab-separated file (header + 2 valid + 1 invalid). Create it with this exact command so the tabs are real:

```bash
mkdir -p tests/scripts/fixtures
printf 'code\tproduct_name\tbrands\timage_url\tcategories\tquantity\tenergy-kcal_100g\tfat_100g\tsaturated-fat_100g\tcarbohydrates_100g\tsugars_100g\tfiber_100g\tproteins_100g\tsalt_100g\n' > tests/scripts/fixtures/off_sample.csv
printf '111\tBeans\tACME\thttp://img/b.jpg\tCanned\t400 g\t90\t0.5\t0.1\t15\t1.2\t6\t7\t0.8\n' >> tests/scripts/fixtures/off_sample.csv
printf '222\tOlive Oil\tHacendado\t\tOils\t1 L\t824\t92\t14\t0\t0\t0\t0\t0\n' >> tests/scripts/fixtures/off_sample.csv
printf '\tNo Code Row\tX\t\t\t\t\t\t\t\t\t\t\t\n' >> tests/scripts/fixtures/off_sample.csv
```

- [ ] **Step 2: Write the failing tests**

`tests/scripts/test_off_import.py`:

```python
from pathlib import Path

from sqlmodel import Session, select

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, OffProduct, Product
from scripts.off_import import import_off, parse_row

FIXTURE = str(Path(__file__).parent / "fixtures" / "off_sample.csv")


def test_parse_row_maps_fields() -> None:
    row = {
        "code": "111",
        "product_name": "Beans",
        "brands": "ACME",
        "image_url": "http://img/b.jpg",
        "categories": "Canned",
        "quantity": "400 g",
        "energy-kcal_100g": "90",
        "fat_100g": "0.5",
        "saturated-fat_100g": "0.1",
        "carbohydrates_100g": "15",
        "sugars_100g": "1.2",
        "fiber_100g": "6",
        "proteins_100g": "7",
        "salt_100g": "0.8",
    }
    product = parse_row(row)
    assert product is not None
    assert product.ean == "111"
    assert product.name == "Beans"
    assert product.quantity_desc == "400 g"
    assert product.kcal_per_100g == 90.0
    assert product.salt_per_100g == 0.8


def test_parse_row_skips_missing_code_or_name() -> None:
    assert parse_row({"code": "", "product_name": "X"}) is None
    assert parse_row({"code": "1", "product_name": ""}) is None


def test_parse_row_blank_numeric_is_none() -> None:
    product = parse_row(
        {"code": "1", "product_name": "N", "energy-kcal_100g": ""}
    )
    assert product is not None
    assert product.kcal_per_100g is None


def test_import_off_loads_valid_rows_only() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    count = import_off(FIXTURE, engine)
    assert count == 2  # the no-code row is skipped
    with Session(engine) as session:
        eans = {p.ean for p in session.exec(select(OffProduct)).all()}
    assert eans == {"111", "222"}


def test_import_off_is_idempotent_and_isolates_products() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    with Session(engine) as session:
        session.add(Product(ean="keep", name="Curated", source="manual"))
        session.add(InventoryItem(ean="keep", quantity=1, threshold=1))
        session.commit()

    import_off(FIXTURE, engine)
    import_off(FIXTURE, engine)  # re-run: must not duplicate or touch products

    with Session(engine) as session:
        assert len(session.exec(select(OffProduct)).all()) == 2
        assert session.exec(select(Product)).one().name == "Curated"
        assert len(session.exec(select(InventoryItem)).all()) == 1
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run pytest tests/scripts/test_off_import.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.off_import'`.

- [ ] **Step 4: Write `scripts/off_import.py`**

```python
import argparse
import csv
import sys

from sqlalchemy import Engine
from sqlmodel import Session, SQLModel

from app.db import create_db_and_tables, get_engine
from app.models import OffProduct

# OFF header name -> OffProduct nutrition attribute
_NUTRITION_MAP = {
    "energy-kcal_100g": "kcal_per_100g",
    "fat_100g": "fat_per_100g",
    "saturated-fat_100g": "saturated_fat_per_100g",
    "carbohydrates_100g": "carbs_per_100g",
    "sugars_100g": "sugars_per_100g",
    "fiber_100g": "fiber_per_100g",
    "proteins_100g": "proteins_per_100g",
    "salt_100g": "salt_per_100g",
}


def _to_float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _clean(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None
    return value.strip()


def parse_row(row: dict[str, str]) -> OffProduct | None:
    ean = (row.get("code") or "").strip()
    name = (row.get("product_name") or "").strip()
    if not ean or not name:
        return None
    product = OffProduct(
        ean=ean,
        name=name,
        brand=_clean(row.get("brands")),
        image_url=_clean(row.get("image_url")),
        category=_clean(row.get("categories")),
        quantity_desc=_clean(row.get("quantity")),
    )
    for header, attr in _NUTRITION_MAP.items():
        setattr(product, attr, _to_float(row.get(header)))
    return product


def import_off(csv_path: str, engine: Engine, chunk_size: int = 1000) -> int:
    # Idempotent: rebuild only off_products, leaving products/inventory intact.
    OffProduct.__table__.drop(engine, checkfirst=True)
    SQLModel.metadata.create_all(engine, tables=[OffProduct.__table__])

    imported = 0
    with (
        open(csv_path, newline="", encoding="utf-8") as handle,
        Session(engine) as session,
    ):
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            product = parse_row(row)
            if product is None:
                continue
            session.merge(product)  # upsert by PK (ean)
            imported += 1
            if imported % chunk_size == 0:
                session.commit()
        session.commit()
    return imported


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Import OpenFoodFacts subset.")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--db", default="sqlite:///homestock.db")
    args = parser.parse_args(argv)

    engine = get_engine(args.db)
    create_db_and_tables(engine)
    count = import_off(args.csv, engine)
    print(f"Imported {count} OFF products into {args.db}")


if __name__ == "__main__":
    main(sys.argv[1:])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/scripts/test_off_import.py -v`
Expected: PASS (all five).

- [ ] **Step 6: Run the full suite one more time**

Run: `uv run pytest -v`
Expected: PASS (everything).

- [ ] **Step 7: Lint, format, commit**

```bash
uv run ruff format . && uv run ruff check .
git add -A && git commit -m "feat: add re-runnable OpenFoodFacts import script"
```

---

### Task 11: README & TLS/deployment notes

**Files:**
- Create: `README.md`
- Create: `.gitignore`

**Interfaces:**
- Consumes: everything (documents how to run it).
- Produces: developer-facing docs. No code, no tests — a documentation task folded in here because the spec calls out the `mkcert` TLS step as a *required, documented* setup step (camera needs HTTPS).

- [ ] **Step 1: Write `.gitignore`**

```gitignore
.venv/
__pycache__/
*.pyc
homestock.db
.pytest_cache/
.ruff_cache/
data/*.csv
```

- [ ] **Step 2: Write `README.md`**

Include these sections verbatim as the skeleton, filling code fences as shown:

````markdown
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
````

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: add README with TLS/mkcert setup and run instructions"
```

---

## Self-Review

**1. Spec coverage:**

| Spec requirement | Task |
|---|---|
| FastAPI + SQLModel + SQLite | 1, 2 |
| `products` / `inventory_items` / `off_products` tables | 2 |
| `ProductSource` protocol, swappable sources | 3, 4 |
| Mercadona best-effort (timeout/non-200/garbage → fall through) | 4 |
| OFF source queries local table | 3 |
| Local products table as source-of-truth + cache (write-back) | 5, 6 |
| 4-step resolver, strict order, short-circuit | 6 |
| Inventory CRUD + `≤` low logic | 5, 7 |
| Shopping list as a query (`≤`, equality included) | 5, 7, 9 |
| `GET /api/resolve/{ean}` → product or clean 404 | 9 |
| products `POST`/`GET`/`PATCH` | 9 |
| inventory `GET?low` / `POST` / `PATCH` / `DELETE` | 9 |
| `GET /api/shopping-list` | 9 |
| Pydantic at every boundary, 422 on bad input (FastAPI default) | 8, 9 |
| Layered routers→services→repos, DI via `Depends` | 8, 9 |
| OFF import: streaming, filter, skip no-ean/no-name, idempotent, isolated | 10 |
| TDD throughout, Ruff, type hints | all |
| TLS/mkcert documented required step | 11 |

No gaps found.

**2. Placeholder scan:** No `TBD`/`TODO`/"handle edge cases"/"similar to Task N". Every code step shows complete code; every test step shows the assertions.

**3. Type consistency:** `ProductData` fields (Task 3) match `ProductRepository._CATALOG_FIELDS` (Task 5) and `Product` columns (Task 2). `resolve() -> Product | None` (Task 6) matches the resolve router (Task 9). `start_tracking(...)` signature (Task 7) matches its call in the inventory router (Task 9). `list_low()` name is consistent across Tasks 5, 7, 9. `parse_row`/`import_off` signatures (Task 10) match their tests.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-homestock-backend.md`.
