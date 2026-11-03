from http import HTTPStatus

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_resolver
from app.schemas import ProductOut
from app.services.resolver import ProductResolver

router = APIRouter(prefix="/api", tags=["resolve"])


@router.get("/resolve/{ean}", response_model=ProductOut)
def resolve_ean(ean: str, resolver: ProductResolver = Depends(get_resolver)) -> object:
    """Resolves a barcode to a product: the catalogue first, then the external sources.

    A 404 is a normal answer here: it tells the client to ask the user for the data.

    Args:
        ean: The barcode to resolve.
        resolver: The EAN resolver.

    Returns:
        The product, or a 404 response with the EAN when nobody knows it.
    """
    product = resolver.resolve(ean)
    if product is None:
        return JSONResponse(status_code=HTTPStatus.NOT_FOUND, content={"ean": ean})
    return product
