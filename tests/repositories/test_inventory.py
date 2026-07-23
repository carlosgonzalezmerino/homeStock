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


def test_list_low_uses_strict_less_than() -> None:
    repo = _repo_with_products()
    repo.create(InventoryItem(ean="a", quantity=5, threshold=2))  # ok
    repo.create(InventoryItem(ean="b", quantity=2, threshold=2))  # ok (==, not low)
    repo.create(InventoryItem(ean="c", quantity=1, threshold=2))  # low (<)
    low_eans = {item.ean for item in repo.list_low()}
    assert low_eans == {"c"}


def test_delete_removes_row() -> None:
    repo = _repo_with_products()
    repo.create(InventoryItem(ean="a", quantity=1, threshold=1))
    assert repo.delete("a") is True
    assert repo.get("a") is None
    assert repo.delete("a") is False
