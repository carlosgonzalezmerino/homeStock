from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ProductData:
    ean: str
    name: str
    source: str
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


class ProductSource(Protocol):
    name: str

    def lookup(self, ean: str) -> ProductData | None: ...
