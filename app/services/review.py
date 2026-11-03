from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.constants import (
    MAX_REVIEW_CARDS,
    MIN_CONSUME_EVENTS,
    MIN_OBSERVED_DAYS,
    RATE_WINDOW_DAYS,
    REVIEW_OVERDUE,
    REVIEW_STALE,
    STALE_DAYS,
)
from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.movements import ConsumptionStats, MovementRepository
from app.repositories.products import ProductRepository
from app.services.inventory import is_freezer


def utc_now() -> datetime:
    """Returns the current time as the database stores it: UTC, without time zone.

    Returns:
        The current UTC time, naive. Tests replace this function to control the clock.
    """
    return datetime.now(UTC).replace(tzinfo=None)


def _naive_utc(moment: datetime) -> datetime:
    """Drops the time zone of a datetime after converting it to UTC.

    Args:
        moment: A naive datetime (assumed UTC) or an aware one.

    Returns:
        The same instant as a naive UTC datetime.
    """
    if moment.tzinfo is None:
        return moment
    return moment.astimezone(UTC).replace(tzinfo=None)


@dataclass(frozen=True)
class ReviewCandidate:
    """A product the weekly review asks about.

    Attributes:
        item: The stock row.
        product: Its catalogue entry.
        reason: `overdue` (should have run out) or `stale` (untouched for long).
        estimated_empty_on: When the pace says it runs out. Only for `overdue`.
        days_since_activity: Days since anything happened to the stock.
        sort_key: Moment used to order candidates of the same reason; older goes first.
    """

    item: InventoryItem
    product: Product
    reason: str
    estimated_empty_on: date | None
    days_since_activity: int
    sort_key: datetime


def _reference_moment(item: InventoryItem, last_movement: datetime | None) -> datetime:
    """Finds the last time anyone knew what the stock was.

    Args:
        item: The stock row.
        last_movement: The time of its latest movement, if it has any.

    Returns:
        The latest of: its last movement, its last confirmation and its creation.
    """
    moments = [_naive_utc(item.created_at)]
    if last_movement is not None:
        moments.append(_naive_utc(last_movement))
    if item.checked_at is not None:
        moments.append(_naive_utc(item.checked_at))
    return max(moments)


def _daily_rate(stats: ConsumptionStats | None, now: datetime) -> float | None:
    """Works out how many units a day a product is consumed.

    Args:
        stats: What the product consumed in the window, if anything.
        now: The current time.

    Returns:
        Units per day, or `None` when there are too few consumptions to call it a pace.
    """
    if stats is None or stats.events < MIN_CONSUME_EVENTS:
        return None
    observed_days = max((now - _naive_utc(stats.first_at)).days, MIN_OBSERVED_DAYS)
    rate = stats.consumed / observed_days
    return rate if rate > 0 else None


class ReviewService:
    """Decides which products are worth asking about in the weekly review."""

    def __init__(
        self,
        inventory: InventoryRepository,
        products: ProductRepository,
        movements: MovementRepository,
    ) -> None:
        """Creates the service.

        Args:
            inventory: Access to the stock rows.
            products: Access to the catalogue.
            movements: Access to the diary of stock changes.
        """
        self._inventory = inventory
        self._products = products
        self._movements = movements

    def candidates(self) -> list[ReviewCandidate]:
        """Lists up to `MAX_REVIEW_CARDS` products to ask about.

        Products that should have run out by the user's pace come first, the one
        overdue longest first. Then come those untouched for a long time.

        Returns:
            The candidates, in the order they should be asked.
        """
        now = utc_now()
        stats = self._movements.consumption_since(
            now - timedelta(days=RATE_WINDOW_DAYS)
        )
        activity = self._movements.last_activity()
        found: list[ReviewCandidate] = []
        for item in self._inventory.list_all():
            product = self._products.get(item.ean)
            if product is None or item.quantity <= 0:
                continue
            reference = _reference_moment(item, activity.get(item.ean))
            candidate = self._judge(item, product, stats.get(item.ean), reference, now)
            if candidate is not None:
                found.append(candidate)
        return _ordered(found)[:MAX_REVIEW_CARDS]

    def confirm(self, ean: str) -> bool:
        """Records that the stock of a product was checked and is real.

        No movement is written: nothing changed.

        Args:
            ean: The product's barcode.

        Returns:
            `True` when the product is tracked and was marked.
        """
        if self._inventory.get(ean) is None:
            return False
        self._inventory.update_fields(ean, {"checked_at": utc_now()})
        return True

    def _judge(
        self,
        item: InventoryItem,
        product: Product,
        stats: ConsumptionStats | None,
        reference: datetime,
        now: datetime,
    ) -> ReviewCandidate | None:
        """Decides whether one product should be asked about, and why.

        A product with a measurable pace is only asked about when it should have run
        out. One without a pace is asked about when it has not been touched for a long
        time, unless it is in the freezer, where sitting still is expected.

        Args:
            item: The stock row.
            product: Its catalogue entry.
            stats: What it consumed in the window.
            reference: The last time its stock was known.
            now: The current time.

        Returns:
            The candidate, or `None` when there is nothing to ask.
        """
        idle_days = (now - reference).days
        rate = _daily_rate(stats, now)
        if rate is not None:
            empty_at = reference + timedelta(days=item.quantity / rate)
            if empty_at > now:
                return None
            return ReviewCandidate(
                item, product, REVIEW_OVERDUE, empty_at.date(), idle_days, empty_at
            )
        if is_freezer(item.location) or idle_days < STALE_DAYS:
            return None
        return ReviewCandidate(item, product, REVIEW_STALE, None, idle_days, reference)


def _ordered(candidates: list[ReviewCandidate]) -> list[ReviewCandidate]:
    """Puts overdue candidates before stale ones, the oldest of each kind first.

    Args:
        candidates: The candidates in any order.

    Returns:
        A new list in asking order.
    """
    rank = {REVIEW_OVERDUE: 0, REVIEW_STALE: 1}
    return sorted(candidates, key=lambda c: (rank[c.reason], c.sort_key))
