"""API behaviour on a database built by the real migrations, not by `create_all`.

These tests catch drift between the migrations, the models and the API.
"""

import sqlite3
from collections.abc import Iterator
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlmodel import Session

from app import db as db_module
from app.main import create_app
from app.migrations import upgrade_to_head
from app.models import OffProduct

OFF_EAN = "8410376003139"
TODAY = date.today().isoformat()


@pytest.fixture
def migrated(tmp_path: Path) -> Iterator[tuple[TestClient, Path]]:
    """Builds a SQLite file with the migrations and serves the app on top of it.

    Args:
        tmp_path: Pytest's temporary directory for the test.

    Yields:
        The test client and the path of the database file.
    """
    path = tmp_path / "integration.db"
    url = f"sqlite:///{path}"
    upgrade_to_head(url)
    engine = db_module.get_engine(url)
    db_module.set_engine(engine)
    with Session(engine) as session:
        session.add(OffProduct(ean=OFF_EAN, name="Leche entera", brand="Hacendado"))
        session.commit()
    with TestClient(create_app()) as client:
        yield client, path


def _track_in_freezer(client: TestClient) -> None:
    """Resolves the product and tracks it in the freezer with a drawer and a note."""
    client.get(f"/api/resolve/{OFF_EAN}")
    response = client.post(
        "/api/inventory",
        json={
            "ean": OFF_EAN,
            "quantity": 0.5,
            "threshold": 0,
            "location": "freezer",
            "drawer": 2,
            "notes": "  Hay 5 muslitos  ",
        },
    )
    assert response.status_code == 201


def test_resolve_off_product_is_cached_in_the_catalogue(migrated) -> None:
    client, _ = migrated
    first = client.get(f"/api/resolve/{OFF_EAN}")
    assert first.status_code == 200
    assert first.json()["source"] == "openfoodfacts"
    assert client.get(f"/api/products/{OFF_EAN}").json()["name"] == "Leche entera"


def test_freezer_item_is_stored_with_drawer_date_and_trimmed_note(migrated) -> None:
    client, _ = migrated
    _track_in_freezer(client)
    stored = client.get("/api/inventory").json()[0]["inventory"]
    assert (stored["drawer"], stored["frozen_at"], stored["notes"]) == (
        2,
        TODAY,
        "Hay 5 muslitos",
    )


def test_half_unit_with_zero_threshold_is_not_low_until_empty(migrated) -> None:
    client, _ = migrated
    _track_in_freezer(client)
    assert client.get("/api/inventory").json()[0]["low"] is False
    assert client.get("/api/shopping-list").json() == []
    client.patch(f"/api/inventory/{OFF_EAN}", json={"quantity": 0})
    assert client.get("/api/inventory").json()[0]["low"] is True
    assert [row["name"] for row in client.get("/api/shopping-list").json()] == [
        "Leche entera"
    ]


def test_moving_to_pantry_clears_the_freezer_fields_in_the_database(migrated) -> None:
    client, path = migrated
    _track_in_freezer(client)
    client.patch(f"/api/inventory/{OFF_EAN}", json={"location": "pantry"})
    row = (
        sqlite3.connect(path)
        .execute("select location, drawer, frozen_at from inventory_items")
        .fetchone()
    )
    assert row == ("pantry", None, None)


def test_removing_from_the_inventory_keeps_the_catalogue_entry(migrated) -> None:
    client, _ = migrated
    _track_in_freezer(client)
    assert client.delete(f"/api/inventory/{OFF_EAN}").status_code == 204
    assert client.get("/api/inventory").json() == []
    assert client.get(f"/api/products/{OFF_EAN}").status_code == 200


def test_migrated_database_records_the_head_revision(migrated) -> None:
    _, path = migrated
    with create_engine(f"sqlite:///{path}").connect() as connection:
        version = connection.execute(text("select version_num from alembic_version"))
        assert version.scalar_one() == "0002"
