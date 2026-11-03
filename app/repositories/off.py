from sqlmodel import Session, select

from app.models import OffProduct


class OffProductRepository:
    """Read access to the imported OpenFoodFacts table."""

    def __init__(self, session: Session) -> None:
        """Creates the repository.

        Args:
            session: The database session to use.
        """
        self._session = session

    def get(self, ean: str) -> OffProduct | None:
        """Finds an imported OpenFoodFacts product.

        Args:
            ean: The product's barcode.

        Returns:
            The imported row, or `None` when the EAN was not imported.
        """
        return self._session.exec(
            select(OffProduct).where(OffProduct.ean == ean)
        ).first()
