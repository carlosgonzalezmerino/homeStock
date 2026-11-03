from app.repositories.off import OffProductRepository
from app.sources.base import ProductData


class OffSource:
    """Product source backed by the OpenFoodFacts subset in `off_products`."""

    name = "openfoodfacts"

    def __init__(self, repo: OffProductRepository) -> None:
        """Creates the source.

        Args:
            repo: Repository that reads the imported OpenFoodFacts table.
        """
        self._repo = repo

    def lookup(self, ean: str) -> ProductData | None:
        """Looks a product up in the imported OpenFoodFacts table.

        Args:
            ean: The barcode to look for.

        Returns:
            The product data, or `None` when the EAN was not imported.
        """
        row = self._repo.get(ean)
        if row is None:
            return None
        return ProductData(
            ean=row.ean,
            name=row.name,
            source="openfoodfacts",
            brand=row.brand,
            image_url=row.image_url,
            category=row.category,
            quantity_desc=row.quantity_desc,
            kcal_per_100g=row.kcal_per_100g,
            fat_per_100g=row.fat_per_100g,
            saturated_fat_per_100g=row.saturated_fat_per_100g,
            carbs_per_100g=row.carbs_per_100g,
            sugars_per_100g=row.sugars_per_100g,
            fiber_per_100g=row.fiber_per_100g,
            proteins_per_100g=row.proteins_per_100g,
            salt_per_100g=row.salt_per_100g,
        )
