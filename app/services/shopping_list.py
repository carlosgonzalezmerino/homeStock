from dataclasses import dataclass

from app.constants import (
    DEFAULT_UNIT,
    MAX_QUANTITY_DECIMALS,
    REASON_PURCHASE,
    SHOPPING_DEFAULT_QUANTITY,
    SHOPPING_PURCHASE_THRESHOLD,
    SOURCE_SHOPPING_LIST,
)
from app.models import Product, ShoppingListItem
from app.repositories.products import ProductRepository
from app.repositories.shopping_list import ShoppingListRepository
from app.services.inventory import (
    InventoryService,
    MovementContext,
    ProductNotFoundError,
)


class ShoppingItemNotFoundError(Exception):
    """Raised when a product is not on the shopping list."""


@dataclass(frozen=True)
class ShoppingLine:
    """One line of the shopping list, with what is known about the product.

    Attributes:
        item: The saved row: how much to buy and whether it is picked up.
        product: Its catalogue entry.
        in_stock: Units in the pantry now, or `None` when it is not tracked there.
        unit: The unit of its stock, or the default one when it is not tracked.
    """

    item: ShoppingListItem
    product: Product
    in_stock: float | None
    unit: str


@dataclass(frozen=True)
class PurchaseSummary:
    """What registering a purchase did.

    Attributes:
        added: Lines that were put into the stock and taken off the list.
        created: Of those, how many were not in the pantry and were created.
    """

    added: int
    created: int


class ShoppingListService:
    """The shopping list: only what the user adds, taken from the catalogue."""

    def __init__(
        self,
        shopping: ShoppingListRepository,
        products: ProductRepository,
        inventory: InventoryService,
    ) -> None:
        """Creates the service.

        Args:
            shopping: Access to the saved list.
            products: Access to the catalogue.
            inventory: The inventory rules, which also write the stock diary.
        """
        self._shopping = shopping
        self._products = products
        self._inventory = inventory

    def lines(self) -> list[ShoppingLine]:
        """Lists the shopping list with the current stock of each product.

        Returns:
            One line per row, oldest first. Rows whose product is gone are skipped.
        """
        result: list[ShoppingLine] = []
        for item in self._shopping.list_all():
            product = self._products.get(item.ean)
            if product is not None:
                result.append(self._line(item, product))
        return result

    def add(
        self, ean: str, quantity: float = SHOPPING_DEFAULT_QUANTITY
    ) -> tuple[ShoppingLine, bool]:
        """Puts a catalogue product on the list. If it is already there, adds to it.

        Args:
            ean: The product's barcode.
            quantity: How much to buy.

        Returns:
            The line, and whether it was newly created (`False` when it was summed).

        Raises:
            ProductNotFoundError: When the product is not in the catalogue.
        """
        product = self._products.get(ean)
        if product is None:
            raise ProductNotFoundError(ean)
        existing = self._shopping.get(ean)
        if existing is None:
            item = self._shopping.create(ShoppingListItem(ean=ean, quantity=quantity))
            return self._line(item, product), True
        total = round(existing.quantity + quantity, MAX_QUANTITY_DECIMALS)
        item = self._shopping.update_fields(ean, {"quantity": total})
        return self._line(item, product), False

    def update(self, ean: str, fields: dict[str, object]) -> ShoppingLine:
        """Changes the quantity or the picked-up mark of a line.

        Args:
            ean: The product's barcode.
            fields: `quantity` and/or `checked`. Only the keys sent are present.

        Returns:
            The updated line.

        Raises:
            ShoppingItemNotFoundError: When the product is not on the list.
        """
        item = self._shopping.update_fields(ean, fields)
        product = self._products.get(ean)
        if item is None or product is None:
            raise ShoppingItemNotFoundError(ean)
        return self._line(item, product)

    def remove(self, ean: str) -> None:
        """Takes a product off the list.

        Args:
            ean: The product's barcode.

        Raises:
            ShoppingItemNotFoundError: When the product is not on the list.
        """
        if not self._shopping.delete(ean):
            raise ShoppingItemNotFoundError(ean)

    def purchase(self) -> PurchaseSummary:
        """Puts everything that is picked up into the stock and off the list.

        All or nothing: if any line fails, no stock changes and the list stays as it
        was. A product that is not in the pantry is created with a threshold of 0. Every
        change goes through the inventory service, so the diary records a purchase.

        Returns:
            How many lines were registered, and how many were new in the pantry.
        """
        with self._shopping.atomic():
            picked = [item for item in self._shopping.list_all() if item.checked]
            created = sum(1 for item in picked if self._register(item))
        return PurchaseSummary(added=len(picked), created=created)

    def _register(self, item: ShoppingListItem) -> bool:
        """Adds one picked-up line to the stock and removes it from the list.

        Args:
            item: The line to register.

        Returns:
            `True` when the product was not in the pantry and had to be created.
        """
        was_new = self._inventory.get_item(item.ean) is None
        if was_new:
            self._inventory.start_tracking(
                item.ean,
                item.quantity,
                SHOPPING_PURCHASE_THRESHOLD,
                DEFAULT_UNIT,
                None,
                source=SOURCE_SHOPPING_LIST,
            )
        else:
            context = MovementContext(REASON_PURCHASE, SOURCE_SHOPPING_LIST)
            self._inventory.adjust(item.ean, item.quantity, context)
        self._shopping.delete(item.ean)
        return was_new

    def _line(self, item: ShoppingListItem, product: Product) -> ShoppingLine:
        """Joins a row with its product and its current stock.

        Args:
            item: The saved row.
            product: Its catalogue entry.

        Returns:
            The line.
        """
        stock = self._inventory.get_item(item.ean)
        return ShoppingLine(
            item=item,
            product=product,
            in_stock=None if stock is None else stock.quantity,
            unit=DEFAULT_UNIT if stock is None else stock.unit,
        )
