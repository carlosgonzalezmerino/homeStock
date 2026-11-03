from fastapi import Depends
from sqlmodel import Session

from app.db import get_session
from app.repositories.inventory import InventoryRepository
from app.repositories.off import OffProductRepository
from app.repositories.products import ProductRepository
from app.services.inventory import InventoryService
from app.services.resolver import ProductResolver
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
) -> InventoryService:
    """Provides the inventory service for one request.

    Args:
        inventory: Access to the inventory rows.
        products: Access to the catalogue.

    Returns:
        The service.
    """
    return InventoryService(inventory, products)


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
