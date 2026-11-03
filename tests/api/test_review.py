from datetime import datetime, timedelta

import pytest

from app.services import review as review_module

NOW = datetime(2026, 11, 3, 12, 0)


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch):
    """Lets a test move the review's clock forward."""
    state = {"now": datetime.now()}
    monkeypatch.setattr(review_module, "utc_now", lambda: state["now"])
    return state


def _track(client, seed_product, ean="1"):
    seed_product(ean=ean, name="Milk")
    client.post("/api/inventory", json={"ean": ean, "quantity": 2, "threshold": 1})


def test_review_is_empty_on_a_fresh_database(client) -> None:
    response = client.get("/api/review")
    assert (response.status_code, response.json()) == (200, [])


def test_review_is_empty_for_a_product_added_today(client, seed_product, clock) -> None:
    _track(client, seed_product)
    assert client.get("/api/review").json() == []


def test_review_asks_about_a_product_nobody_touched_for_two_months(
    client, seed_product, clock
) -> None:
    _track(client, seed_product)
    clock["now"] += timedelta(days=61)
    (card,) = client.get("/api/review").json()
    assert (card["ean"], card["name"], card["reason"]) == ("1", "Milk", "stale")
    assert (card["quantity"], card["estimated_empty_on"]) == (2, None)
    assert card["days_since_activity"] >= 60


def test_confirm_takes_the_product_out_of_the_review(
    client, seed_product, clock
) -> None:
    _track(client, seed_product)
    clock["now"] += timedelta(days=61)
    assert client.post("/api/review/1/confirm").status_code == 204
    assert client.get("/api/review").json() == []


def test_confirm_writes_no_movement(client, seed_product) -> None:
    _track(client, seed_product)
    client.post("/api/review/1/confirm")
    assert len(client.get("/api/movements").json()) == 1  # only the initial one


def test_confirm_of_an_untracked_product_answers_not_found(client) -> None:
    assert client.post("/api/review/nope/confirm").status_code == 404
