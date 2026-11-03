from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_movement_service
from app.constants import MOVEMENT_DEFAULT_LIMIT, MOVEMENT_MAX_LIMIT
from app.models import StockMovement
from app.schemas import MovementOut
from app.services.movements import (
    AlreadyUndoneError,
    MovementNotFoundError,
    MovementService,
    NothingToUndoError,
    NotTrackedError,
)

router = APIRouter(prefix="/api/movements", tags=["movements"])


def _to_out(movement: StockMovement, undone: bool) -> MovementOut:
    """Builds the API view of a movement.

    Args:
        movement: The stored movement.
        undone: Whether another movement has undone it.

    Returns:
        The response model.
    """
    return MovementOut.model_validate(movement).model_copy(update={"undone": undone})


@router.get("", response_model=list[MovementOut])
def list_movements(
    ean: str | None = Query(default=None),
    reason: str | None = Query(default=None),
    limit: int = Query(default=MOVEMENT_DEFAULT_LIMIT, ge=1, le=MOVEMENT_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    service: MovementService = Depends(get_movement_service),
) -> list[MovementOut]:
    """Lists the diary of stock changes, the most recent first.

    Args:
        ean: Keep only this product's movements.
        reason: Keep only movements with this reason.
        limit: Most rows to return.
        offset: Rows to skip.
        service: The movement service.

    Returns:
        The movements, each saying whether it was undone.
    """
    rows = service.list_movements(ean, reason, limit, offset)
    return [_to_out(movement, undone) for movement, undone in rows]


@router.get("/last", response_model=MovementOut | None)
def last_movement(
    service: MovementService = Depends(get_movement_service),
) -> MovementOut | None:
    """Returns the most recent movement.

    Args:
        service: The movement service.

    Returns:
        The latest movement, or `null` when the diary is empty.
    """
    found = service.last_movement()
    return None if found is None else _to_out(*found)


@router.post("/{movement_id}/undo", response_model=MovementOut)
def undo_movement(
    movement_id: int, service: MovementService = Depends(get_movement_service)
) -> MovementOut:
    """Reverts a movement by writing a compensating one. Nothing is deleted.

    Args:
        movement_id: The movement to revert.
        service: The movement service.

    Returns:
        The compensating movement.

    Raises:
        HTTPException: 404 when the movement does not exist; 409 when it was already
            undone, its product is no longer tracked, or the stock would not change.
    """
    try:
        compensation = service.undo(movement_id)
    except MovementNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND, detail={"id": movement_id}
        ) from exc
    except AlreadyUndoneError as exc:
        raise _conflict("already_undone", movement_id) from exc
    except NotTrackedError as exc:
        raise _conflict("not_tracked", movement_id) from exc
    except NothingToUndoError as exc:
        raise _conflict("nothing_to_undo", movement_id) from exc
    return _to_out(compensation, False)


def _conflict(code: str, movement_id: int) -> HTTPException:
    """Builds the 409 answer for a movement that cannot be undone.

    Args:
        code: Machine-readable reason.
        movement_id: The movement that was refused.

    Returns:
        An HTTP exception carrying the reason.
    """
    return HTTPException(
        status_code=HTTPStatus.CONFLICT, detail={"id": movement_id, "reason": code}
    )
