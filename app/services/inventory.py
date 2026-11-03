from datetime import date

from app.constants import FREEZER_LOCATION
from app.models import InventoryItem, Product
from app.repositories.inventory import InventoryRepository
from app.repositories.products import ProductRepository

FREEZER_FIELDS_MESSAGE = (
    "El cajón y la fecha de congelación solo se aplican a productos del congelador"
)


class ProductNotFoundError(Exception):
    """Raised when tracking an EAN with no catalog row."""


class AlreadyTrackedError(Exception):
    """Raised when an EAN is already tracked in inventory."""


class FreezerFieldsError(Exception):
    """Raised when a drawer or a frozen date is given outside the freezer."""


def today() -> date:
    """Returns the server's current date, used when a freezer item has no frozen date.

    Returns:
        Today's date in the server's time zone.
    """
    return date.today()


def is_freezer(location: str | None) -> bool:
    """Tells whether a location is the freezer.

    Args:
        location: The stored location. `None` means the pantry.

    Returns:
        `True` only for the freezer location.
    """
    return location == FREEZER_LOCATION


def _reject_freezer_only_fields(fields: dict[str, object]) -> None:
    """Raises when a freezer-only field carries a value.

    Args:
        fields: The values sent by the client. A missing key means it was not sent.

    Raises:
        FreezerFieldsError: When `drawer` or `frozen_at` is set to a non-null value.
    """
    if fields.get("drawer") is not None or fields.get("frozen_at") is not None:
        raise FreezerFieldsError(FREEZER_FIELDS_MESSAGE)


def _new_item_freezer_fields(
    location: str | None, drawer: int | None, frozen_at: date | None
) -> dict[str, object]:
    """Decides the freezer fields of an item that is being added.

    Args:
        location: The location of the new item.
        drawer: The drawer the client chose, if any.
        frozen_at: The frozen date the client chose, if any.

    Returns:
        The `drawer` and `frozen_at` values to store. A freezer item
        without a date gets today's date.

    Raises:
        FreezerFieldsError: When a freezer field is set outside the freezer.
    """
    if not is_freezer(location):
        _reject_freezer_only_fields({"drawer": drawer, "frozen_at": frozen_at})
        return {"drawer": None, "frozen_at": None}
    return {"drawer": drawer, "frozen_at": today() if frozen_at is None else frozen_at}


def _plan_update(
    current: InventoryItem, fields: dict[str, object]
) -> dict[str, object]:
    """Works out every field to store when an item is edited.

    Moving an item into the freezer without a date gives it today's date.
    Moving it out of the freezer clears its drawer and frozen date.

    Args:
        current: The stored item before the edit.
        fields: The values sent by the client. Only the keys that were sent are present.

    Returns:
        The fields to write, including any freezer fields that the rules above change.

    Raises:
        FreezerFieldsError: When the item ends up outside the freezer with
            a freezer field set.
    """
    new_location = fields.get("location", current.location)
    if not is_freezer(new_location):
        _reject_freezer_only_fields(fields)
        return {**fields, "drawer": None, "frozen_at": None}
    if is_freezer(current.location) or "frozen_at" in fields:
        return dict(fields)
    return {**fields, "frozen_at": today()}


class InventoryService:
    """Business rules for the inventory: tracking, editing and the shopping list."""

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

    def list_items(self, low_only: bool = False) -> list[tuple[InventoryItem, Product]]:
        """Lists inventory items together with their product.

        Args:
            low_only: When `True`, only the items that need restocking are returned.

        Returns:
            Pairs of inventory item and product. Items without a product are skipped.
        """
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
        drawer: int | None = None,
        frozen_at: date | None = None,
        notes: str | None = None,
    ) -> InventoryItem:
        """Starts tracking a product that is in the catalog.

        Args:
            ean: The product's barcode.
            quantity: Units in stock.
            threshold: The quantity at or below which the item is low.
            unit: The unit of the quantity.
            location: `pantry`, `freezer` or `None` for the pantry.
            drawer: The freezer drawer, only for freezer items.
            frozen_at: The frozen date, only for freezer items. Defaults to today.
            notes: A free-text note.

        Returns:
            The stored inventory item.

        Raises:
            ProductNotFoundError: When the product is not in the catalog.
            AlreadyTrackedError: When the product is already in the inventory.
            FreezerFieldsError: When a freezer field is set outside the freezer.
        """
        if self._products.get(ean) is None:
            raise ProductNotFoundError(ean)
        if self._inventory.get(ean) is not None:
            raise AlreadyTrackedError(ean)
        freezer_fields = _new_item_freezer_fields(location, drawer, frozen_at)
        return self._inventory.create(
            InventoryItem(
                ean=ean,
                quantity=quantity,
                threshold=threshold,
                unit=unit,
                location=location,
                notes=notes,
                **freezer_fields,
            )
        )

    def update(self, ean: str, fields: dict[str, object]) -> InventoryItem | None:
        """Applies a partial edit to a tracked item.

        Args:
            ean: The product's barcode.
            fields: The values to change. Only the keys that were sent are present.

        Returns:
            The updated item, or `None` when the product is not tracked.

        Raises:
            FreezerFieldsError: When the edit leaves a freezer field set
                outside the freezer.
        """
        current = self._inventory.get(ean)
        if current is None:
            return None
        return self._inventory.update_fields(ean, _plan_update(current, fields))

    def stop_tracking(self, ean: str) -> bool:
        """Removes a product from the inventory.

        Args:
            ean: The product's barcode.

        Returns:
            `True` when the item existed and was removed.
        """
        return self._inventory.delete(ean)
