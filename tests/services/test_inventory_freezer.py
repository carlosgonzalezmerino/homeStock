from datetime import date

import pytest
from sqlmodel import Session

from app.db import create_db_and_tables, get_engine
from app.models import Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository
from app.services import inventory as inventory_module
from app.services.inventory import FreezerFieldsError, InventoryService

FIXED_TODAY = date(2026, 11, 2)
EARLIER_DATE = date(2026, 10, 1)


@pytest.fixture
def service(monkeypatch: pytest.MonkeyPatch) -> InventoryService:
    """Builds an inventory service over an empty in-memory database with one product.

    Args:
        monkeypatch: Pytest fixture used to fix the server's date.

    Returns:
        A service ready to track the product with EAN `p`.
    """
    monkeypatch.setattr(inventory_module, "today", lambda: FIXED_TODAY)
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    session.add(Product(ean="p", name="Prod", source="manual"))
    session.commit()
    return InventoryService(InventoryRepository(session), ProductRepository(session))


def test_start_tracking_freezer_without_date_uses_today(
    service: InventoryService,
) -> None:
    item = service.start_tracking("p", 1, 1, "units", "freezer")
    assert item.frozen_at == FIXED_TODAY


def test_start_tracking_freezer_with_drawer_and_date_keeps_both(
    service: InventoryService,
) -> None:
    item = service.start_tracking(
        "p", 1, 1, "units", "freezer", drawer=3, frozen_at=EARLIER_DATE
    )
    assert (item.drawer, item.frozen_at) == (3, EARLIER_DATE)


def test_start_tracking_pantry_with_drawer_raises_freezer_fields_error(
    service: InventoryService,
) -> None:
    with pytest.raises(FreezerFieldsError):
        service.start_tracking("p", 1, 1, "units", "pantry", drawer=2)


def test_start_tracking_pantry_with_frozen_date_raises_freezer_fields_error(
    service: InventoryService,
) -> None:
    with pytest.raises(FreezerFieldsError):
        service.start_tracking("p", 1, 1, "units", None, frozen_at=FIXED_TODAY)


def test_start_tracking_pantry_without_freezer_fields_stores_nulls(
    service: InventoryService,
) -> None:
    item = service.start_tracking("p", 1, 1, "units", None)
    assert (item.drawer, item.frozen_at) == (None, None)


def test_update_moved_into_freezer_without_date_sets_today(
    service: InventoryService,
) -> None:
    service.start_tracking("p", 1, 1, "units", "pantry")
    item = service.update("p", {"location": "freezer"})
    assert item is not None
    assert item.frozen_at == FIXED_TODAY


def test_update_moved_into_freezer_with_date_keeps_given_date(
    service: InventoryService,
) -> None:
    service.start_tracking("p", 1, 1, "units", "pantry")
    item = service.update("p", {"location": "freezer", "frozen_at": EARLIER_DATE})
    assert item is not None
    assert item.frozen_at == EARLIER_DATE


def test_update_moved_into_freezer_with_drawer_keeps_drawer(
    service: InventoryService,
) -> None:
    service.start_tracking("p", 1, 1, "units", "pantry")
    item = service.update("p", {"location": "freezer", "drawer": 2})
    assert item is not None
    assert (item.drawer, item.frozen_at) == (2, FIXED_TODAY)


def test_update_moved_out_of_freezer_clears_drawer_and_date(
    service: InventoryService,
) -> None:
    service.start_tracking(
        "p", 1, 1, "units", "freezer", drawer=4, frozen_at=EARLIER_DATE
    )
    item = service.update("p", {"location": "pantry"})
    assert item is not None
    assert (item.drawer, item.frozen_at) == (None, None)


def test_update_quantity_on_frozen_item_keeps_frozen_date(
    service: InventoryService,
) -> None:
    service.start_tracking("p", 1, 1, "units", "freezer", frozen_at=EARLIER_DATE)
    item = service.update("p", {"quantity": 5})
    assert item is not None
    assert (item.quantity, item.frozen_at) == (5, EARLIER_DATE)


def test_update_drawer_on_pantry_item_raises_freezer_fields_error(
    service: InventoryService,
) -> None:
    service.start_tracking("p", 1, 1, "units", "pantry")
    with pytest.raises(FreezerFieldsError):
        service.update("p", {"drawer": 1})


def test_update_explicit_null_frozen_date_on_freezer_item_stores_no_date(
    service: InventoryService,
) -> None:
    service.start_tracking("p", 1, 1, "units", "freezer", frozen_at=EARLIER_DATE)
    item = service.update("p", {"frozen_at": None})
    assert item is not None
    assert item.frozen_at is None


def test_update_missing_item_returns_none(service: InventoryService) -> None:
    assert service.update("ghost", {"quantity": 1}) is None
