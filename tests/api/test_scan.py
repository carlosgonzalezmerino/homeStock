import pytest


def _scan(client, ean="1", mode="purchase", **extra):
    return client.post("/api/scan", json={"ean": ean, "mode": mode, **extra})


def _stock(client):
    return {
        row["inventory"]["ean"]: row["inventory"]
        for row in client.get("/api/inventory").json()
    }


def test_scan_purchase_of_a_known_untracked_product_creates_it(
    client, seed_product
) -> None:
    seed_product(ean="1", name="Milk")
    body = _scan(client).json()
    assert (body["status"], body["name"], body["quantity_after"]) == (
        "created",
        "Milk",
        1,
    )
    assert body["movement_id"] is not None
    assert _stock(client)["1"]["threshold"] == 2


def test_scan_purchase_twice_adds_one_each_time(client, seed_product) -> None:
    seed_product(ean="1")
    _scan(client)
    second = _scan(client).json()
    assert (second["status"], second["quantity_before"], second["quantity_after"]) == (
        "applied",
        1,
        2,
    )


def test_scan_purchase_puts_a_new_product_where_the_client_says(
    client, seed_product
) -> None:
    seed_product(ean="1")
    _scan(client, location="freezer")
    assert _stock(client)["1"]["location"] == "freezer"


def test_scan_of_an_unknown_code_is_a_normal_answer_that_changes_nothing(
    client,
) -> None:
    response = _scan(client, ean="0000")
    assert response.status_code == 200
    assert response.json()["status"] == "unknown"
    assert _stock(client) == {}


def test_scan_consume_takes_one_unit_and_reports_the_low_flag(
    client, seed_product
) -> None:
    seed_product(ean="1")
    client.post("/api/inventory", json={"ean": "1", "quantity": 2, "threshold": 2})
    body = _scan(client, mode="consume").json()
    assert (body["status"], body["quantity_after"], body["low"]) == ("applied", 1, True)


def test_scan_consume_to_zero_puts_the_product_on_the_shopping_list(
    client, seed_product
) -> None:
    seed_product(ean="1", name="Milk")
    client.post("/api/inventory", json={"ean": "1", "quantity": 1, "threshold": 0})
    _scan(client, mode="consume")
    assert [line["ean"] for line in client.get("/api/shopping-list").json()] == ["1"]


def test_scan_consume_of_an_untracked_product_does_not_create_it(
    client, seed_product
) -> None:
    seed_product(ean="1")
    assert _scan(client, mode="consume").json()["status"] == "not_tracked"
    assert _stock(client) == {}


def test_scan_consume_of_an_empty_product_reports_it(client, seed_product) -> None:
    seed_product(ean="1")
    client.post("/api/inventory", json={"ean": "1", "quantity": 0, "threshold": 1})
    body = _scan(client, mode="consume").json()
    assert (body["status"], body["movement_id"]) == ("already_empty", None)


def test_scan_records_scan_as_the_default_source_and_honours_the_header(
    client, seed_product
) -> None:
    seed_product(ean="1")
    _scan(client)
    client.post(
        "/api/scan",
        json={"ean": "1", "mode": "consume"},
        headers={"X-HomeStock-Source": "device"},
    )
    sources = [m["source"] for m in client.get("/api/movements").json()]
    assert sources == ["device", "scan"]


def test_undoing_a_scan_that_created_a_product_stops_tracking_it(
    client, seed_product
) -> None:
    seed_product(ean="1")
    movement_id = _scan(client).json()["movement_id"]
    assert client.post(f"/api/movements/{movement_id}/undo").status_code == 200
    assert _stock(client) == {}


def test_undoing_a_scan_that_consumed_gives_the_unit_back(client, seed_product) -> None:
    seed_product(ean="1")
    client.post("/api/inventory", json={"ean": "1", "quantity": 3, "threshold": 1})
    movement_id = _scan(client, mode="consume").json()["movement_id"]
    client.post(f"/api/movements/{movement_id}/undo")
    assert _stock(client)["1"]["quantity"] == 3


@pytest.mark.parametrize(
    "payload",
    [
        {"ean": "1", "mode": "waste"},
        {"ean": "", "mode": "purchase"},
        {"ean": "1"},
        {"ean": "1", "mode": "purchase", "location": "garage"},
    ],
)
def test_scan_rejects_an_invalid_request(client, payload) -> None:
    assert client.post("/api/scan", json=payload).status_code == 422
