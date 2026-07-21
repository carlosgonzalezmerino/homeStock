def test_track_list_patch_delete_flow(client, seed_product) -> None:
    seed_product(ean="1", name="Milk")

    created = client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 3, "threshold": 1, "unit": "L"},
    )
    assert created.status_code == 201

    listing = client.get("/api/inventory")
    assert listing.status_code == 200
    body = listing.json()
    assert len(body) == 1
    assert body[0]["product"]["name"] == "Milk"
    assert body[0]["low"] is False

    patched = client.patch("/api/inventory/1", json={"quantity": 0})
    assert patched.status_code == 200
    assert patched.json()["quantity"] == 0

    low = client.get("/api/inventory", params={"low": "true"})
    assert len(low.json()) == 1  # now at/under threshold

    deleted = client.delete("/api/inventory/1")
    assert deleted.status_code == 204
    assert client.get("/api/inventory").json() == []


def test_track_unknown_product_404(client) -> None:
    response = client.post(
        "/api/inventory", json={"ean": "ghost", "quantity": 1, "threshold": 1}
    )
    assert response.status_code == 404


def test_track_twice_409(client, seed_product) -> None:
    seed_product(ean="1")
    client.post("/api/inventory", json={"ean": "1", "quantity": 1, "threshold": 1})
    dup = client.post(
        "/api/inventory", json={"ean": "1", "quantity": 2, "threshold": 1}
    )
    assert dup.status_code == 409
