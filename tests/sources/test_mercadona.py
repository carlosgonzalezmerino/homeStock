import httpx

from app.sources.mercadona import MercadonaSource


def _client(handler: httpx.MockTransport) -> httpx.Client:
    return httpx.Client(transport=handler)


def test_hit_returns_product_data() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "ean": "84001",
                "display_name": "Leche Hacendado",
                "brand": "Hacendado",
                "thumbnail": "http://img/leche.jpg",
                "nutrition_information": {"energy_kcal": 47.0},
            },
        )

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    result = source.lookup("84001")
    assert result is not None
    assert result.name == "Leche Hacendado"
    assert result.brand == "Hacendado"
    assert result.source == "mercadona"


def test_non_200_falls_through_to_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    assert source.lookup("84001") is None


def test_timeout_falls_through_to_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("boom")

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    assert source.lookup("84001") is None


def test_garbage_body_falls_through_to_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>not json</html>")

    source = MercadonaSource(client=_client(httpx.MockTransport(handler)))
    assert source.lookup("84001") is None
