import pytest

from app import db as db_module
from app.models import OffProduct

UNKNOWN = "9999999999999"


def test_patch_inventory_unknown_ean_returns_404(client) -> None:
    response = client.patch(f"/api/inventory/{UNKNOWN}", json={"quantity": 1})
    assert response.status_code == 404
    assert response.json()["detail"] == {"ean": UNKNOWN}


def test_delete_inventory_unknown_ean_returns_404(client) -> None:
    assert client.delete(f"/api/inventory/{UNKNOWN}").status_code == 404


def test_patch_product_unknown_ean_returns_404(client) -> None:
    response = client.patch(f"/api/products/{UNKNOWN}", json={"name": "Nada"})
    assert response.status_code == 404


@pytest.mark.parametrize("location", ["garage", "Freezer", ""])
def test_create_inventory_unknown_location_returns_422(
    client, seed_product, location: str
) -> None:
    seed_product(ean="1")
    response = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 1, "threshold": 1, "location": location},
    )
    assert response.status_code == 422


def test_patch_inventory_unknown_location_returns_422(client, seed_product) -> None:
    seed_product(ean="1")
    client.post("/api/inventory", json={"ean": "1", "quantity": 1, "threshold": 1})
    response = client.patch("/api/inventory/1", json={"location": "garage"})
    assert response.status_code == 422


def test_patch_inventory_ignores_fields_that_are_not_sent(client, seed_product) -> None:
    seed_product(ean="1")
    client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 4, "threshold": 2, "unit": "L"},
    )
    patched = client.patch("/api/inventory/1", json={"quantity": 3}).json()
    assert (patched["quantity"], patched["threshold"], patched["unit"]) == (3, 2, "L")


def test_list_inventory_low_filter_returns_only_low_items(client, seed_product) -> None:
    seed_product(ean="1", name="Leche")
    seed_product(ean="2", name="Pan")
    client.post("/api/inventory", json={"ean": "1", "quantity": 0, "threshold": 1})
    client.post("/api/inventory", json={"ean": "2", "quantity": 5, "threshold": 1})
    low = client.get("/api/inventory", params={"low": "true"}).json()
    assert [row["product"]["name"] for row in low] == ["Leche"]


def test_resolve_off_hit_returns_the_product_and_caches_it(client) -> None:
    for session in db_module.get_session():
        session.add(OffProduct(ean="5000112637922", name="Pasta", brand="ACME"))
        session.commit()
    first = client.get("/api/resolve/5000112637922")
    assert (first.status_code, first.json()["name"]) == (200, "Pasta")
    assert client.get("/api/products/5000112637922").json()["source"] == "openfoodfacts"
