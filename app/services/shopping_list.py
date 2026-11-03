from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository


class ShoppingListService:
    """Derives the shopping list from the stock: it is a query, not a stored list."""

    def __init__(
        self, inventory: InventoryRepository, products: ProductRepository
    ) -> None:
        """Creates the service.

        Args:
            inventory: Access to the inventory rows.
            products: Access to the product catalogue.
        """
        self._inventory = inventory
        self._products = products

    def items(self) -> list[tuple[InventoryItem, Product]]:
        """Lists what needs to be bought.

        Returns:
            Pairs of inventory row and product for every item that is low on stock.
        """
        result: list[tuple[InventoryItem, Product]] = []
        for item in self._inventory.list_low():
            product = self._products.get(item.ean)
            if product is not None:
                result.append((item, product))
        return result
