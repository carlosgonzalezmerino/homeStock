from dataclasses import dataclass

from app.constants import (
    DEFAULT_THRESHOLD,
    DEFAULT_UNIT,
    REASON_CONSUME,
    REASON_PURCHASE,
    SCAN_DEFAULT_QUANTITY,
    SCAN_MODE_CONSUME,
    SCAN_MODE_PURCHASE,
    SCAN_STEP,
    SOURCE_SCAN,
)
from app.models import InventoryItem, Product, StockMovement
from app.services.inventory import InventoryService, MovementContext
from app.services.resolver import ProductResolver

STATUS_APPLIED = "applied"
STATUS_CREATED = "created"
STATUS_ALREADY_EMPTY = "already_empty"
STATUS_NOT_TRACKED = "not_tracked"
STATUS_UNKNOWN = "unknown"


class ProductDisappearedError(Exception):
    """Raised when a tracked product is removed while a scan is being applied."""


@dataclass(frozen=True)
class ScanOutcome:
    """What happened when a code was scanned.

    Attributes:
        status: One of the `STATUS_*` values.
        mode: `purchase` or `consume`.
        ean: The code that was scanned.
        product: The product, when someone knows the code.
        quantity_before: Stock before the scan, when the product was tracked.
        item: The stock row after the scan, when the product is tracked.
        movement: The movement written, when the stock changed.
    """

    status: str
    mode: str
    ean: str
    product: Product | None = None
    quantity_before: float | None = None
    item: InventoryItem | None = None
    movement: StockMovement | None = None


class ScanService:
    """Turns a scanned code into a stock change: one unit in or one unit out."""

    def __init__(self, resolver: ProductResolver, inventory: InventoryService) -> None:
        """Creates the service.

        Args:
            resolver: Finds the product of a code (catalogue first, then the sources).
            inventory: The inventory rules, which also write the diary.
        """
        self._resolver = resolver
        self._inventory = inventory

    def scan(
        self,
        ean: str,
        mode: str,
        location: str | None = None,
        source: str = SOURCE_SCAN,
    ) -> ScanOutcome:
        """Applies a scan.

        `purchase` adds one unit, and starts tracking the product if it was not tracked.
        `consume` takes one unit out and never creates anything.

        Args:
            ean: The code that was read.
            mode: `purchase` or `consume`.
            location: Where a new product goes. Only used when it is created.
            source: Where the scan came from, for the diary.

        Returns:
            The outcome. Unknown codes and inert scans are normal outcomes, not errors.
        """
        product = self._resolver.resolve(ean)
        if product is None:
            return ScanOutcome(STATUS_UNKNOWN, mode, ean)
        item = self._inventory.get_item(ean)
        if mode == SCAN_MODE_PURCHASE:
            return self._purchase(product, item, location, source)
        return self._consume(product, item, source)

    def _purchase(
        self,
        product: Product,
        item: InventoryItem | None,
        location: str | None,
        source: str,
    ) -> ScanOutcome:
        """Adds one unit, creating the stock row when the product was not tracked.

        Args:
            product: The scanned product.
            item: Its stock row, or `None` when it is not tracked.
            location: Where a new product goes.
            source: Where the scan came from.

        Returns:
            The `created` or `applied` outcome.
        """
        if item is None:
            return self._create(product, location, source)
        return self._change_stock(product, item, SCAN_STEP, REASON_PURCHASE, source)

    def _create(
        self, product: Product, location: str | None, source: str
    ) -> ScanOutcome:
        """Starts tracking a product with default values.

        Args:
            product: The scanned product.
            location: Where it goes.
            source: Where the scan came from.

        Returns:
            The `created` outcome, with the `initial` movement.
        """
        created = self._inventory.start_tracking(
            product.ean,
            SCAN_DEFAULT_QUANTITY,
            DEFAULT_THRESHOLD,
            DEFAULT_UNIT,
            location,
            source=source,
        )
        movement = self._inventory.last_movement(product.ean)
        return ScanOutcome(
            status=STATUS_CREATED,
            mode=SCAN_MODE_PURCHASE,
            ean=product.ean,
            product=product,
            item=created,
            movement=movement,
        )

    def _consume(
        self, product: Product, item: InventoryItem | None, source: str
    ) -> ScanOutcome:
        """Takes one unit out, or explains why nothing was done.

        Args:
            product: The scanned product.
            item: Its stock row, or `None` when it is not tracked.
            source: Where the scan came from.

        Returns:
            The `applied`, `already_empty` or `not_tracked` outcome.
        """
        inert = {"mode": SCAN_MODE_CONSUME, "ean": product.ean, "product": product}
        if item is None:
            return ScanOutcome(status=STATUS_NOT_TRACKED, **inert)
        if item.quantity <= 0:
            return ScanOutcome(
                status=STATUS_ALREADY_EMPTY,
                quantity_before=item.quantity,
                item=item,
                **inert,
            )
        return self._change_stock(product, item, -SCAN_STEP, REASON_CONSUME, source)

    def _change_stock(
        self,
        product: Product,
        item: InventoryItem,
        delta: float,
        reason: str,
        source: str,
    ) -> ScanOutcome:
        """Adds or takes units from a tracked product and reports the result.

        Args:
            product: The scanned product.
            item: Its stock row before the change.
            delta: Units to add (positive) or take out (negative).
            reason: `purchase` or `consume`.
            source: Where the scan came from.

        Returns:
            The `applied` outcome with the movement that was written.

        Raises:
            ProductDisappearedError: When the row was removed during the scan.
        """
        # Read it first: `item` is the same ORM object the update modifies in place.
        quantity_before = item.quantity
        context = MovementContext(reason, source)
        result = self._inventory.adjust(product.ean, delta, context)
        if result is None:
            raise ProductDisappearedError(product.ean)
        updated, movement = result
        return ScanOutcome(
            status=STATUS_APPLIED,
            mode=reason,
            ean=product.ean,
            product=product,
            quantity_before=quantity_before,
            item=updated,
            movement=movement,
        )
