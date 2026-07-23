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


def test_shopping_list_excludes_item_at_threshold() -> None:
    """Item AT threshold (quantity == threshold) must NOT appear in the list."""
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    session.add(Product(ean="bread", name="Bread", source="manual"))
    session.add(InventoryItem(ean="bread", quantity=2, threshold=2))  # at threshold, not low
    session.commit()

    service = ShoppingListService(
        InventoryRepository(session), ProductRepository(session)
    )
    rows = service.items()
    assert len(rows) == 0
