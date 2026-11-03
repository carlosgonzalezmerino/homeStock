from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.api.deps import get_inventory_service, get_source
from app.constants import SOURCE_APP
from app.schemas import (
    InventoryCreate,
    InventoryOut,
    InventoryPatch,
    InventoryWithProductOut,
    ProductOut,
)
from app.services.inventory import (
    AlreadyTrackedError,
    FreezerFieldsError,
    InventoryService,
    MovementContext,
    ProductNotFoundError,
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _freezer_fields_error(exc: FreezerFieldsError) -> HTTPException:
    """Builds the 422 response for a freezer-only field sent outside the freezer.

    Args:
        exc: The error raised by the service.

    Returns:
        An HTTP exception carrying the explanation for the client.
    """
    return HTTPException(
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY, detail={"message": str(exc)}
    )


@router.get("", response_model=list[InventoryWithProductOut])
def list_inventory(
    low: bool = Query(default=False),
    service: InventoryService = Depends(get_inventory_service),
) -> list[InventoryWithProductOut]:
    """Lists the tracked items with their product.

    Args:
        low: When true, only the items that need restocking are returned.
        service: The inventory service.

    Returns:
        Each item with its product and a flag that says whether it is low on stock.
    """
    rows = service.list_items(low_only=low)
    return [
        InventoryWithProductOut(
            inventory=InventoryOut.model_validate(item),
            product=ProductOut.model_validate(product),
            low=item.is_low,
        )
        for item, product in rows
    ]


@router.post("", response_model=InventoryOut, status_code=HTTPStatus.CREATED)
def create_inventory(
    payload: InventoryCreate,
    service: InventoryService = Depends(get_inventory_service),
    source: str | None = Depends(get_source),
) -> InventoryOut:
    """Starts tracking a product that is in the catalogue.

    Args:
        payload: The stock to store.
        service: The inventory service.
        source: Where the request comes from, from the `X-HomeStock-Source` header.

    Returns:
        The stored item.

    Raises:
        HTTPException: 404 when the product is not in the catalogue, 409 when it is
            already tracked, 422 when a freezer-only field is sent outside the freezer.
    """
    try:
        item = service.start_tracking(
            **payload.model_dump(), source=source or SOURCE_APP
        )
    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND, detail={"ean": payload.ean}
        ) from exc
    except AlreadyTrackedError as exc:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT, detail={"ean": payload.ean}
        ) from exc
    except FreezerFieldsError as exc:
        raise _freezer_fields_error(exc) from exc
    return InventoryOut.model_validate(item)


@router.patch("/{ean}", response_model=InventoryOut)
def patch_inventory(
    ean: str,
    payload: InventoryPatch,
    service: InventoryService = Depends(get_inventory_service),
    source: str | None = Depends(get_source),
) -> InventoryOut:
    """Edits the stock of a tracked product. Only the fields that are sent change.

    `reason` is not a column: it says why the quantity changed and goes to the diary.

    Args:
        ean: The product's barcode.
        payload: The fields to change.
        service: The inventory service.
        source: Where the request comes from, from the `X-HomeStock-Source` header.

    Returns:
        The updated item.

    Raises:
        HTTPException: 404 when the product is not tracked, 422 when a freezer-only
            field would stay set outside the freezer.
    """
    fields = payload.model_dump(exclude_unset=True)
    context = MovementContext(fields.pop("reason", None), source or SOURCE_APP)
    try:
        item = service.update(ean, fields, context)
    except FreezerFieldsError as exc:
        raise _freezer_fields_error(exc) from exc
    if item is None:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail={"ean": ean})
    return InventoryOut.model_validate(item)


@router.delete("/{ean}", status_code=HTTPStatus.NO_CONTENT)
def delete_inventory(
    ean: str,
    service: InventoryService = Depends(get_inventory_service),
    source: str | None = Depends(get_source),
) -> Response:
    """Stops tracking a product. Its catalogue entry and its history are kept.

    Args:
        ean: The product's barcode.
        service: The inventory service.
        source: Where the request comes from, from the `X-HomeStock-Source` header.

    Returns:
        An empty 204 response.

    Raises:
        HTTPException: 404 when the product is not tracked.
    """
    if not service.stop_tracking(ean, source or SOURCE_APP):
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail={"ean": ean})
    return Response(status_code=HTTPStatus.NO_CONTENT)
