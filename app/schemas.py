from pydantic import BaseModel, ConfigDict


class _NutritionMixin(BaseModel):
    kcal_per_100g: float | None = None
    fat_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    carbs_per_100g: float | None = None
    sugars_per_100g: float | None = None
    fiber_per_100g: float | None = None
    proteins_per_100g: float | None = None
    salt_per_100g: float | None = None


class ProductOut(_NutritionMixin):
    model_config = ConfigDict(from_attributes=True)

    ean: str
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None
    source: str


class ProductCreate(_NutritionMixin):
    ean: str
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None


class ProductPatch(_NutritionMixin):
    name: str | None = None
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None


class InventoryCreate(BaseModel):
    ean: str
    quantity: float
    threshold: float
    unit: str = "units"
    location: str | None = None


class InventoryPatch(BaseModel):
    quantity: float | None = None
    threshold: float | None = None
    unit: str | None = None
    location: str | None = None


class InventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    ean: str
    quantity: float
    threshold: float
    unit: str
    location: str | None = None


class InventoryWithProductOut(BaseModel):
    inventory: InventoryOut
    product: ProductOut
    low: bool


class ShoppingListItemOut(BaseModel):
    ean: str
    name: str
    quantity: float
    threshold: float
    unit: str
    image_url: str | None = None


class EanNotFound(BaseModel):
    ean: str
