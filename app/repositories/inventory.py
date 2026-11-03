from datetime import UTC, datetime

from sqlalchemy import or_
from sqlmodel import Session, select

from app.db import commit_unless_atomic
from app.models import InventoryItem


class InventoryRepository:
    """Database access for inventory rows. It is the only layer that queries them."""

    def __init__(self, session: Session) -> None:
        """Creates the repository.

        Args:
            session: The database session to use.
        """
        self._session = session

    def get(self, ean: str) -> InventoryItem | None:
        """Finds the inventory row of a product.

        Args:
            ean: The product's barcode.

        Returns:
            The row, or `None` when the product is not tracked.
        """
        return self._session.exec(
            select(InventoryItem).where(InventoryItem.ean == ean)
        ).first()

    def list_all(self) -> list[InventoryItem]:
        """Lists every tracked item.

        Returns:
            All inventory rows.
        """
        return list(self._session.exec(select(InventoryItem)).all())

    def list_low(self) -> list[InventoryItem]:
        """Lists the items that need restocking.

        An item needs restocking when nothing is left or when it is below its threshold.
        An item exactly at its threshold does not.

        Returns:
            The rows that are low on stock.
        """
        return list(
            self._session.exec(
                select(InventoryItem).where(
                    or_(
                        InventoryItem.quantity == 0,
                        InventoryItem.quantity < InventoryItem.threshold,
                    )
                )
            ).all()
        )

    def create(self, item: InventoryItem) -> InventoryItem:
        """Stores a new inventory row.

        Args:
            item: The row to store.

        Returns:
            The stored row, refreshed from the database.
        """
        self._session.add(item)
        commit_unless_atomic(self._session)
        self._session.refresh(item)
        return item

    def update_fields(
        self, ean: str, fields: dict[str, object]
    ) -> InventoryItem | None:
        """Changes some fields of a row and refreshes its update time.

        Args:
            ean: The product's barcode.
            fields: The attribute names and their new values.

        Returns:
            The updated row, or `None` when the product is not tracked.
        """
        item = self.get(ean)
        if item is None:
            return None
        for key, value in fields.items():
            setattr(item, key, value)
        item.updated_at = datetime.now(UTC)
        self._session.add(item)
        commit_unless_atomic(self._session)
        self._session.refresh(item)
        return item

    def delete(self, ean: str) -> bool:
        """Removes the inventory row of a product.

        Args:
            ean: The product's barcode.

        Returns:
            `True` when the row existed and was removed.
        """
        item = self.get(ean)
        if item is None:
            return False
        self._session.delete(item)
        commit_unless_atomic(self._session)
        return True
