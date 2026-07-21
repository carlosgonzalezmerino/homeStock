from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_resolver
from app.schemas import ProductOut
from app.services.resolver import ProductResolver

router = APIRouter(prefix="/api", tags=["resolve"])


@router.get("/resolve/{ean}", response_model=ProductOut)
def resolve_ean(ean: str, resolver: ProductResolver = Depends(get_resolver)) -> object:
    product = resolver.resolve(ean)
    if product is None:
        return JSONResponse(status_code=404, content={"ean": ean})
    return product
