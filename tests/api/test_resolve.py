def test_resolve_local_hit(client, seed_product) -> None:
    seed_product(ean="1", name="Milk")
    response = client.get("/api/resolve/1")
    assert response.status_code == 200
    assert response.json()["name"] == "Milk"


def test_resolve_miss_returns_404_with_ean(client) -> None:
    response = client.get("/api/resolve/999")
    assert response.status_code == 404
    assert response.json() == {"ean": "999"}
