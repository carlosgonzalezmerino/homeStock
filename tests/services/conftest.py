from collections.abc import Iterator

import pytest
from sqlmodel import Session

from app.db import create_db_and_tables, get_engine
from app.models import Product
from app.repositories.inventory import InventoryRepository
from app.repositories.movements import MovementRepository
from app.repositories.products import ProductRepository
from app.services.inventory import InventoryService

EAN = "p"
OTHER_EAN = "q"


@pytest.fixture
def session() -> Iterator[Session]:
    """An empty in-memory database with two catalogue products, `p` and `q`.

    Yields:
        A session over that database.
    """
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    with Session(engine) as db_session:
        db_session.add(Product(ean=EAN, name="Prod", source="manual"))
        db_session.add(Product(ean=OTHER_EAN, name="Other", source="manual"))
        db_session.commit()
        yield db_session


@pytest.fixture
def movements(session: Session) -> MovementRepository:
    """The movement repository over the test database."""
    return MovementRepository(session)


@pytest.fixture
def inventory_service(
    session: Session, movements: MovementRepository
) -> InventoryService:
    """The inventory service over the test database."""
    return InventoryService(
        InventoryRepository(session), ProductRepository(session), movements
    )
