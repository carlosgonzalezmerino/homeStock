import logging

from app.models import Product
from app.repositories.products import ProductRepository
from app.sources.base import ProductSource

logger = logging.getLogger(__name__)


class ProductResolver:
    def __init__(
        self, products: ProductRepository, sources: list[ProductSource]
    ) -> None:
        self._products = products
        self._sources = sources

    def resolve(self, ean: str) -> Product | None:
        local = self._products.get(ean)
        if local is not None:
            return local

        for source in self._sources:
            data = source.lookup(ean)
            if data is not None:
                logger.info("resolved %s via %s", ean, source.name)
                return self._products.upsert_from_source(data)

        return None
