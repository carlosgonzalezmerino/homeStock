from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.models import Product
from app.sources.base import ProductData

_CATALOG_FIELDS = (
    "name",
    "brand",
    "description",
    "image_url",
    "category",
    "quantity_desc",
    "kcal_per_100g",
    "fat_per_100g",
    "saturated_fat_per_100g",
    "carbs_per_100g",
    "sugars_per_100g",
    "fiber_per_100g",
    "proteins_per_100g",
    "salt_per_100g",
)


# Most results a catalogue search returns, to keep responses light.
SEARCH_RESULT_LIMIT = 20


class ProductRepository:
    """Database access for the product catalogue, the only layer that queries it."""

    def __init__(self, session: Session) -> None:
        """Creates the repository.

        Args:
            session: The database session to use.
        """
        self._session = session

    def get(self, ean: str) -> Product | None:
        """Finds a product in the catalogue.

        Args:
            ean: The product's barcode.

        Returns:
            The product, or `None` when it is not in the catalogue.
        """
        return self._session.exec(select(Product).where(Product.ean == ean)).first()

    def create(self, product: Product) -> Product:
        """Stores a new product.

        Args:
            product: The product to store.

        Returns:
            The stored product, refreshed from the database.
        """
        self._session.add(product)
        self._session.commit()
        self._session.refresh(product)
        return product

    def upsert_from_source(self, data: ProductData) -> Product:
        """Stores a product found by a source, or enriches the one already stored.

        Only the fields the source filled in are written, so data typed by hand is kept.

        Args:
            data: The product information from the source.

        Returns:
            The stored product.
        """
        product = self.get(data.ean)
        if product is None:
            product = Product(ean=data.ean, name=data.name, source=data.source)
        for field in _CATALOG_FIELDS:
            value = getattr(data, field)
            if value is not None:
                setattr(product, field, value)
        product.source = data.source
        product.updated_at = datetime.now(UTC)
        self._session.add(product)
        self._session.commit()
        self._session.refresh(product)
        return product

    def update_fields(self, ean: str, fields: dict[str, object]) -> Product | None:
        """Changes some fields of a product and refreshes its update time.

        Args:
            ean: The product's barcode.
            fields: The attribute names and their new values.

        Returns:
            The updated product, or `None` when it is not in the catalogue.
        """
        product = self.get(ean)
        if product is None:
            return None
        for key, value in fields.items():
            setattr(product, key, value)
        product.updated_at = datetime.now(UTC)
        self._session.add(product)
        self._session.commit()
        self._session.refresh(product)
        return product

    def search(self, q: str, limit: int = SEARCH_RESULT_LIMIT) -> list[Product]:
        """Searches the catalogue by name or brand, ignoring case.

        Args:
            q: The text to look for. An empty text matches nothing.
            limit: Most results to return.

        Returns:
            The matching products.
        """
        if not q:
            return []
        pattern = f"%{q}%"
        return list(
            self._session.exec(
                select(Product)
                .where(
                    (col(Product.name).ilike(pattern))
                    | (col(Product.brand).ilike(pattern))
                )
                .limit(limit)
            ).all()
        )
