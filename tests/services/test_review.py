from datetime import datetime, timedelta

import pytest
from sqlmodel import Session

from app.constants import MAX_REVIEW_CARDS, REASON_CONSUME, REASON_INITIAL
from app.models import InventoryItem, Product, StockMovement
from app.repositories.inventory import InventoryRepository
from app.repositories.movements import MovementRepository
from app.repositories.products import ProductRepository
from app.services import review as review_module
from app.services.review import ReviewService

NOW = datetime(2026, 11, 3, 12, 0)
LONG_AGO = NOW - timedelta(days=400)


@pytest.fixture(autouse=True)
def fixed_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    """Freezes the review's clock so every history means the same thing every day."""
    monkeypatch.setattr(review_module, "utc_now", lambda: NOW)


@pytest.fixture
def review(session: Session, movements: MovementRepository) -> ReviewService:
    return ReviewService(
        InventoryRepository(session), ProductRepository(session), movements
    )


def _days_ago(days: float) -> datetime:
    return NOW - timedelta(days=days)


def _item(
    session: Session,
    ean: str,
    quantity: float = 2,
    created: datetime = LONG_AGO,
    location: str | None = None,
) -> None:
    """Adds a product and its stock row, created at a chosen time."""
    if session.get(Product, ean) is None:
        session.add(Product(ean=ean, name=f"Product {ean}", source="manual"))
    session.add(
        InventoryItem(
            ean=ean,
            quantity=quantity,
            threshold=1,
            location=location,
            created_at=created,
            updated_at=created,
        )
    )
    session.commit()


def _consumed(session: Session, ean: str, *days_ago: float) -> None:
    """Records one consumed unit for each of the given moments."""
    for days in days_ago:
        session.add(
            StockMovement(
                ean=ean,
                delta=-1,
                quantity_after=0,
                reason=REASON_CONSUME,
                source="app",
                created_at=_days_ago(days),
            )
        )
    session.commit()


def _eans(review: ReviewService) -> list[str]:
    return [candidate.item.ean for candidate in review.candidates()]


def test_candidates_flags_overdue_when_the_pace_says_it_ran_out(
    session: Session, review: ReviewService
) -> None:
    # 3 units in 40 days = 0.075/day; 1 left since day -20 lasts 13 days: gone day -7.
    _item(session, "a", quantity=1)
    _consumed(session, "a", 40, 30, 20)
    (candidate,) = review.candidates()
    assert (candidate.reason, candidate.item.ean) == ("overdue", "a")
    assert candidate.estimated_empty_on < NOW.date()


def test_candidates_does_not_flag_a_product_that_still_lasts_by_its_pace(
    session: Session, review: ReviewService
) -> None:
    # Same pace, but 5 units left from day -20: they last 66 days.
    _item(session, "a", quantity=5)
    _consumed(session, "a", 40, 30, 20)
    assert _eans(review) == []


def test_candidates_needs_three_consumptions_to_call_it_a_pace(
    session: Session, review: ReviewService
) -> None:
    _item(session, "a", quantity=1, created=_days_ago(10))
    _consumed(session, "a", 9, 8)
    assert _eans(review) == []


def test_candidates_uses_at_least_seven_days_to_measure_the_pace(
    session: Session, review: ReviewService
) -> None:
    # Three units in one day would be 3/day. With the 7-day floor it is 3/7 = 0.43/day,
    # so 1 left runs out 2.3 days after day -1: not yet overdue.
    _item(session, "a", quantity=1, created=_days_ago(2))
    _consumed(session, "a", 1, 1, 1)
    assert _eans(review) == []


def test_candidates_flags_stale_after_sixty_idle_days_without_a_pace(
    session: Session, review: ReviewService
) -> None:
    _item(session, "a", created=_days_ago(61))
    _item(session, "b", created=_days_ago(59))
    (candidate,) = review.candidates()
    assert (candidate.item.ean, candidate.reason) == ("a", "stale")
    assert candidate.estimated_empty_on is None
    assert candidate.days_since_activity == 61


def test_candidates_never_flags_a_freezer_product_as_stale(
    session: Session, review: ReviewService
) -> None:
    _item(session, "a", created=_days_ago(300), location="freezer")
    assert _eans(review) == []


def test_candidates_never_flags_a_product_with_a_pace_as_stale(
    session: Session, review: ReviewService
) -> None:
    # Idle for 65 days would be stale, but the pace (3 units in 85 days) says 40 units
    # last over three years, so the pace wins and nothing is asked.
    _item(session, "a", quantity=40, created=LONG_AGO)
    _consumed(session, "a", 85, 75, 65)
    assert _eans(review) == []


def test_candidates_skips_products_without_stock(
    session: Session, review: ReviewService
) -> None:
    _item(session, "a", quantity=0, created=_days_ago(200))
    assert _eans(review) == []


def test_candidates_puts_overdue_before_stale_and_the_most_overdue_first(
    session: Session, review: ReviewService
) -> None:
    _item(session, "stale", created=_days_ago(100))
    _item(session, "late", quantity=1)
    _consumed(session, "late", 40, 30, 20)
    _item(session, "later", quantity=1)
    _consumed(session, "later", 80, 70, 60)
    assert _eans(review) == ["later", "late", "stale"]


def test_candidates_returns_at_most_the_card_limit(
    session: Session, review: ReviewService
) -> None:
    for number in range(MAX_REVIEW_CARDS + 5):
        _item(session, f"s{number:02d}", created=_days_ago(100 + number))
    assert len(review.candidates()) == MAX_REVIEW_CARDS


def test_candidates_on_a_fresh_database_with_only_initial_movements_is_empty(
    session: Session, review: ReviewService
) -> None:
    _item(session, "a", created=_days_ago(3))
    session.add(
        StockMovement(
            ean="a", delta=2, quantity_after=2, reason=REASON_INITIAL,
            source="migration", created_at=_days_ago(3),
        )
    )  # fmt: skip
    session.commit()
    assert _eans(review) == []


def test_confirm_marks_the_product_and_takes_it_out_of_the_next_review(
    session: Session, review: ReviewService
) -> None:
    _item(session, "a", created=_days_ago(100))
    assert review.confirm("a") is True
    assert _eans(review) == []


def test_confirm_writes_no_movement(
    session: Session, review: ReviewService, movements: MovementRepository
) -> None:
    _item(session, "a", created=_days_ago(100))
    review.confirm("a")
    assert movements.find("a", None, 10, 0) == []


def test_confirm_of_an_untracked_product_returns_false(review: ReviewService) -> None:
    assert review.confirm("nope") is False


def test_candidates_counts_a_recent_movement_as_activity(
    session: Session, review: ReviewService
) -> None:
    _item(session, "a", created=_days_ago(100))
    session.add(
        StockMovement(
            ean="a", delta=1, quantity_after=3, reason="purchase",
            source="app", created_at=_days_ago(5),
        )
    )  # fmt: skip
    session.commit()
    assert _eans(review) == []
