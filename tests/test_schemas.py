from app.models import InventoryItem, Product
from app.schemas import InventoryOut, ProductOut, ProductPatch


def test_product_out_reads_from_orm() -> None:
    product = Product(ean="1", name="Milk", source="manual", kcal_per_100g=42.0)
    out = ProductOut.model_validate(product)
    assert out.ean == "1"
    assert out.kcal_per_100g == 42.0


def test_product_patch_all_optional() -> None:
    patch = ProductPatch()
    assert patch.model_dump(exclude_unset=True) == {}


def test_inventory_out_reads_from_orm() -> None:
    item = InventoryItem(id=1, ean="1", quantity=2, threshold=1, unit="L")
    out = InventoryOut.model_validate(item)
    assert out.id == 1
    assert out.quantity == 2
    assert out.unit == "L"
