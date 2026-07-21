from pathlib import Path

from sqlmodel import Session, select

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, OffProduct, Product
from scripts.off_import import import_off, parse_row

FIXTURE = str(Path(__file__).parent / "fixtures" / "off_sample.csv")


def test_parse_row_maps_fields() -> None:
    row = {
        "code": "111",
        "product_name": "Beans",
        "brands": "ACME",
        "image_url": "http://img/b.jpg",
        "categories": "Canned",
        "quantity": "400 g",
        "energy-kcal_100g": "90",
        "fat_100g": "0.5",
        "saturated-fat_100g": "0.1",
        "carbohydrates_100g": "15",
        "sugars_100g": "1.2",
        "fiber_100g": "6",
        "proteins_100g": "7",
        "salt_100g": "0.8",
    }
    product = parse_row(row)
    assert product is not None
    assert product.ean == "111"
    assert product.name == "Beans"
    assert product.quantity_desc == "400 g"
    assert product.kcal_per_100g == 90.0
    assert product.salt_per_100g == 0.8


def test_parse_row_skips_missing_code_or_name() -> None:
    assert parse_row({"code": "", "product_name": "X"}) is None
    assert parse_row({"code": "1", "product_name": ""}) is None


def test_parse_row_blank_numeric_is_none() -> None:
    product = parse_row({"code": "1", "product_name": "N", "energy-kcal_100g": ""})
    assert product is not None
    assert product.kcal_per_100g is None


def test_import_off_loads_valid_rows_only() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    count = import_off(FIXTURE, engine)
    assert count == 2  # the no-code row is skipped
    with Session(engine) as session:
        eans = {p.ean for p in session.exec(select(OffProduct)).all()}
    assert eans == {"111", "222"}


def test_import_off_is_idempotent_and_isolates_products() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    with Session(engine) as session:
        session.add(Product(ean="keep", name="Curated", source="manual"))
        session.add(InventoryItem(ean="keep", quantity=1, threshold=1))
        session.commit()

    import_off(FIXTURE, engine)
    import_off(FIXTURE, engine)  # re-run: must not duplicate or touch products

    with Session(engine) as session:
        assert len(session.exec(select(OffProduct)).all()) == 2
        assert session.exec(select(Product)).one().name == "Curated"
        assert len(session.exec(select(InventoryItem)).all()) == 1
