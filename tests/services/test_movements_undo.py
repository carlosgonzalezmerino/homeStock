import pytest

from app.constants import (
    REASON_ADJUST,
    REASON_CONSUME,
    REASON_PURCHASE,
    SOURCE_APP,
    SOURCE_UNDO,
)
from app.repositories.movements import MovementRepository
from app.services.inventory import InventoryService, MovementContext
from app.services.movements import (
    AlreadyUndoneError,
    MovementNotFoundError,
    MovementService,
    NothingToUndoError,
    NotTrackedError,
)
from tests.services.conftest import EAN


@pytest.fixture
def movement_service(
    movements: MovementRepository, inventory_service: InventoryService
) -> MovementService:
    return MovementService(movements, inventory_service)


def _track(service: InventoryService, quantity: float = 3):
    service.start_tracking(
        EAN, quantity=quantity, threshold=1, unit="units", location=None
    )


def _change(service: InventoryService, quantity: float, reason: str = REASON_PURCHASE):
    return service.adjust(EAN, quantity, MovementContext(reason, SOURCE_APP))[1]


def _quantity(service: InventoryService) -> float:
    return service.get_item(EAN).quantity


def test_undo_a_purchase_restores_the_quantity_and_links_the_compensation(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service)
    purchase = _change(inventory_service, 2)
    compensation = movement_service.undo(purchase.id)
    assert _quantity(inventory_service) == 3
    assert (compensation.delta, compensation.quantity_after) == (-2, 3)
    assert (compensation.reason, compensation.source) == (REASON_ADJUST, SOURCE_UNDO)
    assert compensation.undoes_id == purchase.id


def test_undo_a_consumption_puts_the_unit_back(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service)
    consumption = _change(inventory_service, -1, REASON_CONSUME)
    movement_service.undo(consumption.id)
    assert _quantity(inventory_service) == 3


def test_undo_twice_raises_already_undone(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service)
    purchase = _change(inventory_service, 2)
    movement_service.undo(purchase.id)
    with pytest.raises(AlreadyUndoneError):
        movement_service.undo(purchase.id)


def test_undo_an_unknown_movement_raises_not_found(
    movement_service: MovementService,
) -> None:
    with pytest.raises(MovementNotFoundError):
        movement_service.undo(999)


def test_undo_when_the_product_is_no_longer_tracked_raises(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service)
    purchase = _change(inventory_service, 2)
    inventory_service.stop_tracking(EAN)
    with pytest.raises(NotTrackedError):
        movement_service.undo(purchase.id)


def test_undo_an_entry_when_the_stock_is_already_zero_raises_nothing_to_undo(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service, quantity=1)
    purchase = _change(inventory_service, 1)
    _change(inventory_service, -2, REASON_CONSUME)
    with pytest.raises(NothingToUndoError):
        movement_service.undo(purchase.id)


def test_undo_more_than_the_stock_clamps_at_zero_and_records_the_real_delta(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service, quantity=1)
    purchase = _change(inventory_service, 5)
    _change(inventory_service, -5, REASON_CONSUME)
    compensation = movement_service.undo(purchase.id)
    assert _quantity(inventory_service) == 0
    assert compensation.delta == -1


def test_undo_the_initial_movement_stops_tracking_when_stock_reaches_zero(
    inventory_service: InventoryService,
    movement_service: MovementService,
    movements: MovementRepository,
) -> None:
    _track(inventory_service, quantity=1)
    initial = movements.find(EAN, None, 1, 0)[0]
    movement_service.undo(initial.id)
    assert inventory_service.get_item(EAN) is None
    assert len(movements.find(EAN, None, 10, 0)) == 2  # history is kept


def test_undo_the_initial_movement_keeps_tracking_when_stock_remains(
    inventory_service: InventoryService,
    movement_service: MovementService,
    movements: MovementRepository,
) -> None:
    _track(inventory_service, quantity=1)
    _change(inventory_service, 2)
    initial = movements.find(EAN, None, 10, 0)[-1]
    movement_service.undo(initial.id)
    assert _quantity(inventory_service) == 2


def test_undo_an_undo_redoes_the_original_change(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service)
    purchase = _change(inventory_service, 2)
    compensation = movement_service.undo(purchase.id)
    movement_service.undo(compensation.id)
    assert _quantity(inventory_service) == 5


def test_list_movements_marks_which_ones_were_undone(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    _track(inventory_service)
    purchase = _change(inventory_service, 2)
    movement_service.undo(purchase.id)
    flags = {
        m.id: undone for m, undone in movement_service.list_movements(EAN, None, 10, 0)
    }
    assert flags[purchase.id] is True
    assert sum(flags.values()) == 1


def test_last_movement_returns_the_newest_or_none(
    inventory_service: InventoryService, movement_service: MovementService
) -> None:
    assert movement_service.last_movement() is None
    _track(inventory_service)
    movement, undone = movement_service.last_movement()
    assert (movement.delta, undone) == (3, False)
