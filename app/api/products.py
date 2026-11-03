from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_product_repo
from app.models import Product
from app.repositories.products import ProductRepository
from app.schemas import ProductCreate, ProductOut, ProductPatch

router = APIRouter(prefix="/api/products", tags=["products"])

# Longest search text accepted, so a request cannot ask for an unbounded pattern.
SEARCH_QUERY_MAX_LENGTH = 100


@router.get("", response_model=list[ProductOut])
def search_products(
    q: str = Query(default="", max_length=SEARCH_QUERY_MAX_LENGTH),
    repo: ProductRepository = Depends(get_product_repo),
) -> list[Product]:
    """Searches the catalogue by name or brand.

    Args:
        q: The text to look for.
        repo: The product repository.

    Returns:
        The matching products, up to a fixed limit.
    """
    return repo.search(q)


@router.post("", response_model=ProductOut, status_code=HTTPStatus.CREATED)
def create_product(
    payload: ProductCreate, repo: ProductRepository = Depends(get_product_repo)
) -> Product:
    """Creates a product by hand. Its source is recorded as `manual`.

    Args:
        payload: The product fields.
        repo: The product repository.

    Returns:
        The created product.

    Raises:
        HTTPException: 409 when a product with that EAN already exists.
    """
    if repo.get(payload.ean) is not None:
        raise HTTPException(
            status_code=HTTPStatus.CONFLICT, detail={"ean": payload.ean}
        )
    product = Product(source="manual", **payload.model_dump())
    return repo.create(product)


@router.get("/{ean}", response_model=ProductOut)
def get_product(
    ean: str, repo: ProductRepository = Depends(get_product_repo)
) -> Product:
    """Reads one product from the catalogue.

    Args:
        ean: The product's barcode.
        repo: The product repository.

    Returns:
        The product.

    Raises:
        HTTPException: 404 when the product is not in the catalogue.
    """
    product = repo.get(ean)
    if product is None:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail={"ean": ean})
    return product


@router.patch("/{ean}", response_model=ProductOut)
def patch_product(
    ean: str,
    payload: ProductPatch,
    repo: ProductRepository = Depends(get_product_repo),
) -> Product:
    """Edits a product. Only the fields that are sent change.

    Args:
        ean: The product's barcode.
        payload: The fields to change.
        repo: The product repository.

    Returns:
        The updated product.

    Raises:
        HTTPException: 404 when the product is not in the catalogue.
    """
    product = repo.update_fields(ean, payload.model_dump(exclude_unset=True))
    if product is None:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail={"ean": ean})
    return product
