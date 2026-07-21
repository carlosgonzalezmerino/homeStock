def test_shopping_list_lists_low_items(client, seed_product) -> None:
    seed_product(ean="milk", name="Milk")
    seed_product(ean="eggs", name="Eggs")
    client.post("/api/inventory", json={"ean": "milk", "quantity": 1, "threshold": 2})
    client.post("/api/inventory", json={"ean": "eggs", "quantity": 9, "threshold": 2})

    response = client.get("/api/shopping-list")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["name"] == "Milk"
