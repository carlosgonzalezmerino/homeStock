from app.constants import REASON_ADJUST, REASON_INITIAL, SOURCE_UNDO
from app.models import StockMovement
from app.repositories.movements import MovementRepository
from app.services.inventory import QUANTITY_PRECISION, InventoryService, MovementContext


class MovementNotFoundError(Exception):
    """Raised when a movement id does not exist."""


class AlreadyUndoneError(Exception):
    """Raised when a movement has already been undone."""


class NotTrackedError(Exception):
    """Raised when the product of a movement is no longer in the inventory."""


class NothingToUndoError(Exception):
    """Raised when undoing a movement would not change the stock."""


class MovementService:
    """Reads the diary of stock changes and undoes single movements."""

    def __init__(
        self, movements: MovementRepository, inventory: InventoryService
    ) -> None:
        """Creates the service.

        Args:
            movements: Access to the diary.
            inventory: The inventory rules, which also write the compensating movement.
        """
        self._movements = movements
        self._inventory = inventory

    def list_movements(
        self, ean: str | None, reason: str | None, limit: int, offset: int
    ) -> list[tuple[StockMovement, bool]]:
        """Lists movements, the most recent first, saying which ones were undone.

        Args:
            ean: Keep only this product's movements, when given.
            reason: Keep only movements with this reason, when given.
            limit: Most rows to return.
            offset: Rows to skip.

        Returns:
            Pairs of movement and whether another movement has undone it.
        """
        found = self._movements.find(ean, reason, limit, offset)
        undone = self._movements.undone_ids([m.id for m in found if m.id is not None])
        return [(movement, movement.id in undone) for movement in found]

    def last_movement(self) -> tuple[StockMovement, bool] | None:
        """Finds the most recent movement.

        Returns:
            The movement and whether it was undone, or `None` when there are none.
        """
        found = self.list_movements(ean=None, reason=None, limit=1, offset=0)
        return found[0] if found else None

    def undo(self, movement_id: int) -> StockMovement:
        """Reverts one movement by writing a compensating one. Nothing is ever deleted.

        Undoing the `initial` movement of a product that ends at 0 also stops tracking
        it, so a mistaken first scan does not leave an empty product on the list.

        Args:
            movement_id: The movement to revert.

        Returns:
            The compensating movement.

        Raises:
            MovementNotFoundError: When the movement does not exist.
            AlreadyUndoneError: When it was undone before.
            NotTrackedError: When the product is no longer in the inventory.
            NothingToUndoError: When the stock would not change.
        """
        original = self._load_undoable(movement_id)
        context = MovementContext(REASON_ADJUST, SOURCE_UNDO, movement_id)
        result = self._inventory.adjust(original.ean, -original.delta, context)
        if result is None or result[1] is None:
            raise NothingToUndoError(movement_id)
        item, compensation = result
        if original.reason == REASON_INITIAL and item.quantity == 0:
            self._inventory.stop_tracking(original.ean, SOURCE_UNDO)
        return compensation

    def _load_undoable(self, movement_id: int) -> StockMovement:
        """Loads a movement and checks that it can still be undone.

        Args:
            movement_id: The movement to check.

        Returns:
            The movement.

        Raises:
            MovementNotFoundError: When the movement does not exist.
            AlreadyUndoneError: When it was undone before.
            NotTrackedError: When its product is no longer in the inventory.
            NothingToUndoError: When the stock would not change.
        """
        original = self._movements.get(movement_id)
        if original is None:
            raise MovementNotFoundError(movement_id)
        if movement_id in self._movements.undone_ids([movement_id]):
            raise AlreadyUndoneError(movement_id)
        item = self._inventory.get_item(original.ean)
        if item is None:
            raise NotTrackedError(original.ean)
        target = max(round(item.quantity - original.delta, QUANTITY_PRECISION), 0.0)
        if target == item.quantity:
            raise NothingToUndoError(movement_id)
        return original
