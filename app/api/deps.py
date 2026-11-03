from http import HTTPStatus

from fastapi import Depends, Header, HTTPException
from sqlmodel import Session

from app.constants import CLIENT_SOURCES, SOURCE_HEADER
from app.db import get_session
from app.repositories.inventory import InventoryRepository
from app.repositories.movements import MovementRepository
from app.repositories.off import OffProductRepository
from app.repositories.products import ProductRepository
from app.services.inventory import InventoryService
from app.services.movements import MovementService
from app.services.resolver import ProductResolver
from app.services.review import ReviewService
from app.services.scan import ScanService
from app.services.shopping_list import ShoppingListService
from app.sources.openfoodfacts import OffSource


def get_product_repo(session: Session = Depends(get_session)) -> ProductRepository:
    """Provides the product repository for one request.

    Args:
        session: The request's database session.

    Returns:
        A repository over that session.
    """
    return ProductRepository(session)


def get_inventory_repo(
    session: Session = Depends(get_session),
) -> InventoryRepository:
    """Provides the inventory repository for one request.

    Args:
        session: The request's database session.

    Returns:
        A repository over that session.
    """
    return InventoryRepository(session)


def get_movement_repo(
    session: Session = Depends(get_session),
) -> MovementRepository:
    """Provides the movement repository for one request.

    Args:
        session: The request's database session.

    Returns:
        A repository over that session.
    """
    return MovementRepository(session)


def get_source(
    x_homestock_source: str | None = Header(default=None, alias=SOURCE_HEADER),
) -> str | None:
    """Reads and checks the header that says where a change comes from.

    Args:
        x_homestock_source: The header value, if the client sent one.

    Returns:
        The source, or `None` when the client did not say, so each endpoint can
        apply its own default.

    Raises:
        HTTPException: 422 when the value is not a source a client may send.
    """
    if x_homestock_source is not None and x_homestock_source not in CLIENT_SOURCES:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail={"message": f"Unknown {SOURCE_HEADER}: {x_homestock_source}"},
        )
    return x_homestock_source


def get_off_repo(session: Session = Depends(get_session)) -> OffProductRepository:
    """Provides the OpenFoodFacts repository for one request.

    Args:
        session: The request's database session.

    Returns:
        A repository over that session.
    """
    return OffProductRepository(session)


def get_resolver(
    products: ProductRepository = Depends(get_product_repo),
    off_repo: OffProductRepository = Depends(get_off_repo),
) -> ProductResolver:
    """Provides the EAN resolver: local catalogue first, then OpenFoodFacts.

    Mercadona is intentionally left out for now because its EAN to id derivation is
    unreliable. `MercadonaSource` stays available and tested for when it is re-enabled.

    Args:
        products: The local catalogue.
        off_repo: The imported OpenFoodFacts table.

    Returns:
        A resolver with the active sources.
    """
    sources = [OffSource(off_repo)]
    return ProductResolver(products, sources)


def get_inventory_service(
    inventory: InventoryRepository = Depends(get_inventory_repo),
    products: ProductRepository = Depends(get_product_repo),
    movements: MovementRepository = Depends(get_movement_repo),
) -> InventoryService:
    """Provides the inventory service for one request.

    Args:
        inventory: Access to the inventory rows.
        products: Access to the catalogue.
        movements: Access to the diary of stock changes.

    Returns:
        The service.
    """
    return InventoryService(inventory, products, movements)


def get_movement_service(
    movements: MovementRepository = Depends(get_movement_repo),
    inventory: InventoryService = Depends(get_inventory_service),
) -> MovementService:
    """Provides the movement service for one request.

    Args:
        movements: Access to the diary.
        inventory: The inventory service.

    Returns:
        The service.
    """
    return MovementService(movements, inventory)


def get_scan_service(
    resolver: ProductResolver = Depends(get_resolver),
    inventory: InventoryService = Depends(get_inventory_service),
) -> ScanService:
    """Provides the scan service for one request.

    Args:
        resolver: The EAN resolver.
        inventory: The inventory service.

    Returns:
        The service.
    """
    return ScanService(resolver, inventory)


def get_review_service(
    inventory: InventoryRepository = Depends(get_inventory_repo),
    products: ProductRepository = Depends(get_product_repo),
    movements: MovementRepository = Depends(get_movement_repo),
) -> ReviewService:
    """Provides the weekly review service for one request.

    Args:
        inventory: Access to the inventory rows.
        products: Access to the catalogue.
        movements: Access to the diary.

    Returns:
        The service.
    """
    return ReviewService(inventory, products, movements)


def get_shopping_list_service(
    inventory: InventoryRepository = Depends(get_inventory_repo),
    products: ProductRepository = Depends(get_product_repo),
) -> ShoppingListService:
    """Provides the shopping list service for one request.

    Args:
        inventory: Access to the inventory rows.
        products: Access to the catalogue.

    Returns:
        The service.
    """
    return ShoppingListService(inventory, products)
