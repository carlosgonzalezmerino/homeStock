"""Migration 0005 applied on a database that already holds data."""

import sqlite3
from pathlib import Path

import pytest

from alembic import command
from app.migrations import alembic_config

NOW = "2026-07-25 10:00:00.000000"


@pytest.fixture
def database_at_0004(tmp_path: Path) -> Path:
    """A database with a product, a stock row and a movement, at revision 0004."""
    path = tmp_path / "before.db"
    command.upgrade(alembic_config(f"sqlite:///{path}"), "0004")
    with sqlite3.connect(path) as connection:
        connection.execute(
            "insert into products (ean, name, source, created_at, updated_at) "
            "values ('a', 'A', 'manual', ?, ?)",
            (NOW, NOW),
        )
        connection.execute(
            "insert into inventory_items "
            "(ean, quantity, threshold, unit, created_at, updated_at) "
            "values ('a', 3, 1, 'units', ?, ?)",
            (NOW, NOW),
        )
    return path


def _upgrade(path: Path) -> None:
    command.upgrade(alembic_config(f"sqlite:///{path}"), "head")


def _rows(path: Path, sql: str) -> list[tuple]:
    with sqlite3.connect(path) as connection:
        return connection.execute(sql).fetchall()


def test_upgrade_creates_an_empty_shopping_list_and_keeps_the_rest(
    database_at_0004: Path,
) -> None:
    _upgrade(database_at_0004)
    assert _rows(database_at_0004, "select count(*) from shopping_list_items") == [(0,)]
    assert _rows(database_at_0004, "select ean, quantity from inventory_items") == [
        ("a", 3.0)
    ]
    assert _rows(database_at_0004, "select count(*) from products") == [(1,)]


def test_upgrade_does_not_fill_the_list_from_the_stock(database_at_0004: Path) -> None:
    # The old list was derived from low stock; the new one holds only what is added.
    with sqlite3.connect(database_at_0004) as connection:
        connection.execute("update inventory_items set quantity = 0")
    _upgrade(database_at_0004)
    assert _rows(database_at_0004, "select count(*) from shopping_list_items") == [(0,)]


def test_checked_defaults_to_false_and_ean_is_unique(database_at_0004: Path) -> None:
    _upgrade(database_at_0004)
    insert = (
        "insert into shopping_list_items (ean, quantity, created_at, updated_at) "
        f"values ('a', 1, '{NOW}', '{NOW}')"
    )
    with sqlite3.connect(database_at_0004) as connection:
        connection.execute(insert)
    assert _rows(database_at_0004, "select checked from shopping_list_items") == [(0,)]
    with (
        pytest.raises(sqlite3.IntegrityError),
        sqlite3.connect(database_at_0004) as connection,
    ):
        connection.execute(insert)


def test_downgrade_drops_only_the_shopping_list(database_at_0004: Path) -> None:
    _upgrade(database_at_0004)
    command.downgrade(alembic_config(f"sqlite:///{database_at_0004}"), "0004")
    tables = {
        name
        for (name,) in _rows(
            database_at_0004, "select name from sqlite_master where type='table'"
        )
    }
    assert "shopping_list_items" not in tables
    assert {"products", "inventory_items", "stock_movements"} <= tables
    assert _rows(database_at_0004, "select count(*) from inventory_items") == [(1,)]
