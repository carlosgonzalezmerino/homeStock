from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.api.deps import get_inventory_service
from app.schemas import (
    InventoryCreate,
    InventoryOut,
    InventoryPatch,
    InventoryWithProductOut,
    ProductOut,
)
from app.services.inventory import (
    AlreadyTrackedError,
    InventoryService,
    ProductNotFoundError,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("", response_model=list[InventoryWithProductOut])
def list_inventory(
    low: bool = Query(default=False),
    service: InventoryService = Depends(get_inventory_service),
) -> list[InventoryWithProductOut]:
    rows = service.list_items(low_only=low)
    return [
        InventoryWithProductOut(
            inventory=InventoryOut.model_validate(item),
            product=ProductOut.model_validate(product),
            low=item.quantity < item.threshold,
        )
        for item, product in rows
    ]


@router.post("", response_model=InventoryOut, status_code=201)
def create_inventory(
    payload: InventoryCreate,
    service: InventoryService = Depends(get_inventory_service),
) -> InventoryOut:
    try:
        item = service.start_tracking(
            payload.ean,
            payload.quantity,
            payload.threshold,
            payload.unit,
            payload.location,
        )
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"ean": payload.ean}) from exc
    except AlreadyTrackedError as exc:
        raise HTTPException(status_code=409, detail={"ean": payload.ean}) from exc
    return InventoryOut.model_validate(item)


@router.patch("/{ean}", response_model=InventoryOut)
def patch_inventory(
    ean: str,
    payload: InventoryPatch,
    service: InventoryService = Depends(get_inventory_service),
) -> InventoryOut:
    item = service.update(ean, payload.model_dump(exclude_unset=True))
    if item is None:
        raise HTTPException(status_code=404, detail={"ean": ean})
    return InventoryOut.model_validate(item)


@router.delete("/{ean}", status_code=204)
def delete_inventory(
    ean: str, service: InventoryService = Depends(get_inventory_service)
) -> Response:
    if not service.stop_tracking(ean):
        raise HTTPException(status_code=404, detail={"ean": ean})
    return Response(status_code=204)
