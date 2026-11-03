"""Migrations 0003 and 0004 applied on a database that already holds data."""

import sqlite3
from pathlib import Path

import pytest

from alembic import command
from app.migrations import alembic_config

OLD_DATE = "2026-07-25 10:00:00.000000"


@pytest.fixture
def database_at_0002(tmp_path: Path) -> Path:
    """A database as it was before the diary: three products, two with stock.

    Args:
        tmp_path: Pytest's temporary directory.

    Returns:
        The path of the SQLite file, at revision 0002.
    """
    path = tmp_path / "before.db"
    command.upgrade(alembic_config(f"sqlite:///{path}"), "0002")
    with sqlite3.connect(path) as connection:
        for ean in ("a", "b", "c"):
            connection.execute(
                "insert into products (ean, name, source, created_at, updated_at) "
                "values (?, ?, 'manual', ?, ?)",
                (ean, ean.upper(), OLD_DATE, OLD_DATE),
            )
        for ean, quantity in (("a", 4.0), ("b", 0.5), ("c", 0.0)):
            connection.execute(
                "insert into inventory_items "
                "(ean, quantity, threshold, unit, created_at, updated_at) "
                "values (?, ?, 1, 'units', ?, ?)",
                (ean, quantity, OLD_DATE, OLD_DATE),
            )
    return path


def _upgrade(path: Path, revision: str = "head") -> None:
    command.upgrade(alembic_config(f"sqlite:///{path}"), revision)


def _rows(path: Path, sql: str) -> list[tuple]:
    with sqlite3.connect(path) as connection:
        return connection.execute(sql).fetchall()


def test_upgrade_backfills_one_initial_movement_per_item_with_stock(
    database_at_0002: Path,
) -> None:
    _upgrade(database_at_0002)
    rows = _rows(
        database_at_0002,
        "select ean, delta, quantity_after, reason, source from stock_movements "
        "order by ean",
    )
    assert rows == [
        ("a", 4.0, 4.0, "initial", "migration"),
        ("b", 0.5, 0.5, "initial", "migration"),
    ]


def test_upgrade_keeps_the_original_creation_date_of_each_item(
    database_at_0002: Path,
) -> None:
    _upgrade(database_at_0002)
    dates = _rows(database_at_0002, "select distinct created_at from stock_movements")
    assert dates == [(OLD_DATE,)]


def test_upgrade_leaves_the_stock_and_the_diary_in_agreement(
    database_at_0002: Path,
) -> None:
    _upgrade(database_at_0002)
    (stock, diary) = _rows(
        database_at_0002,
        "select (select sum(quantity) from inventory_items), "
        "(select sum(delta) from stock_movements)",
    )[0]
    assert stock == diary == 4.5


def test_upgrade_adds_checked_at_without_touching_existing_rows(
    database_at_0002: Path,
) -> None:
    _upgrade(database_at_0002)
    assert _rows(database_at_0002, "select count(*) from inventory_items") == [(3,)]
    assert _rows(database_at_0002, "select checked_at from inventory_items")[0] == (
        None,
    )


def test_downgrade_to_0002_removes_both_changes_and_keeps_the_stock(
    database_at_0002: Path,
) -> None:
    _upgrade(database_at_0002)
    command.downgrade(alembic_config(f"sqlite:///{database_at_0002}"), "0002")
    tables = _rows(
        database_at_0002, "select name from sqlite_master where type='table'"
    )
    assert ("stock_movements",) not in tables
    columns = [
        r[1] for r in _rows(database_at_0002, "pragma table_info(inventory_items)")
    ]
    assert "checked_at" not in columns
    assert _rows(database_at_0002, "select count(*) from inventory_items") == [(3,)]
