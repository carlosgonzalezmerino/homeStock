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
    item = service.start_tracking(
        "p", quantity=3, threshold=1, unit="units", location=None
    )
    assert item.ean == "p"
    assert item.quantity == 3


def test_start_tracking_unknown_product_raises() -> None:
    service = _service()
    with pytest.raises(ProductNotFoundError):
        service.start_tracking(
            "ghost", quantity=1, threshold=1, unit="units", location=None
        )


def test_start_tracking_twice_raises() -> None:
    service = _service()
    service.start_tracking("p", quantity=1, threshold=1, unit="units", location=None)
    with pytest.raises(AlreadyTrackedError):
        service.start_tracking(
            "p", quantity=2, threshold=1, unit="units", location=None
        )


def test_list_items_joins_product() -> None:
    service = _service()
    service.start_tracking("p", quantity=1, threshold=1, unit="units", location=None)
    rows = service.list_items()
    assert len(rows) == 1
    item, product = rows[0]
    assert product.name == "Prod"
