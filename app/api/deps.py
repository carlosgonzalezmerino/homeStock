from fastapi import Depends
from sqlmodel import Session

from app.db import get_session
from app.repositories.inventory import InventoryRepository
from app.repositories.off import OffProductRepository
from app.repositories.products import ProductRepository
from app.services.inventory import InventoryService
from app.services.resolver import ProductResolver
from app.services.shopping_list import ShoppingListService
from app.sources.mercadona import MercadonaSource
from app.sources.openfoodfacts import OffSource


def get_product_repo(session: Session = Depends(get_session)) -> ProductRepository:
    return ProductRepository(session)


def get_inventory_repo(
    session: Session = Depends(get_session),
) -> InventoryRepository:
    return InventoryRepository(session)


def get_off_repo(session: Session = Depends(get_session)) -> OffProductRepository:
    return OffProductRepository(session)


def get_resolver(
    products: ProductRepository = Depends(get_product_repo),
    off_repo: OffProductRepository = Depends(get_off_repo),
) -> ProductResolver:
    sources = [MercadonaSource(), OffSource(off_repo)]
    return ProductResolver(products, sources)


def get_inventory_service(
    inventory: InventoryRepository = Depends(get_inventory_repo),
    products: ProductRepository = Depends(get_product_repo),
) -> InventoryService:
    return InventoryService(inventory, products)


def get_shopping_list_service(
    inventory: InventoryRepository = Depends(get_inventory_repo),
    products: ProductRepository = Depends(get_product_repo),
) -> ShoppingListService:
    return ShoppingListService(inventory, products)
