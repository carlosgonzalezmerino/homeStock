import logging

from app.models import Product
from app.repositories.products import ProductRepository
from app.sources.base import ProductSource

logger = logging.getLogger(__name__)


class ProductResolver:
    """Finds a product by EAN: the local catalogue first, then each source in order."""

    def __init__(
        self, products: ProductRepository, sources: list[ProductSource]
    ) -> None:
        """Creates the resolver.

        Args:
            products: The local catalogue, which is also the cache.
            sources: External sources to try, in priority order.
        """
        self._products = products
        self._sources = sources

    def resolve(self, ean: str) -> Product | None:
        """Resolves an EAN to a stored product.

        A product found by a source is written to the catalogue, so each EAN reaches the
        sources at most once.

        Args:
            ean: The barcode to resolve.

        Returns:
            The product, or `None` when nobody knows it and it must be entered by hand.
        """
        local = self._products.get(ean)
        if local is not None:
            return local

        for source in self._sources:
            data = source.lookup(ean)
            if data is not None:
                logger.info("resolved %s via %s", ean, source.name)
                return self._products.upsert_from_source(data)

        return None
