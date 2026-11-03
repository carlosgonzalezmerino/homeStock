from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlmodel import SQLModel

from alembic import command
from app.migrations import alembic_config, upgrade_to_head

FREEZER_COLUMNS = {"drawer", "frozen_at", "notes"}


def _inventory_columns(url: str) -> set[str]:
    """Lists the column names of `inventory_items` in the given database.

    Args:
        url: The SQLAlchemy URL of the database.

    Returns:
        The set of column names.
    """
    engine = create_engine(url)
    with engine.connect() as connection:
        return {
            column["name"]
            for column in inspect(connection).get_columns("inventory_items")
        }


def _schema_differences(url: str) -> list:
    """Compares the migrated database with the SQLModel metadata.

    Args:
        url: The SQLAlchemy URL of the migrated database.

    Returns:
        The differences Alembic finds. An empty list means a full match.
    """
    engine = create_engine(url)
    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        return compare_metadata(context, SQLModel.metadata)


@pytest.fixture
def db_url(tmp_path: Path) -> str:
    """Gives each test its own empty SQLite file.

    Args:
        tmp_path: Pytest's temporary directory for the test.

    Returns:
        The SQLAlchemy URL of the empty database.
    """
    return f"sqlite:///{tmp_path / 'migrations.db'}"


def test_upgrade_head_creates_schema_that_matches_models(db_url: str) -> None:
    command.upgrade(alembic_config(db_url), "head")
    assert _schema_differences(db_url) == []


def test_schema_before_0002_is_reported_as_different_from_models(db_url: str) -> None:
    command.upgrade(alembic_config(db_url), "0001")
    assert _schema_differences(db_url) != []


def test_upgrade_head_adds_freezer_columns_to_inventory(db_url: str) -> None:
    command.upgrade(alembic_config(db_url), "head")
    assert FREEZER_COLUMNS <= _inventory_columns(db_url)


def test_downgrade_to_0001_removes_freezer_columns(db_url: str) -> None:
    config = alembic_config(db_url)
    command.upgrade(config, "head")
    command.downgrade(config, "0001")
    assert FREEZER_COLUMNS.isdisjoint(_inventory_columns(db_url))


def test_upgrade_after_downgrade_restores_schema(db_url: str) -> None:
    config = alembic_config(db_url)
    command.upgrade(config, "head")
    command.downgrade(config, "0001")
    command.upgrade(config, "head")
    assert _schema_differences(db_url) == []


def test_upgrade_from_0001_keeps_existing_rows_and_leaves_new_fields_empty(
    db_url: str,
) -> None:
    config = alembic_config(db_url)
    command.upgrade(config, "0001")
    engine = create_engine(db_url)
    now = "2026-07-25 18:30:00"
    with engine.begin() as connection:
        connection.execute(
            text(
                "insert into products (ean, name, source, created_at, updated_at) "
                "values ('8410376003139', 'Leche', 'openfoodfacts', :now, :now)"
            ),
            {"now": now},
        )
        connection.execute(
            text(
                "insert into inventory_items "
                "(ean, quantity, threshold, unit, location, created_at, updated_at) "
                "values ('8410376003139', 3, 1, 'L', 'freezer', :now, :now)"
            ),
            {"now": now},
        )

    command.upgrade(config, "head")

    with engine.connect() as connection:
        row = connection.execute(
            text(
                "select quantity, threshold, unit, location, drawer, frozen_at, notes "
                "from inventory_items"
            )
        ).one()
    assert tuple(row) == (3, 1, "L", "freezer", None, None, None)


def test_upgrade_to_head_migrates_an_empty_database_in_one_call(db_url: str) -> None:
    upgrade_to_head(db_url)
    assert _schema_differences(db_url) == []
