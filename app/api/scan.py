from fastapi import APIRouter, Depends

from app.api.deps import get_scan_service, get_source
from app.constants import SOURCE_SCAN
from app.schemas import ScanRequest, ScanResultOut
from app.services.scan import ScanOutcome, ScanService

router = APIRouter(prefix="/api", tags=["scan"])


def _to_out(outcome: ScanOutcome) -> ScanResultOut:
    """Builds the API view of a scan outcome.

    Args:
        outcome: What the service did.

    Returns:
        The response model, with `null` for what does not apply.
    """
    item = outcome.item
    product = outcome.product
    return ScanResultOut(
        status=outcome.status,
        mode=outcome.mode,
        ean=outcome.ean,
        name=None if product is None else product.name,
        image_url=None if product is None else product.image_url,
        quantity_before=outcome.quantity_before,
        quantity_after=None if item is None else item.quantity,
        unit=None if item is None else item.unit,
        movement_id=None if outcome.movement is None else outcome.movement.id,
        low=None if item is None else item.is_low,
    )


@router.post("/scan", response_model=ScanResultOut)
def scan(
    payload: ScanRequest,
    service: ScanService = Depends(get_scan_service),
    source: str | None = Depends(get_source),
) -> ScanResultOut:
    """Applies a scanned code: one unit in (`purchase`) or one unit out (`consume`).

    Every outcome is a normal 200 answer, including an unknown code and a consume that
    changed nothing: the client queues or reports it, it does not handle an exception.

    Args:
        payload: The code, the mode and, for a new product, where it goes.
        service: The scan service.
        source: Where the scan comes from, from the `X-HomeStock-Source` header.

    Returns:
        What happened, and the movement id so the client can undo it.
    """
    outcome = service.scan(
        payload.ean, payload.mode, payload.location, source or SOURCE_SCAN
    )
    return _to_out(outcome)
