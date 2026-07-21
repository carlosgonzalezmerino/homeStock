from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(UTC)


class Product(SQLModel, table=True):
    __tablename__ = "products"

    ean: str = Field(primary_key=True)
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None
    source: str
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class InventoryItem(SQLModel, table=True):
    __tablename__ = "inventory_items"

    id: int | None = Field(default=None, primary_key=True)
    ean: str = Field(foreign_key="products.ean", unique=True, index=True)
    quantity: float
    threshold: float
    unit: str = "units"
    location: str | None = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class OffProduct(SQLModel, table=True):
    __tablename__ = "off_products"

    ean: str = Field(primary_key=True, index=True)
    name: str
    brand: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None
