import argparse
import sys

from sqlalchemy import Engine, Table, inspect, select

from app.db import get_engine
from app.migrations import upgrade_to_head
from app.models import InventoryItem, OffProduct, Product

# Copy order matters: products before inventory_items (FK), off_products has
# no dependents either way.
_TABLES_IN_ORDER = [Product, OffProduct, InventoryItem]

# Rows are inserted in groups, so a large table does not build one huge statement.
COPY_CHUNK_SIZE = 1000


def _shared_columns(table: Table, source: Engine) -> list:
    """Lists the columns of a table that also exist in the source database.

    A source created before a migration lacks the newest columns. Those are left out
    of the copy, so the target keeps their default value.

    Args:
        table: The table as the models define it.
        source: The database the rows are read from.

    Returns:
        The model columns whose names are present in the source table.
    """
    source_names = {
        column["name"] for column in inspect(source).get_columns(table.name)
    }
    return [column for column in table.columns if column.name in source_names]


def copy_table(
    model: type,
    source: Engine,
    target: Engine,
    chunk_size: int = COPY_CHUNK_SIZE,
) -> int:
    """Copies every row of one table from the source to the target.

    Args:
        model: The model whose table is copied.
        source: The database to read from. It is not modified.
        target: The database to write to. The table must already exist.
        chunk_size: How many rows to insert at a time.

    Returns:
        The number of rows copied.
    """
    table = model.__table__
    columns = _shared_columns(table, source)
    with source.connect() as src_conn, target.connect() as dst_conn:
        rows = src_conn.execute(select(*columns)).mappings().all()
        for start in range(0, len(rows), chunk_size):
            chunk = [dict(row) for row in rows[start : start + chunk_size]]
            dst_conn.execute(table.insert(), chunk)
        dst_conn.commit()
    return len(rows)


def main(argv: list[str] | None = None) -> None:
    """Command line entry point: copies a filled SQLite database into an empty one.

    The target schema is created with the migrations. Run it only against an empty
    target.

    Args:
        argv: Command line arguments. Defaults to `sys.argv`.
    """
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
    upgrade_to_head(args.target)

    for model in _TABLES_IN_ORDER:
        count = copy_table(model, source, target)
        print(f"{model.__tablename__}: {count} rows copied")


if __name__ == "__main__":
    main(sys.argv[1:])
