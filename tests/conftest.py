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

    def _offline_resolver() -> ProductResolver:
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
        for session in db_module.get_session():  # uses the already-set engine
            session.add(Product(ean=ean, name=name, source=source))
            session.commit()

    return _seed
