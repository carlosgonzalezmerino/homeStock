import pytest


@pytest.fixture
def tracked(client, seed_product) -> str:
    """Creates a product and tracks it, so the tests can edit its stock.

    Args:
        client: The test HTTP client.
        seed_product: Helper that inserts a catalogue product.

    Returns:
        The EAN of the tracked product.
    """
    seed_product(ean="1", name="Milk")
    client.post("/api/inventory", json={"ean": "1", "quantity": 1, "threshold": 1})
    return "1"


def test_create_negative_quantity_returns_422(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory", json={"ean": "1", "quantity": -1, "threshold": 1}
    )
    assert response.status_code == 422


def test_create_quantity_with_three_decimals_returns_422(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory", json={"ean": "1", "quantity": 1.234, "threshold": 1}
    )
    assert response.status_code == 422


def test_create_half_unit_quantity_is_accepted(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory", json={"ean": "1", "quantity": 0.5, "threshold": 0}
    )
    assert response.status_code == 201
    assert response.json()["quantity"] == 0.5


def test_create_threshold_zero_is_accepted(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory", json={"ean": "1", "quantity": 2, "threshold": 0}
    )
    assert response.status_code == 201
    assert response.json()["threshold"] == 0


def test_create_threshold_negative_returns_422(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory", json={"ean": "1", "quantity": 2, "threshold": -1}
    )
    assert response.status_code == 422


def test_patch_null_quantity_returns_422(client, tracked) -> None:
    response = client.patch(f"/api/inventory/{tracked}", json={"quantity": None})
    assert response.status_code == 422


def test_patch_null_threshold_returns_422(client, tracked) -> None:
    response = client.patch(f"/api/inventory/{tracked}", json={"threshold": None})
    assert response.status_code == 422


def test_patch_null_unit_returns_422(client, tracked) -> None:
    response = client.patch(f"/api/inventory/{tracked}", json={"unit": None})
    assert response.status_code == 422


def test_create_notes_are_trimmed(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 5, "threshold": 1, "notes": "  Hay 5 muslitos  "},
    )
    assert response.json()["notes"] == "Hay 5 muslitos"


def test_create_blank_notes_are_stored_as_null(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 5, "threshold": 1, "notes": "   "},
    )
    assert response.json()["notes"] is None


def test_create_notes_of_500_characters_are_accepted(client, seed_product) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 5, "threshold": 1, "notes": "x" * 500},
    )
    assert response.status_code == 201


def test_create_notes_longer_than_500_characters_returns_422(
    client, seed_product
) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 5, "threshold": 1, "notes": "x" * 501},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("drawer", [0, 5])
def test_create_drawer_outside_one_to_four_returns_422(
    client, seed_product, drawer: int
) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={
            "ean": "1",
            "quantity": 1,
            "threshold": 1,
            "location": "freezer",
            "drawer": drawer,
        },
    )
    assert response.status_code == 422


def test_list_zero_threshold_item_is_low_only_when_empty(client, seed_product) -> None:
    seed_product(ean="1", name="Hamburguesa")
    seed_product(ean="2", name="Pan")
    client.post("/api/inventory", json={"ean": "1", "quantity": 0, "threshold": 0})
    client.post("/api/inventory", json={"ean": "2", "quantity": 0.5, "threshold": 0})
    flags = {
        row["product"]["name"]: row["low"]
        for row in client.get("/api/inventory").json()
    }
    assert flags == {"Hamburguesa": True, "Pan": False}


def test_shopping_list_includes_empty_zero_threshold_item(client, seed_product) -> None:
    seed_product(ean="1", name="Hamburguesa")
    client.post("/api/inventory", json={"ean": "1", "quantity": 0, "threshold": 0})
    names = [row["name"] for row in client.get("/api/shopping-list").json()]
    assert names == ["Hamburguesa"]
