from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ProductData:
    """Product information obtained from an external source, before it is stored.

    Attributes:
        ean: The product's barcode.
        name: The product name.
        source: Name of the source that provided it, such as `openfoodfacts`.
    """

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
    """A place where product data can be looked up by EAN."""

    name: str

    def lookup(self, ean: str) -> ProductData | None:
        """Looks a product up by its barcode.

        Args:
            ean: The barcode to look for.

        Returns:
            The product data, or `None` when this source does not know the product.
        """
        ...
