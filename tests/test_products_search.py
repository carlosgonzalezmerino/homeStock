import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client_with_products(client: TestClient, seed_product):
    seed_product(ean="111", name="Leche Entera", source="manual")
    seed_product(ean="222", name="Aceite de Oliva", source="manual")
    seed_product(ean="333", name="Pollo Fresco", source="manual")
    return client


def test_search_returns_matching_products(client_with_products):
    resp = client_with_products.get("/api/products?q=leche")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Leche Entera"


def test_search_is_case_insensitive(client_with_products):
    resp = client_with_products.get("/api/products?q=LECHE")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_search_partial_match(client_with_products):
    resp = client_with_products.get("/api/products?q=ace")
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "Aceite de Oliva"


def test_search_empty_q_returns_empty(client_with_products):
    resp = client_with_products.get("/api/products?q=")
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_no_match_returns_empty(client_with_products):
    resp = client_with_products.get("/api/products?q=zzznomatch")
    assert resp.status_code == 200
    assert resp.json() == []


def test_search_limit_respected(client, seed_product):
    for i in range(25):
        seed_product(ean=str(i).zfill(13), name=f"Producto {i}", source="manual")
    resp = client.get("/api/products?q=producto")
    assert resp.status_code == 200
    assert len(resp.json()) <= 20
