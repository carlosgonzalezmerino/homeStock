from app.models import Product
from app.services.resolver import ProductResolver
from app.sources.base import ProductData


class FakeProductRepo:
    def __init__(self, existing: dict[str, Product] | None = None) -> None:
        self.store = existing or {}
        self.upserts: list[ProductData] = []

    def get(self, ean: str) -> Product | None:
        return self.store.get(ean)

    def upsert_from_source(self, data: ProductData) -> Product:
        self.upserts.append(data)
        product = Product(ean=data.ean, name=data.name, source=data.source)
        self.store[data.ean] = product
        return product


class FakeSource:
    def __init__(self, name: str, result: ProductData | None) -> None:
        self.name = name
        self._result = result
        self.calls: list[str] = []

    def lookup(self, ean: str) -> ProductData | None:
        self.calls.append(ean)
        return self._result


def test_local_hit_skips_sources() -> None:
    repo = FakeProductRepo({"1": Product(ean="1", name="Local", source="manual")})
    merc = FakeSource("mercadona", None)
    resolver = ProductResolver(repo, [merc])
    result = resolver.resolve("1")
    assert result.name == "Local"
    assert merc.calls == []  # never queried a source
    assert repo.upserts == []  # no write-back


def test_first_source_hit_writes_back_and_stops() -> None:
    repo = FakeProductRepo()
    merc = FakeSource("mercadona", ProductData(ean="2", name="M", source="mercadona"))
    off = FakeSource(
        "openfoodfacts", ProductData(ean="2", name="O", source="openfoodfacts")
    )
    resolver = ProductResolver(repo, [merc, off])
    result = resolver.resolve("2")
    assert result.name == "M"
    assert result.source == "mercadona"
    assert off.calls == []  # short-circuited before OFF
    assert len(repo.upserts) == 1  # written back once


def test_falls_through_to_second_source() -> None:
    repo = FakeProductRepo()
    merc = FakeSource("mercadona", None)
    off = FakeSource(
        "openfoodfacts", ProductData(ean="3", name="O", source="openfoodfacts")
    )
    resolver = ProductResolver(repo, [merc, off])
    result = resolver.resolve("3")
    assert result.source == "openfoodfacts"
    assert merc.calls == ["3"] and off.calls == ["3"]


def test_all_miss_returns_none() -> None:
    repo = FakeProductRepo()
    resolver = ProductResolver(repo, [FakeSource("m", None), FakeSource("o", None)])
    assert resolver.resolve("404") is None
    assert repo.upserts == []
