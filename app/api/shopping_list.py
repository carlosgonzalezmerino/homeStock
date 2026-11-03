from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import get_shopping_list_service
from app.schemas import (
    PurchaseSummaryOut,
    ShoppingListItemCreate,
    ShoppingListItemOut,
    ShoppingListItemPatch,
)
from app.services.inventory import ProductNotFoundError
from app.services.shopping_list import (
    ShoppingItemNotFoundError,
    ShoppingLine,
    ShoppingListService,
)

router = APIRouter(prefix="/api/shopping-list", tags=["shopping-list"])


def _to_out(line: ShoppingLine) -> ShoppingListItemOut:
    """Builds the API view of a line of the list.

    Args:
        line: The line, with its product and current stock.

    Returns:
        The response model.
    """
    return ShoppingListItemOut(
        ean=line.item.ean,
        name=line.product.name,
        brand=line.product.brand,
        image_url=line.product.image_url,
        quantity=line.item.quantity,
        checked=line.item.checked,
        in_stock=line.in_stock,
        unit=line.unit,
    )


def _not_found(ean: str) -> HTTPException:
    """Builds the 404 answer for a product that is not on the list.

    Args:
        ean: The barcode that was asked for.

    Returns:
        An HTTP exception carrying the EAN.
    """
    return HTTPException(status_code=HTTPStatus.NOT_FOUND, detail={"ean": ean})


@router.get("", response_model=list[ShoppingListItemOut])
def get_shopping_list(
    service: ShoppingListService = Depends(get_shopping_list_service),
) -> list[ShoppingListItemOut]:
    """Lists what the user has put on the list, with the stock of each product.

    Being out of stock never puts a product here: the list holds only what was added.

    Args:
        service: The shopping list service.

    Returns:
        One line per product, oldest first.
    """
    return [_to_out(line) for line in service.lines()]


@router.post("", response_model=ShoppingListItemOut)
def add_to_shopping_list(
    payload: ShoppingListItemCreate,
    response: Response,
    service: ShoppingListService = Depends(get_shopping_list_service),
) -> ShoppingListItemOut:
    """Puts a catalogue product on the list. If it is already there, sums the quantity.

    Args:
        payload: The product and how much to buy.
        response: Used to answer 201 for a new line and 200 for a summed one.
        service: The shopping list service.

    Returns:
        The line.

    Raises:
        HTTPException: 404 when the product is not in the catalogue.
    """
    try:
        line, is_new = service.add(payload.ean, payload.quantity)
    except ProductNotFoundError as exc:
        raise _not_found(payload.ean) from exc
    response.status_code = HTTPStatus.CREATED if is_new else HTTPStatus.OK
    return _to_out(line)


@router.post("/purchase", response_model=PurchaseSummaryOut)
def register_purchase(
    service: ShoppingListService = Depends(get_shopping_list_service),
) -> PurchaseSummaryOut:
    """Puts every picked-up line into the stock and takes it off the list.

    All or nothing. A product that was not in the pantry is created there.

    Args:
        service: The shopping list service.

    Returns:
        How many lines were registered and how many of those were new in the pantry.
    """
    summary = service.purchase()
    return PurchaseSummaryOut(added=summary.added, created=summary.created)


@router.patch("/{ean}", response_model=ShoppingListItemOut)
def patch_shopping_list_item(
    ean: str,
    payload: ShoppingListItemPatch,
    service: ShoppingListService = Depends(get_shopping_list_service),
) -> ShoppingListItemOut:
    """Changes the quantity to buy or the picked-up mark of a line.

    Args:
        ean: The product's barcode.
        payload: The fields to change.
        service: The shopping list service.

    Returns:
        The updated line.

    Raises:
        HTTPException: 404 when the product is not on the list.
    """
    try:
        line = service.update(ean, payload.model_dump(exclude_unset=True))
    except ShoppingItemNotFoundError as exc:
        raise _not_found(ean) from exc
    return _to_out(line)


@router.delete("/{ean}", status_code=HTTPStatus.NO_CONTENT)
def remove_from_shopping_list(
    ean: str, service: ShoppingListService = Depends(get_shopping_list_service)
) -> Response:
    """Takes a product off the list.

    Args:
        ean: The product's barcode.
        service: The shopping list service.

    Returns:
        An empty 204 response.

    Raises:
        HTTPException: 404 when the product is not on the list.
    """
    try:
        service.remove(ean)
    except ShoppingItemNotFoundError as exc:
        raise _not_found(ean) from exc
    return Response(status_code=HTTPStatus.NO_CONTENT)
