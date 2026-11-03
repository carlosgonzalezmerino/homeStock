def test_create_product_with_existing_ean_returns_409(client, seed_product) -> None:
    seed_product(ean="5", name="Arroz")
    response = client.post("/api/products", json={"ean": "5", "name": "Otro arroz"})
    assert response.status_code == 409
    assert response.json()["detail"] == {"ean": "5"}


def test_create_product_with_existing_ean_keeps_original_name(
    client, seed_product
) -> None:
    seed_product(ean="5", name="Arroz")
    client.post("/api/products", json={"ean": "5", "name": "Otro arroz"})
    assert client.get("/api/products/5").json()["name"] == "Arroz"
