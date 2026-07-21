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
