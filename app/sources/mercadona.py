import logging

import httpx

from app.sources.base import ProductData

logger = logging.getLogger(__name__)

# NOTE: exact endpoint shape is best-effort and must be verified during
# implementation (see spec "Open Implementation Notes"). On ANY failure we
# fall through — so an inexact URL degrades to "miss", never a crash.
_BASE_URL = "https://tienda.mercadona.es/api/products/{ean}"


class MercadonaSource:
    name = "mercadona"

    def __init__(
        self, client: httpx.Client | None = None, timeout: float = 3.0
    ) -> None:
        self._client = client or httpx.Client(timeout=timeout)

    def lookup(self, ean: str) -> ProductData | None:
        try:
            response = self._client.get(_BASE_URL.format(ean=ean))
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
