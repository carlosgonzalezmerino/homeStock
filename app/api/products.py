from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_product_repo
from app.models import Product
from app.repositories.products import ProductRepository
from app.schemas import ProductCreate, ProductOut, ProductPatch

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def search_products(
    q: str = Query(default="", max_length=100),
    repo: ProductRepository = Depends(get_product_repo),
) -> list[Product]:
    return repo.search(q)


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductCreate, repo: ProductRepository = Depends(get_product_repo)
) -> Product:
    product = Product(source="manual", **payload.model_dump())
    return repo.create(product)


@router.get("/{ean}", response_model=ProductOut)
def get_product(
    ean: str, repo: ProductRepository = Depends(get_product_repo)
) -> Product:
    product = repo.get(ean)
    if product is None:
        raise HTTPException(status_code=404, detail={"ean": ean})
    return product


@router.patch("/{ean}", response_model=ProductOut)
def patch_product(
    ean: str,
    payload: ProductPatch,
    repo: ProductRepository = Depends(get_product_repo),
) -> Product:
    product = repo.update_fields(ean, payload.model_dump(exclude_unset=True))
    if product is None:
        raise HTTPException(status_code=404, detail={"ean": ean})
    return product
