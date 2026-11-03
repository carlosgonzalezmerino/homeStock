from datetime import datetime, timedelta

import pytest
from sqlmodel import Session

from app.constants import REASON_CONSUME, REASON_PURCHASE
from app.db import create_db_and_tables, get_engine
from app.models import Product, StockMovement
from app.repositories.movements import MovementRepository

NOW = datetime(2026, 11, 3, 12, 0)


@pytest.fixture
def repo() -> MovementRepository:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    session.add(Product(ean="a", name="A", source="manual"))
    session.add(Product(ean="b", name="B", source="manual"))
    session.commit()
    return MovementRepository(session)


def _add(repo, ean="a", delta=1.0, reason=REASON_PURCHASE, days_ago=0.0, **extra):
    return repo.add(
        StockMovement(
            ean=ean,
            delta=delta,
            quantity_after=delta,
            reason=reason,
            source="app",
            created_at=NOW - timedelta(days=days_ago),
            **extra,
        )
    )


def test_add_stores_and_get_finds_it(repo: MovementRepository) -> None:
    movement = _add(repo)
    assert repo.get(movement.id).ean == "a"


def test_get_unknown_id_returns_none(repo: MovementRepository) -> None:
    assert repo.get(404) is None


def test_find_orders_the_most_recent_first(repo: MovementRepository) -> None:
    old, new = _add(repo, days_ago=2), _add(repo, days_ago=1)
    assert [m.id for m in repo.find(None, None, 10, 0)] == [new.id, old.id]


def test_find_filters_by_product_and_by_reason(repo: MovementRepository) -> None:
    _add(repo, "a")
    _add(repo, "b", reason=REASON_CONSUME)
    assert [m.ean for m in repo.find("b", None, 10, 0)] == ["b"]
    assert [m.reason for m in repo.find(None, REASON_CONSUME, 10, 0)] == [
        REASON_CONSUME
    ]


def test_find_applies_limit_and_offset(repo: MovementRepository) -> None:
    for days in (3, 2, 1):
        _add(repo, days_ago=days)
    assert len(repo.find(None, None, 2, 0)) == 2
    assert len(repo.find(None, None, 10, 2)) == 1


def test_last_returns_the_newest_or_none(repo: MovementRepository) -> None:
    assert repo.last() is None
    newest = _add(repo, days_ago=0)
    _add(repo, days_ago=5)
    assert repo.last().id == newest.id


def test_undone_ids_returns_only_the_movements_that_were_reverted(
    repo: MovementRepository,
) -> None:
    first, second = _add(repo), _add(repo)
    _add(repo, delta=-1, undoes_id=first.id)
    assert repo.undone_ids([first.id, second.id]) == {first.id}
    assert repo.undone_ids([]) == set()


def test_consumption_since_sums_only_consume_movements_inside_the_window(
    repo: MovementRepository,
) -> None:
    _add(repo, delta=-2, reason=REASON_CONSUME, days_ago=10)
    _add(repo, delta=-1, reason=REASON_CONSUME, days_ago=5)
    _add(repo, delta=-9, reason=REASON_CONSUME, days_ago=200)  # outside the window
    _add(repo, delta=4, reason=REASON_PURCHASE, days_ago=5)  # not a consumption
    stats = repo.consumption_since(NOW - timedelta(days=90))["a"]
    assert (stats.consumed, stats.events) == (3, 2)
    assert stats.first_at == NOW - timedelta(days=10)


def test_consumption_since_ignores_products_that_consumed_nothing(
    repo: MovementRepository,
) -> None:
    _add(repo, "b")
    assert repo.consumption_since(NOW - timedelta(days=90)) == {}


def test_last_activity_gives_each_products_latest_moment(
    repo: MovementRepository,
) -> None:
    _add(repo, "a", days_ago=9)
    _add(repo, "a", days_ago=2)
    _add(repo, "b", days_ago=4)
    assert repo.last_activity() == {
        "a": NOW - timedelta(days=2),
        "b": NOW - timedelta(days=4),
    }


def test_balances_sum_the_deltas_per_product(repo: MovementRepository) -> None:
    _add(repo, "a", delta=5)
    _add(repo, "a", delta=-2)
    _add(repo, "b", delta=1)
    assert repo.balances() == {"a": 3, "b": 1}
