import argparse
import csv
import sys

from sqlalchemy import Engine
from sqlmodel import Session, SQLModel

from app.db import create_db_and_tables, get_engine
from app.models import OffProduct

# OFF header name -> OffProduct nutrition attribute
_NUTRITION_MAP = {
    "energy-kcal_100g": "kcal_per_100g",
    "fat_100g": "fat_per_100g",
    "saturated-fat_100g": "saturated_fat_per_100g",
    "carbohydrates_100g": "carbs_per_100g",
    "sugars_100g": "sugars_per_100g",
    "fiber_100g": "fiber_per_100g",
    "proteins_100g": "proteins_per_100g",
    "salt_100g": "salt_per_100g",
}


def _to_float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _clean(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None
    return value.strip()


def parse_row(row: dict[str, str]) -> OffProduct | None:
    ean = (row.get("code") or "").strip()
    name = (row.get("product_name") or "").strip()
    if not ean or not name:
        return None
    product = OffProduct(
        ean=ean,
        name=name,
        brand=_clean(row.get("brands")),
        image_url=_clean(row.get("image_url")),
        category=_clean(row.get("categories")),
        quantity_desc=_clean(row.get("quantity")),
    )
    for header, attr in _NUTRITION_MAP.items():
        setattr(product, attr, _to_float(row.get(header)))
    return product


def import_off(csv_path: str, engine: Engine, chunk_size: int = 1000) -> int:
    # Idempotent: rebuild only off_products, leaving products/inventory intact.
    OffProduct.__table__.drop(engine, checkfirst=True)
    SQLModel.metadata.create_all(engine, tables=[OffProduct.__table__])

    imported = 0
    with (
        open(csv_path, newline="", encoding="utf-8") as handle,
        Session(engine) as session,
    ):
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            product = parse_row(row)
            if product is None:
                continue
            session.merge(product)  # upsert by PK (ean)
            imported += 1
            if imported % chunk_size == 0:
                session.commit()
        session.commit()
    return imported


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Import OpenFoodFacts subset.")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--db", default="sqlite:///homestock.db")
    args = parser.parse_args(argv)

    engine = get_engine(args.db)
    create_db_and_tables(engine)
    count = import_off(args.csv, engine)
    print(f"Imported {count} OFF products into {args.db}")


if __name__ == "__main__":
    main(sys.argv[1:])
