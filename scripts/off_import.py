import argparse
import csv
import sys

from sqlalchemy import Engine
from sqlmodel import Session, SQLModel

from app.db import get_engine
from app.migrations import upgrade_to_head
from app.models import OffProduct

# OFF rows carry very long fields (e.g. categories); lift csv's 128 KB cap.
csv.field_size_limit(sys.maxsize)

# Rows are committed in groups, so a long import does not hold one huge transaction.
CHUNK_SIZE = 1000
# Rows whose code starts with this prefix are skipped, as in the original import.
SKIPPED_CODE_PREFIX = "00"

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
    """Reads a number from a CSV cell.

    Args:
        value: The cell text, which may be missing or empty.

    Returns:
        The number, or `None` when the cell is empty or not a number.
    """
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _clean(value: str | None) -> str | None:
    """Trims a CSV cell and turns an empty one into `None`.

    Args:
        value: The cell text, which may be missing.

    Returns:
        The trimmed text, or `None` when nothing is left.
    """
    if value is None or value.strip() == "":
        return None
    return value.strip()


def _is_mercadona(row: dict[str, str]) -> bool:
    """Tells whether a row is sold at Mercadona, from its `stores` column.

    Args:
        row: One CSV row.

    Returns:
        `True` when `stores` contains "mercadona", ignoring case.
    """
    stores = row.get("stores")
    if not stores:
        return False
    return "mercadona" in stores.lower()


def parse_row(row: dict[str, str]) -> OffProduct | None:
    """Maps one OpenFoodFacts CSV row to an `OffProduct`.

    Args:
        row: One CSV row.

    Returns:
        The product, or `None` when the row has no code or no name.
    """
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


def import_off(csv_path: str, engine: Engine, chunk_size: int = CHUNK_SIZE) -> int:
    """Rebuilds `off_products` from an OpenFoodFacts CSV, keeping Mercadona rows only.

    Only the first row of each EAN is loaded. The catalogue and the inventory are
    not touched.

    Args:
        csv_path: Path of the tab-separated OpenFoodFacts export.
        engine: The database to import into.
        chunk_size: How many rows to commit at a time.

    Returns:
        The number of products imported.
    """
    OffProduct.__table__.drop(engine, checkfirst=True)
    SQLModel.metadata.create_all(engine, tables=[OffProduct.__table__])

    imported = 0
    seen: set[str] = set()
    with (
        open(csv_path, newline="", encoding="utf-8") as handle,
        Session(engine) as session,
    ):
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            if not _is_mercadona(row) or (row.get("code") or "").startswith(
                SKIPPED_CODE_PREFIX
            ):
                continue
            product = parse_row(row)
            if product is None:
                continue
            if product.ean in seen:  # duplicate EAN in CSV: keep the first
                continue
            seen.add(product.ean)
            session.merge(product)  # upsert by PK (ean)
            imported += 1
            if imported % chunk_size == 0:
                session.commit()
        session.commit()
    return imported


def main(argv: list[str] | None = None) -> None:
    """Command line entry point: imports an OpenFoodFacts CSV.

    The database schema is brought up to date with the migrations first.

    Args:
        argv: Command line arguments. Defaults to `sys.argv`.
    """
    parser = argparse.ArgumentParser(description="Import OpenFoodFacts subset.")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--db", default="sqlite:///homestock.db")
    args = parser.parse_args(argv)

    engine = get_engine(args.db)
    upgrade_to_head(args.db)
    count = import_off(args.csv, engine)
    print(f"Imported {count} OFF products into {args.db}")


if __name__ == "__main__":
    main(sys.argv[1:])
