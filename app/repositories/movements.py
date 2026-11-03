from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.constants import REASON_CONSUME
from app.models import StockMovement


@dataclass(frozen=True)
class ConsumptionStats:
    """What a product consumed inside a time window.

    Attributes:
        consumed: Units taken out by `consume` movements, as a positive number.
        events: How many `consume` movements there were.
        first_at: When the first of them happened.
    """

    consumed: float
    events: int
    first_at: datetime


class MovementRepository:
    """Database access for stock movements. The table is insert-only."""

    def __init__(self, session: Session) -> None:
        """Creates the repository.

        Args:
            session: The database session to use.
        """
        self._session = session

    def add(self, movement: StockMovement) -> StockMovement:
        """Stores a movement.

        Args:
            movement: The movement to store.

        Returns:
            The stored movement, refreshed from the database.
        """
        self._session.add(movement)
        self._session.commit()
        self._session.refresh(movement)
        return movement

    def get(self, movement_id: int) -> StockMovement | None:
        """Finds one movement.

        Args:
            movement_id: The movement's id.

        Returns:
            The movement, or `None` when it does not exist.
        """
        return self._session.get(StockMovement, movement_id)

    def find(
        self, ean: str | None, reason: str | None, limit: int, offset: int
    ) -> list[StockMovement]:
        """Lists movements, the most recent first.

        Args:
            ean: Keep only this product's movements, when given.
            reason: Keep only movements with this reason, when given.
            limit: Most rows to return.
            offset: Rows to skip.

        Returns:
            The matching movements.
        """
        query = select(StockMovement)
        if ean is not None:
            query = query.where(StockMovement.ean == ean)
        if reason is not None:
            query = query.where(StockMovement.reason == reason)
        query = query.order_by(
            col(StockMovement.created_at).desc(), col(StockMovement.id).desc()
        )
        return list(self._session.exec(query.offset(offset).limit(limit)).all())

    def last(self) -> StockMovement | None:
        """Finds the most recent movement.

        Returns:
            The latest movement, or `None` when there are none.
        """
        found = self.find(ean=None, reason=None, limit=1, offset=0)
        return found[0] if found else None

    def undone_ids(self, movement_ids: list[int]) -> set[int]:
        """Tells which of some movements have already been undone.

        Args:
            movement_ids: The ids to check.

        Returns:
            The subset that another movement points to through `undoes_id`.
        """
        if not movement_ids:
            return set()
        rows = self._session.exec(
            select(StockMovement.undoes_id).where(
                col(StockMovement.undoes_id).in_(movement_ids)
            )
        ).all()
        return {row for row in rows if row is not None}

    def consumption_since(self, since: datetime) -> dict[str, ConsumptionStats]:
        """Summarises `consume` movements per product, from a moment on.

        Args:
            since: Start of the window.

        Returns:
            For each product that consumed something, its totals in the window.
        """
        rows = self._session.exec(
            select(
                StockMovement.ean,
                func.sum(-StockMovement.delta),
                func.count(col(StockMovement.id)),
                func.min(StockMovement.created_at),
            )
            .where(StockMovement.reason == REASON_CONSUME)
            .where(StockMovement.created_at >= since)
            .group_by(col(StockMovement.ean))
        ).all()
        return {
            ean: ConsumptionStats(float(total), int(count), first)
            for ean, total, count, first in rows
        }

    def last_activity(self) -> dict[str, datetime]:
        """Finds the latest movement of every product.

        Returns:
            For each product with movements, the time of its most recent one.
        """
        rows = self._session.exec(
            select(StockMovement.ean, func.max(StockMovement.created_at)).group_by(
                col(StockMovement.ean)
            )
        ).all()
        return {ean: moment for ean, moment in rows}

    def balances(self) -> dict[str, float]:
        """Sums the deltas of every product.

        Returns:
            For each product with movements, the sum of its deltas.
        """
        rows = self._session.exec(
            select(StockMovement.ean, func.sum(StockMovement.delta)).group_by(
                col(StockMovement.ean)
            )
        ).all()
        return {ean: float(total) for ean, total in rows}
