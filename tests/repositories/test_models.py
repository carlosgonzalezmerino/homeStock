from datetime import datetime

import pytest
from sqlmodel import Session, select

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, Product
from tests.repositories import LOW_STOCK_CASES


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


@pytest.mark.parametrize(("quantity", "threshold", "expected"), LOW_STOCK_CASES)
def test_is_low_follows_stock_rule(
    quantity: float, threshold: float, expected: bool
) -> None:
    item = InventoryItem(ean="x", quantity=quantity, threshold=threshold)
    assert item.is_low is expected


def test_is_low_at_threshold_returns_false() -> None:
    assert InventoryItem(ean="x", quantity=2, threshold=2).is_low is False


def test_is_low_zero_quantity_zero_threshold_returns_true() -> None:
    assert InventoryItem(ean="x", quantity=0, threshold=0).is_low is True
