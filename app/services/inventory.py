from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository


class ProductNotFoundError(Exception):
    """Raised when tracking an EAN with no catalog row."""


class AlreadyTrackedError(Exception):
    """Raised when an EAN is already tracked in inventory."""


class InventoryService:
    def __init__(
        self, inventory: InventoryRepository, products: ProductRepository
    ) -> None:
        self._inventory = inventory
        self._products = products

    def list_items(self, low_only: bool = False) -> list[tuple[InventoryItem, Product]]:
        items = self._inventory.list_low() if low_only else self._inventory.list_all()
        result: list[tuple[InventoryItem, Product]] = []
        for item in items:
            product = self._products.get(item.ean)
            if product is not None:
                result.append((item, product))
        return result

    def start_tracking(
        self,
        ean: str,
        quantity: float,
        threshold: float,
        unit: str,
        location: str | None,
    ) -> InventoryItem:
        if self._products.get(ean) is None:
            raise ProductNotFoundError(ean)
        if self._inventory.get(ean) is not None:
            raise AlreadyTrackedError(ean)
        return self._inventory.create(
            InventoryItem(
                ean=ean,
                quantity=quantity,
                threshold=threshold,
                unit=unit,
                location=location,
            )
        )

    def update(self, ean: str, fields: dict[str, object]) -> InventoryItem | None:
        return self._inventory.update_fields(ean, fields)

    def stop_tracking(self, ean: str) -> bool:
        return self._inventory.delete(ean)
