from sqlmodel import Session, select

from app.models import OffProduct


class OffProductRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, ean: str) -> OffProduct | None:
        return self._session.exec(
            select(OffProduct).where(OffProduct.ean == ean)
        ).first()
