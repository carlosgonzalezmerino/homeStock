import logging

import httpx

from app.settings import settings
from app.sources.base import ProductData

logger = logging.getLogger(__name__)


class MercadonaSource:
    name = "mercadona"

    def __init__(
        self,
        client: httpx.Client | None = None,
        timeout: float | None = None,
    ) -> None:
        self._client = client
        self._timeout = timeout if timeout is not None else settings.mercadona_timeout

    def lookup(self, ean: str) -> ProductData | None:
        try:
            id = ean[-5:-1]
            if self._client is not None:
                response = self._client.get(settings.mercadona_base_url.format(id=id))
            else:
                response = httpx.get(settings.mercadona_base_url.format(id=id), timeout=self._timeout)
            if response.status_code != 200:
                logger.warning(
                    "mercadona non-200 for %s: %s", ean, response.status_code
                )
                return None
            body = response.json()
            name = body["display_name"]
        except Exception as exc:  # best-effort: never propagate
            logger.warning("mercadona lookup failed for %s: %s", ean, exc)
            return None

        nutrition = body.get("nutrition_information") or {}
        return ProductData(
            ean=ean,
            name=name,
            source="mercadona",
            brand=body.get("brand"),
            image_url=body.get("thumbnail"),
            category=body.get("category"),
            quantity_desc=body.get("packaging"),
            kcal_per_100g=nutrition.get("energy_kcal"),
            fat_per_100g=nutrition.get("total_fat"),
            saturated_fat_per_100g=nutrition.get("saturated_fat"),
            carbs_per_100g=nutrition.get("carbohydrates"),
            sugars_per_100g=nutrition.get("total_sugars"),
            fiber_per_100g=nutrition.get("dietary_fiber"),
            proteins_per_100g=nutrition.get("proteins"),
            salt_per_100g=nutrition.get("salt"),
        )
