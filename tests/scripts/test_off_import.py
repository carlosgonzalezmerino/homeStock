from pathlib import Path

from sqlmodel import Session, select

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, OffProduct, Product
from scripts.off_import import _is_mercadona, import_off, parse_row

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


def test_is_mercadona_matches_case_insensitive_substring() -> None:
    assert _is_mercadona({"stores": "Mercadona"}) is True
    assert _is_mercadona({"stores": "mercadona, Carrefour"}) is True
    assert _is_mercadona({"stores": "MERCADONA"}) is True


def test_is_mercadona_false_when_absent_empty_or_other_store() -> None:
    assert _is_mercadona({}) is False
    assert _is_mercadona({"stores": ""}) is False
    assert _is_mercadona({"stores": "Carrefour"}) is False


def test_import_off_loads_mercadona_rows_only() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    count = import_off(FIXTURE, engine)
    # 222 is Carrefour, duplicate 111 and the no-code row are skipped.
    assert count == 1
    with Session(engine) as session:
        products = session.exec(select(OffProduct)).all()
    eans = {p.ean for p in products}
    assert eans == {"111"}


def test_import_off_dedupes_by_ean_keeping_first() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    import_off(FIXTURE, engine)
    with Session(engine) as session:
        product = session.exec(select(OffProduct)).one()
    # Fixture has two Mercadona rows for EAN 111; the first wins.
    assert product.name == "Beans"


def test_import_off_skips_non_mercadona() -> None:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    import_off(FIXTURE, engine)
    with Session(engine) as session:
        assert (
            session.exec(select(OffProduct).where(OffProduct.ean == "222")).first()
            is None
        )


def test_import_off_handles_fields_larger_than_csv_default_limit(
    tmp_path: Path,
) -> None:
    # Real OFF rows have fields exceeding csv's default 128 KB limit.
    big_value = "x" * 200_000
    csv_path = tmp_path / "big.csv"
    header = "code\tproduct_name\tcategories\tstores\n"
    row = f"111\tBeans\t{big_value}\tMercadona\n"
    csv_path.write_text(header + row, encoding="utf-8")

    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    count = import_off(str(csv_path), engine)

    assert count == 1
    with Session(engine) as session:
        assert session.exec(select(OffProduct)).one().ean == "111"


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
        assert len(session.exec(select(OffProduct)).all()) == 1
        assert session.exec(select(Product)).one().name == "Curated"
        assert len(session.exec(select(InventoryItem)).all()) == 1
