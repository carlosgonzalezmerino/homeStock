import pytest

from app.constants import (
    DEFAULT_THRESHOLD,
    REASON_CONSUME,
    REASON_INITIAL,
    REASON_PURCHASE,
    SCAN_MODE_CONSUME,
    SCAN_MODE_PURCHASE,
    SOURCE_DEVICE,
    SOURCE_SCAN,
)
from app.models import Product
from app.repositories.movements import MovementRepository
from app.services.inventory import InventoryService
from app.services.scan import ScanService
from tests.services.conftest import EAN


class _FakeResolver:
    """Knows only the products it was given, like a resolver with no external source."""

    def __init__(self, *products: Product) -> None:
        self._known = {product.ean: product for product in products}

    def resolve(self, ean: str):
        return self._known.get(ean)


@pytest.fixture
def scan_service(inventory_service: InventoryService) -> ScanService:
    return ScanService(
        _FakeResolver(Product(ean=EAN, name="Prod", source="x")), inventory_service
    )


def _track(service: InventoryService, quantity: float):
    service.start_tracking(
        EAN, quantity=quantity, threshold=1, unit="units", location=None
    )


def test_scan_an_unknown_code_changes_nothing(
    scan_service: ScanService, inventory_service: InventoryService
) -> None:
    outcome = scan_service.scan("0000", SCAN_MODE_PURCHASE)
    assert outcome.status == "unknown"
    assert (outcome.product, outcome.movement) == (None, None)


def test_scan_purchase_of_an_untracked_product_creates_it_with_defaults(
    scan_service: ScanService, inventory_service: InventoryService
) -> None:
    outcome = scan_service.scan(EAN, SCAN_MODE_PURCHASE, location="freezer")
    item = inventory_service.get_item(EAN)
    assert outcome.status == "created"
    assert (item.quantity, item.threshold, item.location) == (
        1,
        DEFAULT_THRESHOLD,
        "freezer",
    )
    assert (outcome.movement.reason, outcome.movement.source) == (
        REASON_INITIAL,
        SOURCE_SCAN,
    )


def test_scan_purchase_of_a_tracked_product_adds_one(
    scan_service: ScanService, inventory_service: InventoryService
) -> None:
    _track(inventory_service, 3)
    outcome = scan_service.scan(EAN, SCAN_MODE_PURCHASE)
    assert outcome.status == "applied"
    assert (outcome.quantity_before, outcome.item.quantity) == (3, 4)
    assert outcome.movement.reason == REASON_PURCHASE


def test_scan_consume_takes_one_unit_out(
    scan_service: ScanService, inventory_service: InventoryService
) -> None:
    _track(inventory_service, 3)
    outcome = scan_service.scan(EAN, SCAN_MODE_CONSUME)
    assert outcome.status == "applied"
    assert (outcome.quantity_before, outcome.item.quantity) == (3, 2)
    assert (outcome.movement.delta, outcome.movement.reason) == (-1, REASON_CONSUME)


def test_scan_consume_of_less_than_a_unit_takes_what_is_left(
    scan_service: ScanService, inventory_service: InventoryService
) -> None:
    _track(inventory_service, 0.5)
    outcome = scan_service.scan(EAN, SCAN_MODE_CONSUME)
    assert (outcome.item.quantity, outcome.movement.delta) == (0, -0.5)


def test_scan_consume_of_an_empty_product_reports_it_and_writes_nothing(
    scan_service: ScanService,
    inventory_service: InventoryService,
    movements: MovementRepository,
) -> None:
    _track(inventory_service, 0)
    outcome = scan_service.scan(EAN, SCAN_MODE_CONSUME)
    assert outcome.status == "already_empty"
    assert (outcome.movement, movements.find(EAN, None, 10, 0)) == (None, [])


def test_scan_consume_of_an_untracked_product_does_not_create_it(
    scan_service: ScanService, inventory_service: InventoryService
) -> None:
    outcome = scan_service.scan(EAN, SCAN_MODE_CONSUME)
    assert outcome.status == "not_tracked"
    assert inventory_service.get_item(EAN) is None


def test_scan_records_the_source_it_was_given(
    scan_service: ScanService, inventory_service: InventoryService
) -> None:
    _track(inventory_service, 3)
    outcome = scan_service.scan(EAN, SCAN_MODE_CONSUME, source=SOURCE_DEVICE)
    assert outcome.movement.source == SOURCE_DEVICE
