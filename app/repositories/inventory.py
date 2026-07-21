from datetime import UTC, datetime

from sqlmodel import Session, select

from app.models import InventoryItem


class InventoryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, ean: str) -> InventoryItem | None:
        return self._session.exec(
            select(InventoryItem).where(InventoryItem.ean == ean)
        ).first()

    def list_all(self) -> list[InventoryItem]:
        return list(self._session.exec(select(InventoryItem)).all())

    def list_low(self) -> list[InventoryItem]:
        return list(
            self._session.exec(
                select(InventoryItem).where(
                    InventoryItem.quantity <= InventoryItem.threshold
                )
            ).all()
        )

    def create(self, item: InventoryItem) -> InventoryItem:
        self._session.add(item)
        self._session.commit()
        self._session.refresh(item)
        return item

    def update_fields(
        self, ean: str, fields: dict[str, object]
    ) -> InventoryItem | None:
        item = self.get(ean)
        if item is None:
            return None
        for key, value in fields.items():
            setattr(item, key, value)
        item.updated_at = datetime.now(UTC)
        self._session.add(item)
        self._session.commit()
        self._session.refresh(item)
        return item

    def delete(self, ean: str) -> bool:
        item = self.get(ean)
        if item is None:
            return False
        self._session.delete(item)
        self._session.commit()
        return True
