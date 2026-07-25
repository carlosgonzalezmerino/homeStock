import argparse
import sys

from sqlalchemy import Engine, select

from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, OffProduct, Product

# Copy order matters: products before inventory_items (FK), off_products has
# no dependents either way.
_TABLES_IN_ORDER = [Product, OffProduct, InventoryItem]


def copy_table(
    model: type, source: Engine, target: Engine, chunk_size: int = 1000
) -> int:
    table = model.__table__
    copied = 0
    with source.connect() as src_conn, target.connect() as dst_conn:
        rows = src_conn.execute(select(table)).mappings().all()
        for i in range(0, len(rows), chunk_size):
            chunk = [dict(row) for row in rows[i : i + chunk_size]]
            if chunk:
                dst_conn.execute(table.insert(), chunk)
        dst_conn.commit()
        copied = len(rows)
    return copied


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="One-off copy of a filled-in SQLite DB into MySQL/MariaDB."
    )
    parser.add_argument("--source", default="sqlite:///homestock.db")
    parser.add_argument(
        "--target",
        required=True,
        help="e.g. mysql+pymysql://homestock:PASSWORD@localhost:3306/homestock",
    )
    args = parser.parse_args(argv)

    source = get_engine(args.source)
    target = get_engine(args.target)
    create_db_and_tables(target)

    for model in _TABLES_IN_ORDER:
        count = copy_table(model, source, target)
        print(f"{model.__tablename__}: {count} rows copied")


if __name__ == "__main__":
    main(sys.argv[1:])
