import pytest

from app.constants import (
    REASON_ADJUST,
    REASON_CONSUME,
    REASON_INITIAL,
    REASON_PURCHASE,
    REASON_REMOVED,
    SOURCE_APP,
    SOURCE_SCAN,
)
from app.repositories.movements import MovementRepository
from app.services.inventory import InventoryService, MovementContext
from tests.services.conftest import EAN


def _track(service: InventoryService, quantity: float = 3, **extra: object):
    return service.start_tracking(
        EAN, quantity=quantity, threshold=1, unit="units", location=None, **extra
    )


def _diary(movements: MovementRepository):
    return movements.find(EAN, None, limit=50, offset=0)


def test_start_tracking_with_stock_writes_an_initial_movement(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=3)
    (movement,) = _diary(movements)
    assert (movement.delta, movement.quantity_after) == (3, 3)
    assert (movement.reason, movement.source) == (REASON_INITIAL, SOURCE_APP)


def test_start_tracking_with_zero_stock_writes_no_movement(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=0)
    assert _diary(movements) == []


def test_start_tracking_records_the_given_source(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, source=SOURCE_SCAN)
    assert _diary(movements)[0].source == SOURCE_SCAN


def test_update_quantity_up_writes_a_positive_movement_with_the_reason(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=3)
    context = MovementContext(REASON_PURCHASE, SOURCE_SCAN)
    inventory_service.update(EAN, {"quantity": 5}, context)
    latest = _diary(movements)[0]
    assert (latest.delta, latest.quantity_after) == (2, 5)
    assert (latest.reason, latest.source) == (REASON_PURCHASE, SOURCE_SCAN)


def test_update_quantity_down_writes_a_negative_movement(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=3)
    inventory_service.update(EAN, {"quantity": 1}, MovementContext(REASON_CONSUME))
    assert _diary(movements)[0].delta == -2


def test_update_quantity_without_a_context_is_recorded_as_an_adjustment(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=3)
    inventory_service.update(EAN, {"quantity": 4})
    assert _diary(movements)[0].reason == REASON_ADJUST


@pytest.mark.parametrize(
    "fields", [{"threshold": 9}, {"notes": "hola"}, {"quantity": 3}]
)
def test_update_without_a_quantity_change_writes_nothing(
    inventory_service: InventoryService, movements: MovementRepository, fields
) -> None:
    _track(inventory_service, quantity=3)
    inventory_service.update(EAN, fields)
    assert len(_diary(movements)) == 1  # only the initial movement


def test_update_with_float_noise_writes_no_movement(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=0.3)
    inventory_service.update(EAN, {"quantity": 0.1 + 0.2})
    assert len(_diary(movements)) == 1


def test_update_of_an_untracked_product_returns_none(
    inventory_service: InventoryService,
) -> None:
    assert inventory_service.update(EAN, {"quantity": 1}) is None


def test_stop_tracking_with_stock_writes_a_removed_movement_and_keeps_history(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=3)
    assert inventory_service.stop_tracking(EAN) is True
    removed = _diary(movements)[0]
    assert (removed.delta, removed.quantity_after, removed.reason) == (
        -3,
        0,
        REASON_REMOVED,
    )
    assert inventory_service.get_item(EAN) is None
    assert len(_diary(movements)) == 2


def test_stop_tracking_an_empty_item_writes_nothing(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=0)
    inventory_service.stop_tracking(EAN)
    assert _diary(movements) == []


def test_stop_tracking_an_untracked_product_returns_false(
    inventory_service: InventoryService,
) -> None:
    assert inventory_service.stop_tracking(EAN) is False


def test_adjust_below_zero_clamps_and_records_the_real_delta(
    inventory_service: InventoryService, movements: MovementRepository
) -> None:
    _track(inventory_service, quantity=0.5)
    item, movement = inventory_service.adjust(EAN, -1, MovementContext(REASON_CONSUME))
    assert item.quantity == 0
    assert (movement.delta, movement.quantity_after) == (-0.5, 0)


def test_adjust_that_changes_nothing_returns_no_movement(
    inventory_service: InventoryService,
) -> None:
    _track(inventory_service, quantity=0)
    item, movement = inventory_service.adjust(EAN, -1, MovementContext(REASON_CONSUME))
    assert (item.quantity, movement) == (0, None)


def test_adjust_of_an_untracked_product_returns_none(
    inventory_service: InventoryService,
) -> None:
    assert inventory_service.adjust(EAN, 1, MovementContext()) is None


def test_last_movement_returns_the_latest_of_that_product(
    inventory_service: InventoryService,
) -> None:
    _track(inventory_service, quantity=3)
    inventory_service.update(EAN, {"quantity": 4})
    assert inventory_service.last_movement(EAN).quantity_after == 4
    assert inventory_service.last_movement("q") is None
