from datetime import UTC, date, datetime

from sqlalchemy import Text
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(UTC)


class Product(SQLModel, table=True):
    """A product in the catalogue: what it is, not how many are in stock.

    It is also the cache of external lookups.
    """

    __tablename__ = "products"

    ean: str = Field(primary_key=True)
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = Field(default=None, sa_type=Text)
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
    """The stock of one product: how many, where, and when it should be bought again."""

    __tablename__ = "inventory_items"

    id: int | None = Field(default=None, primary_key=True)
    ean: str = Field(foreign_key="products.ean", unique=True, index=True)
    quantity: float
    threshold: float
    unit: str = "units"
    location: str | None = None
    drawer: int | None = None
    frozen_at: date | None = None
    notes: str | None = Field(default=None, sa_type=Text)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    @property
    def is_low(self) -> bool:
        """Tells whether the item needs restocking.

        An item is low when nothing is left, or when it is below the threshold.
        Being exactly at the threshold is not low.

        Returns:
            `True` when the quantity is 0 or lower than the threshold.
        """
        return self.quantity == 0 or self.quantity < self.threshold


class OffProduct(SQLModel, table=True):
    """A product imported from the OpenFoodFacts dump, rebuilt by the import script."""

    __tablename__ = "off_products"

    ean: str = Field(primary_key=True, index=True)
    name: str
    brand: str | None = None
    image_url: str | None = None
    category: str | None = Field(default=None, sa_type=Text)
    quantity_desc: str | None = None
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None
