import pytest


def _track(client, seed_product, quantity=3, ean="1"):
    seed_product(ean=ean, name="Milk")
    client.post(
        "/api/inventory", json={"ean": ean, "quantity": quantity, "threshold": 1}
    )


def _diary(client, **params):
    return client.get("/api/movements", params=params).json()


def test_tracking_a_product_records_an_initial_movement(client, seed_product) -> None:
    _track(client, seed_product)
    (movement,) = _diary(client)
    assert (movement["reason"], movement["delta"], movement["source"]) == (
        "initial",
        3,
        "app",
    )
    assert movement["undone"] is False


def test_patching_the_quantity_records_the_reason_and_source(
    client, seed_product
) -> None:
    _track(client, seed_product)
    response = client.patch(
        "/api/inventory/1",
        json={"quantity": 2, "reason": "consume"},
        headers={"X-HomeStock-Source": "scan"},
    )
    assert response.status_code == 200
    latest = _diary(client)[0]
    assert (latest["reason"], latest["delta"], latest["source"]) == (
        "consume",
        -1,
        "scan",
    )


def test_patching_the_reason_does_not_leak_it_into_the_stock_row(
    client, seed_product
) -> None:
    _track(client, seed_product)
    response = client.patch(
        "/api/inventory/1", json={"quantity": 4, "reason": "purchase"}
    )
    assert "reason" not in response.json()
    assert client.get("/api/inventory").json()[0]["inventory"]["quantity"] == 4


def test_patching_the_quantity_without_a_reason_is_an_adjustment(
    client, seed_product
) -> None:
    _track(client, seed_product)
    client.patch("/api/inventory/1", json={"quantity": 9})
    assert _diary(client)[0]["reason"] == "adjust"


def test_patching_something_else_records_nothing(client, seed_product) -> None:
    _track(client, seed_product)
    client.patch("/api/inventory/1", json={"threshold": 7, "notes": "x"})
    assert len(_diary(client)) == 1


@pytest.mark.parametrize("reason", ["initial", "removed", "nonsense"])
def test_patching_a_reason_the_server_decides_is_rejected(
    client, seed_product, reason
) -> None:
    _track(client, seed_product)
    response = client.patch("/api/inventory/1", json={"quantity": 1, "reason": reason})
    assert response.status_code == 422


@pytest.mark.parametrize("source", ["migration", "undo", "nonsense"])
def test_a_source_the_server_writes_itself_is_rejected(
    client, seed_product, source
) -> None:
    _track(client, seed_product)
    response = client.patch(
        "/api/inventory/1",
        json={"quantity": 1},
        headers={"X-HomeStock-Source": source},
    )
    assert response.status_code == 422


def test_deleting_a_stocked_product_records_a_removed_movement(
    client, seed_product
) -> None:
    _track(client, seed_product)
    client.delete("/api/inventory/1")
    latest = _diary(client)[0]
    assert (latest["reason"], latest["delta"], latest["quantity_after"]) == (
        "removed",
        -3,
        0,
    )


def test_list_filters_by_product_and_by_reason(client, seed_product) -> None:
    _track(client, seed_product, ean="1")
    _track(client, seed_product, ean="2")
    client.patch("/api/inventory/1", json={"quantity": 1, "reason": "consume"})
    assert {m["ean"] for m in _diary(client, ean="1")} == {"1"}
    assert [m["reason"] for m in _diary(client, reason="consume")] == ["consume"]


def test_list_paginates(client, seed_product) -> None:
    _track(client, seed_product)
    for quantity in (4, 5, 6):
        client.patch("/api/inventory/1", json={"quantity": quantity})
    assert len(_diary(client, limit=2)) == 2
    assert len(_diary(client, limit=10, offset=3)) == 1


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 201}, {"offset": -1}])
def test_list_rejects_out_of_range_paging(client, params) -> None:
    assert client.get("/api/movements", params=params).status_code == 422


def test_last_is_null_when_the_diary_is_empty(client) -> None:
    response = client.get("/api/movements/last")
    assert (response.status_code, response.json()) == (200, None)


def test_last_returns_the_most_recent_movement(client, seed_product) -> None:
    _track(client, seed_product)
    client.patch("/api/inventory/1", json={"quantity": 8, "reason": "purchase"})
    assert client.get("/api/movements/last").json()["quantity_after"] == 8


def test_undo_restores_the_stock_and_marks_the_original(client, seed_product) -> None:
    _track(client, seed_product)
    client.patch("/api/inventory/1", json={"quantity": 5, "reason": "purchase"})
    purchase = _diary(client)[0]
    response = client.post(f"/api/movements/{purchase['id']}/undo")
    assert response.status_code == 200
    assert response.json()["undoes_id"] == purchase["id"]
    assert client.get("/api/inventory").json()[0]["inventory"]["quantity"] == 3
    undone = {m["id"]: m["undone"] for m in _diary(client)}
    assert undone[purchase["id"]] is True


def test_undo_twice_answers_conflict_with_the_reason(client, seed_product) -> None:
    _track(client, seed_product)
    client.patch("/api/inventory/1", json={"quantity": 5, "reason": "purchase"})
    purchase_id = _diary(client)[0]["id"]
    client.post(f"/api/movements/{purchase_id}/undo")
    second = client.post(f"/api/movements/{purchase_id}/undo")
    assert second.status_code == 409
    assert second.json()["detail"]["reason"] == "already_undone"


def test_undo_an_unknown_movement_answers_not_found(client) -> None:
    assert client.post("/api/movements/999/undo").status_code == 404


def test_undo_after_the_product_was_removed_answers_conflict(
    client, seed_product
) -> None:
    _track(client, seed_product)
    client.patch("/api/inventory/1", json={"quantity": 5, "reason": "purchase"})
    purchase_id = _diary(client)[0]["id"]
    client.delete("/api/inventory/1")
    response = client.post(f"/api/movements/{purchase_id}/undo")
    assert (response.status_code, response.json()["detail"]["reason"]) == (
        409,
        "not_tracked",
    )


def test_undo_that_would_change_nothing_answers_conflict(client, seed_product) -> None:
    _track(client, seed_product, quantity=1)
    client.patch("/api/inventory/1", json={"quantity": 2, "reason": "purchase"})
    purchase_id = _diary(client)[0]["id"]
    client.patch("/api/inventory/1", json={"quantity": 0, "reason": "consume"})
    response = client.post(f"/api/movements/{purchase_id}/undo")
    assert (response.status_code, response.json()["detail"]["reason"]) == (
        409,
        "nothing_to_undo",
    )
