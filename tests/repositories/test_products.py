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
