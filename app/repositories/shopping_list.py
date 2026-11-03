from contextlib import AbstractContextManager
from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.db import atomic, commit_unless_atomic
from app.models import ShoppingListItem


class ShoppingListRepository:
    """Database access for the shopping list rows. The only layer that queries them."""

    def __init__(self, session: Session) -> None:
        """Creates the repository.

        Args:
            session: The database session to use.
        """
        self._session = session

    def atomic(self) -> AbstractContextManager[None]:
        """Groups every write on this session so they succeed or fail together.

        Returns:
            A context manager. Writes made inside it are rolled back if it raises.
        """
        return atomic(self._session)

    def get(self, ean: str) -> ShoppingListItem | None:
        """Finds the row of a product.

        Args:
            ean: The product's barcode.

        Returns:
            The row, or `None` when the product is not on the list.
        """
        return self._session.exec(
            select(ShoppingListItem).where(ShoppingListItem.ean == ean)
        ).first()

    def list_all(self) -> list[ShoppingListItem]:
        """Lists the whole list, in the order the products were added.

        Returns:
            Every row, oldest first.
        """
        return list(
            self._session.exec(
                select(ShoppingListItem).order_by(col(ShoppingListItem.id))
            ).all()
        )

    def create(self, item: ShoppingListItem) -> ShoppingListItem:
        """Stores a new row.

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
    ) -> ShoppingListItem | None:
        """Changes some fields of a row and refreshes its update time.

        Args:
            ean: The product's barcode.
            fields: The attribute names and their new values.

        Returns:
            The updated row, or `None` when the product is not on the list.
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
        """Removes the row of a product.

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
