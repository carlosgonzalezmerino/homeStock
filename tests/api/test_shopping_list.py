import pytest


def _add(client, ean="1", **extra):
    return client.post("/api/shopping-list", json={"ean": ean, **extra})


def _list(client):
    return client.get("/api/shopping-list").json()


def _track(client, ean="1", quantity=3, threshold=1):
    client.post(
        "/api/inventory",
        json={"ean": ean, "quantity": quantity, "threshold": threshold},
    )


def test_list_starts_empty(client) -> None:
    assert client.get("/api/shopping-list").json() == []


def test_list_holds_only_what_was_added_never_the_low_stock(
    client, seed_product
) -> None:
    seed_product(ean="1", name="Out of stock")
    seed_product(ean="2", name="Low")
    seed_product(ean="3", name="Added")
    _track(client, "1", quantity=0, threshold=2)
    _track(client, "2", quantity=1, threshold=5)
    _add(client, "3")
    assert [row["name"] for row in _list(client)] == ["Added"]


def test_add_creates_the_line_with_quantity_one_and_unchecked(
    client, seed_product
) -> None:
    seed_product(ean="1", name="Milk")
    response = _add(client)
    assert response.status_code == 201
    body = response.json()
    assert (body["ean"], body["name"], body["quantity"], body["checked"]) == (
        "1",
        "Milk",
        1,
        False,
    )


def test_add_with_a_quantity_keeps_it(client, seed_product) -> None:
    seed_product(ean="1")
    assert _add(client, quantity=2.5).json()["quantity"] == 2.5


def test_add_a_product_already_there_sums_and_answers_200(client, seed_product) -> None:
    seed_product(ean="1")
    _add(client, quantity=1)
    response = _add(client, quantity=2)
    assert (response.status_code, response.json()["quantity"]) == (200, 3)
    assert len(_list(client)) == 1


def test_add_an_ean_that_is_not_in_the_catalogue_answers_404(client) -> None:
    response = _add(client, "ghost")
    assert (response.status_code, response.json()["detail"]) == (404, {"ean": "ghost"})


@pytest.mark.parametrize("quantity", [0, -1, 0.001, 1.234, "NaN"])
def test_add_rejects_an_invalid_quantity(client, seed_product, quantity) -> None:
    seed_product(ean="1")
    assert _add(client, quantity=quantity).status_code == 422


def test_add_a_product_that_is_not_in_the_pantry_is_allowed(
    client, seed_product
) -> None:
    seed_product(ean="1")
    body = _add(client).json()
    assert (body["in_stock"], body["unit"]) == (None, "units")


def test_list_shows_the_stock_and_unit_of_the_pantry(client, seed_product) -> None:
    seed_product(ean="1")
    client.post(
        "/api/inventory",
        json={"ean": "1", "quantity": 2, "threshold": 1, "unit": "L"},
    )
    _add(client)
    row = _list(client)[0]
    assert (row["in_stock"], row["unit"]) == (2, "L")


def test_patch_changes_the_quantity(client, seed_product) -> None:
    seed_product(ean="1")
    _add(client)
    response = client.patch("/api/shopping-list/1", json={"quantity": 4})
    assert (response.status_code, response.json()["quantity"]) == (200, 4)


def test_patch_changes_the_checked_mark_and_it_persists(client, seed_product) -> None:
    seed_product(ean="1")
    _add(client)
    client.patch("/api/shopping-list/1", json={"checked": True})
    assert _list(client)[0]["checked"] is True


@pytest.mark.parametrize(
    "payload",
    [{"quantity": None}, {"checked": None}, {"quantity": 0}, {"quantity": 1.234}],
)
def test_patch_rejects_nulls_and_invalid_quantities(
    client, seed_product, payload
) -> None:
    seed_product(ean="1")
    _add(client)
    assert client.patch("/api/shopping-list/1", json=payload).status_code == 422


def test_patch_a_product_not_on_the_list_answers_404(client) -> None:
    assert (
        client.patch("/api/shopping-list/1", json={"checked": True}).status_code == 404
    )


def test_delete_takes_the_product_off_the_list(client, seed_product) -> None:
    seed_product(ean="1")
    _add(client)
    assert client.delete("/api/shopping-list/1").status_code == 204
    assert _list(client) == []


def test_delete_a_product_not_on_the_list_answers_404(client) -> None:
    assert client.delete("/api/shopping-list/1").status_code == 404


def test_purchase_adds_picked_lines_to_the_stock_and_clears_them(
    client, seed_product
) -> None:
    seed_product(ean="1", name="Milk")
    _track(client, "1", quantity=3)
    _add(client, quantity=2)
    client.patch("/api/shopping-list/1", json={"checked": True})
    response = client.post("/api/shopping-list/purchase")
    assert (response.status_code, response.json()) == (200, {"added": 1, "created": 0})
    assert client.get("/api/inventory").json()[0]["inventory"]["quantity"] == 5
    assert _list(client) == []


def test_purchase_creates_a_product_that_was_not_in_the_pantry(
    client, seed_product
) -> None:
    seed_product(ean="1")
    _add(client, quantity=2)
    client.patch("/api/shopping-list/1", json={"checked": True})
    assert client.post("/api/shopping-list/purchase").json() == {
        "added": 1,
        "created": 1,
    }
    stock = client.get("/api/inventory").json()[0]["inventory"]
    assert (stock["quantity"], stock["threshold"]) == (2, 0)


def test_purchase_leaves_unpicked_lines_alone(client, seed_product) -> None:
    seed_product(ean="1")
    seed_product(ean="2")
    _add(client, "1")
    _add(client, "2")
    client.patch("/api/shopping-list/1", json={"checked": True})
    client.post("/api/shopping-list/purchase")
    assert [row["ean"] for row in _list(client)] == ["2"]


def test_purchase_with_nothing_picked_answers_zeros_and_writes_nothing(
    client, seed_product
) -> None:
    seed_product(ean="1")
    _add(client)
    assert client.post("/api/shopping-list/purchase").json() == {
        "added": 0,
        "created": 0,
    }
    assert client.get("/api/inventory").json() == []
    assert len(_list(client)) == 1


def test_purchase_is_recorded_in_the_diary_as_a_shopping_list_purchase(
    client, seed_product
) -> None:
    seed_product(ean="1")
    _track(client, "1", quantity=3)
    _add(client, quantity=2)
    client.patch("/api/shopping-list/1", json={"checked": True})
    client.post("/api/shopping-list/purchase")
    latest = client.get("/api/movements").json()[0]
    assert (latest["reason"], latest["source"], latest["delta"]) == (
        "purchase",
        "shopping_list",
        2,
    )
