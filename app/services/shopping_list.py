from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository


class ShoppingListService:
    def __init__(
        self, inventory: InventoryRepository, products: ProductRepository
    ) -> None:
        self._inventory = inventory
        self._products = products

    def items(self) -> list[tuple[InventoryItem, Product]]:
        result: list[tuple[InventoryItem, Product]] = []
        for item in self._inventory.list_low():
            product = self._products.get(item.ean)
            if product is not None:
                result.append((item, product))
        return result
