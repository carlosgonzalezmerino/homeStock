from datetime import date

import pytest

from app.services import inventory as inventory_module
from app.services.inventory import FREEZER_FIELDS_MESSAGE

FIXED_TODAY = date(2026, 11, 2)


@pytest.fixture(autouse=True)
def _fixed_today(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fixes the server's date for every test in this file.

    Args:
        monkeypatch: Pytest fixture used to replace the date function.
    """
    monkeypatch.setattr(inventory_module, "today", lambda: FIXED_TODAY)


def test_create_freezer_item_without_date_uses_today(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 2, "threshold": 1, "location": "freezer"},
    )
    assert response.json()["frozen_at"] == FIXED_TODAY.isoformat()


def test_create_freezer_item_with_drawer_and_date_returns_both(
    client, seed_product
) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={
            "ean": "1",
            "quantity": 2,
            "threshold": 1,
            "location": "freezer",
            "drawer": 3,
            "frozen_at": "2026-10-01",
        },
    )
    assert (response.json()["drawer"], response.json()["frozen_at"]) == (
        3,
        "2026-10-01",
    )


def test_create_pantry_item_with_drawer_returns_422_with_message(
    client, seed_product
) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={
            "ean": "1",
            "quantity": 2,
            "threshold": 1,
            "location": "pantry",
            "drawer": 2,
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["message"] == FREEZER_FIELDS_MESSAGE


def test_create_item_without_location_with_frozen_date_returns_422(
    client, seed_product
) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 2, "threshold": 1, "frozen_at": "2026-10-01"},
    )
    assert response.status_code == 422


def test_patch_move_to_freezer_sets_today(client, seed_product) -> None:
    seed_product(ean="1")
    client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 2, "threshold": 1, "location": "pantry"},
    )
    response = client.patch("/api/inventory/1", json={"location": "freezer"})
    assert response.json()["frozen_at"] == FIXED_TODAY.isoformat()


def test_patch_move_to_pantry_clears_drawer_and_date(client, seed_product) -> None:
    seed_product(ean="1")
    client.post(
        "/api/inventory",
        json={
            "ean": "1",
            "quantity": 2,
            "threshold": 1,
            "location": "freezer",
            "drawer": 1,
        },
    )
    response = client.patch("/api/inventory/1", json={"location": "pantry"})
    assert (response.json()["drawer"], response.json()["frozen_at"]) == (None, None)


def test_patch_drawer_on_pantry_item_returns_422(client, seed_product) -> None:
    seed_product(ean="1")
    client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 2, "threshold": 1, "location": "pantry"},
    )
    response = client.patch("/api/inventory/1", json={"drawer": 2})
    assert response.status_code == 422


def test_patch_quantity_on_frozen_item_keeps_date(client, seed_product) -> None:
    seed_product(ean="1")
    client.post(
        "/api/inventory",
        json={
            "ean": "1",
            "quantity": 2,
            "threshold": 1,
            "location": "freezer",
            "frozen_at": "2026-10-01",
        },
    )
    response = client.patch("/api/inventory/1", json={"quantity": 4})
    assert (response.json()["quantity"], response.json()["frozen_at"]) == (
        4,
        "2026-10-01",
    )


def test_patch_notes_saves_trimmed_text(client, seed_product) -> None:
    seed_product(ean="1")
    client.post("/api/inventory", json={"ean": "1", "quantity": 2, "threshold": 1})
    response = client.patch("/api/inventory/1", json={"notes": "  Muslitos  "})
    assert response.json()["notes"] == "Muslitos"


def test_patch_empty_notes_clears_them(client, seed_product) -> None:
    seed_product(ean="1")
    client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 2, "threshold": 1, "notes": "algo"},
    )
    response = client.patch("/api/inventory/1", json={"notes": ""})
    assert response.json()["notes"] is None
