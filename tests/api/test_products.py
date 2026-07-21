def test_create_and_get_product(client) -> None:
    payload = {"ean": "5", "name": "Rice", "brand": "ACME"}
    created = client.post("/api/products", json=payload)
    assert created.status_code == 201
    assert created.json()["source"] == "manual"

    fetched = client.get("/api/products/5")
    assert fetched.status_code == 200
    assert fetched.json()["brand"] == "ACME"


def test_patch_product(client) -> None:
    client.post("/api/products", json={"ean": "5", "name": "Rice"})
    patched = client.patch("/api/products/5", json={"name": "Brown Rice"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Brown Rice"


def test_get_missing_product_404(client) -> None:
    assert client.get("/api/products/nope").status_code == 404
