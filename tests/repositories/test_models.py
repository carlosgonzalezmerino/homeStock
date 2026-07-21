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
