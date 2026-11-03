import logging
from http import HTTPStatus

import httpx

from app.settings import settings
from app.sources.base import ProductData

logger = logging.getLogger(__name__)

# Mercadona's internal product id is guessed from the middle digits of the EAN.
# It is unreliable, which is why every failure falls through to the next source.
_ID_START = -5
_ID_END = -1


def _product_id(ean: str) -> str:
    """Guesses Mercadona's internal product id from an EAN.

    Args:
        ean: The product's barcode.

    Returns:
        The digits Mercadona's API uses as the product id.
    """
    return ean[_ID_START:_ID_END]


class MercadonaSource:
    """Best-effort client for Mercadona's product API.

    Any failure (network, status, unexpected body) is logged and reported as "not
    found", so the resolver can try the next source instead of failing.
    """

    name = "mercadona"

    def __init__(
        self,
        client: httpx.Client | None = None,
        timeout: float | None = None,
    ) -> None:
        """Creates the client.

        Args:
            client: HTTP client to use. When omitted, each lookup makes a one-off
                request.
            timeout: Seconds to wait for a response. Defaults to the configured timeout.
        """
        self._client = client
        self._timeout = timeout if timeout is not None else settings.mercadona_timeout

    def lookup(self, ean: str) -> ProductData | None:
        """Looks a product up on Mercadona's API.

        Args:
            ean: The barcode to look for.

        Returns:
            The product data, or `None` when Mercadona does not answer usefully.
        """
        response = self._fetch(ean)
        if response is None:
            return None
        return self._parse(ean, response)

    def _fetch(self, ean: str) -> httpx.Response | None:
        """Requests the product page.

        Args:
            ean: The barcode to look for.

        Returns:
            The response, or `None` on a network error or a status other than 200.
        """
        url = settings.mercadona_base_url.format(id=_product_id(ean))
        try:
            response = self._send(url)
        except httpx.HTTPError as exc:
            logger.warning("mercadona lookup failed for %s: %s", ean, exc)
            return None
        if response.status_code != HTTPStatus.OK:
            logger.warning("mercadona non-200 for %s: %s", ean, response.status_code)
            return None
        return response

    def _send(self, url: str) -> httpx.Response:
        """Sends the GET request with the configured client or a one-off request.

        Args:
            url: The address to request.

        Returns:
            The HTTP response.
        """
        if self._client is not None:
            return self._client.get(url)
        return httpx.get(url, timeout=self._timeout)

    def _parse(self, ean: str, response: httpx.Response) -> ProductData | None:
        """Turns Mercadona's JSON into product data.

        Args:
            ean: The barcode that was requested.
            response: A successful response from Mercadona.

        Returns:
            The product data, or `None` when the body is not the expected JSON.
        """
        try:
            body = response.json()
            name = body["display_name"]
        except (ValueError, KeyError, TypeError) as exc:
            logger.warning("mercadona returned an unexpected body for %s: %s", ean, exc)
            return None
        return _to_product_data(ean, name, body)


def _to_product_data(ean: str, name: str, body: dict) -> ProductData:
    """Maps Mercadona's field names to product data.

    Args:
        ean: The barcode that was requested.
        name: The product name from the response.
        body: The decoded JSON of the response.

    Returns:
        The product data, with nutrition filled in when Mercadona provides it.
    """
    nutrition = body.get("nutrition_information")
    if not isinstance(nutrition, dict):
        nutrition = {}
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
