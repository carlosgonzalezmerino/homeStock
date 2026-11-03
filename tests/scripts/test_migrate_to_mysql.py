import pytest
from sqlalchemy import Engine, text
from sqlmodel import Session, select

from app.db import get_engine
from app.migrations import head_revision, upgrade_to_head
from app.models import InventoryItem, Product
from scripts.migrate_to_mysql import copy_table, main

# Creation and update time of the rows inserted by the fixtures.
STAMP = "2026-01-01 00:00:00"


@pytest.fixture
def old_source(tmp_path) -> str:
    """Creates a database at revision 0001, as it was before the freezer fields existed.

    Args:
        tmp_path: Pytest's temporary directory for the test.

    Returns:
        The SQLAlchemy URL of the old database, holding one product and one stock row.
    """
    url = f"sqlite:///{tmp_path / 'old.db'}"
    upgrade_to_head(url)
    engine = get_engine(url)
    with engine.begin() as connection:
        connection.execute(text("alter table inventory_items drop column notes"))
        connection.execute(text("alter table inventory_items drop column frozen_at"))
        connection.execute(text("alter table inventory_items drop column drawer"))
        connection.execute(
            text(
                "insert into products (ean, name, source, created_at, updated_at) "
                f"values ('1', 'Leche', 'manual', '{STAMP}', '{STAMP}')"
            )
        )
        connection.execute(
            text(
                "insert into inventory_items "
                "(ean, quantity, threshold, unit, location, created_at, updated_at) "
                f"values ('1', 3, 1, 'L', 'pantry', '{STAMP}', '{STAMP}')"
            )
        )
    return url


@pytest.fixture
def empty_target(tmp_path) -> str:
    """Gives an empty database file to copy into.

    Args:
        tmp_path: Pytest's temporary directory for the test.

    Returns:
        The SQLAlchemy URL of the target.
    """
    return f"sqlite:///{tmp_path / 'target.db'}"


def _count(engine: Engine, table: str) -> int:
    """Counts the rows of a table.

    Args:
        engine: The database to read.
        table: The table name.

    Returns:
        The number of rows.
    """
    with engine.connect() as connection:
        return connection.execute(text(f"select count(*) from {table}")).scalar_one()


def test_copy_table_source_without_new_columns_copies_the_shared_ones(
    old_source, empty_target
) -> None:
    upgrade_to_head(empty_target)
    copied = copy_table(InventoryItem, get_engine(old_source), get_engine(empty_target))
    with Session(get_engine(empty_target)) as session:
        item = session.exec(select(InventoryItem)).one()
    assert copied == 1
    assert (item.quantity, item.unit, item.drawer, item.notes) == (3, "L", None, None)


def test_copy_table_table_without_rows_returns_zero(old_source, empty_target) -> None:
    upgrade_to_head(empty_target)
    assert (
        copy_table(InventoryItem, get_engine(empty_target), get_engine(old_source)) == 0
    )


def test_copy_table_product_row_is_copied_with_its_values(
    old_source, empty_target
) -> None:
    upgrade_to_head(empty_target)
    assert copy_table(Product, get_engine(old_source), get_engine(empty_target)) == 1
    with Session(get_engine(empty_target)) as session:
        assert session.exec(select(Product)).one().name == "Leche"


def test_main_creates_the_target_schema_with_migrations_and_copies_every_table(
    old_source, empty_target, capsys
) -> None:
    main(["--source", old_source, "--target", empty_target])
    target = get_engine(empty_target)
    assert [
        _count(target, t) for t in ("products", "off_products", "inventory_items")
    ] == [1, 0, 1]
    with target.connect() as connection:
        version = connection.execute(text("select version_num from alembic_version"))
        assert version.scalar_one() == head_revision()
    assert "inventory_items: 1 rows copied" in capsys.readouterr().out


def test_main_does_not_modify_the_rows_of_the_source_database(
    old_source, empty_target
) -> None:
    query = text("select ean, quantity, threshold, unit, location from inventory_items")
    with get_engine(old_source).connect() as connection:
        before = connection.execute(query).all()
    main(["--source", old_source, "--target", empty_target])
    with get_engine(old_source).connect() as connection:
        assert connection.execute(query).all() == before
