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


class ProductRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get(self, ean: str) -> Product | None:
        return self._session.exec(select(Product).where(Product.ean == ean)).first()

    def create(self, product: Product) -> Product:
        self._session.add(product)
        self._session.commit()
        self._session.refresh(product)
        return product

    def upsert_from_source(self, data: ProductData) -> Product:
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

    def search(self, q: str, limit: int = 20) -> list[Product]:
        if not q:
            return []
        pattern = f"%{q}%"
        return list(
            self._session.exec(
                select(Product).where(
                    (col(Product.name).ilike(pattern))
                    | (col(Product.brand).ilike(pattern))
                ).limit(limit)
            ).all()
        )
