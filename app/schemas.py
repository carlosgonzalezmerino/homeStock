from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.constants import (
    DEFAULT_UNIT,
    FREEZER_DRAWER_MAX,
    FREEZER_DRAWER_MIN,
    MAX_QUANTITY_DECIMALS,
    NOTES_MAX_LENGTH,
)

Location = Literal["pantry", "freezer"]
ClientReason = Literal["purchase", "consume", "waste", "adjust"]
ScanMode = Literal["purchase", "consume"]
ScanStatus = Literal["applied", "created", "already_empty", "not_tracked", "unknown"]
ReviewReason = Literal["overdue", "stale"]


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
    """A catalogue product as the API returns it."""

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
    """The fields needed to create a product by hand."""

    ean: str
    name: str
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None


class ProductPatch(_NutritionMixin):
    """A partial edit of a product. Only the fields that are sent change."""

    name: str | None = None
    brand: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    quantity_desc: str | None = None


def check_max_decimals(value: float | None) -> float | None:
    """Rejects quantities that have more decimal places than the product allows.

    Args:
        value: The quantity or threshold to check. `None` means the field was not sent.

    Returns:
        The same value, unchanged.

    Raises:
        ValueError: When the value has more than `MAX_QUANTITY_DECIMALS` decimal places.
    """
    if value is not None and round(value, MAX_QUANTITY_DECIMALS) != value:
        raise ValueError(f"admite como máximo {MAX_QUANTITY_DECIMALS} decimales")
    return value


def clean_notes(value: str | None) -> str | None:
    """Trims a note and turns an empty one into `None`.

    Args:
        value: The note as sent by the client.

    Returns:
        The trimmed note, or `None` when nothing is left after trimming.

    Raises:
        ValueError: When the trimmed note is longer than `NOTES_MAX_LENGTH`.
    """
    if value is None:
        return None
    trimmed = value.strip()
    if len(trimmed) > NOTES_MAX_LENGTH:
        raise ValueError(f"no puede superar {NOTES_MAX_LENGTH} caracteres")
    return trimmed or None


def reject_null(value: object) -> object:
    """Refuses an explicit `null` for a field that must always have a value.

    Args:
        value: The value as sent by the client.

    Returns:
        The same value when it is not `None`.

    Raises:
        ValueError: When the value is `None`.
    """
    if value is None:
        raise ValueError("no puede ser nulo")
    return value


class InventoryCreate(BaseModel):
    """The stock to store for a product.

    Quantities cannot be negative and have at most two decimals.
    """

    ean: str
    quantity: float = Field(ge=0, allow_inf_nan=False)
    threshold: float = Field(ge=0, allow_inf_nan=False)
    unit: str = DEFAULT_UNIT
    location: Location | None = None
    drawer: int | None = Field(
        default=None, ge=FREEZER_DRAWER_MIN, le=FREEZER_DRAWER_MAX
    )
    frozen_at: date | None = None
    notes: str | None = None

    _check_decimals = field_validator("quantity", "threshold")(check_max_decimals)
    _clean_notes = field_validator("notes")(clean_notes)


class InventoryPatch(BaseModel):
    """A partial edit of a stock row.

    Quantity, threshold and unit can be changed but never cleared. `reason` is not a
    column: it says why the quantity changed and goes to the diary of stock changes.
    """

    quantity: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    threshold: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    unit: str | None = None
    location: Location | None = None
    drawer: int | None = Field(
        default=None, ge=FREEZER_DRAWER_MIN, le=FREEZER_DRAWER_MAX
    )
    frozen_at: date | None = None
    notes: str | None = None
    reason: ClientReason | None = None

    _reject_null_required = field_validator("quantity", "threshold", "unit")(
        reject_null
    )
    _check_decimals = field_validator("quantity", "threshold")(check_max_decimals)
    _clean_notes = field_validator("notes")(clean_notes)


class InventoryOut(BaseModel):
    """A stock row as the API returns it."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ean: str
    quantity: float
    threshold: float
    unit: str
    location: str | None = None
    drawer: int | None = None
    frozen_at: date | None = None
    notes: str | None = None


class InventoryWithProductOut(BaseModel):
    """A stock row together with its product and whether it is low on stock."""

    inventory: InventoryOut
    product: ProductOut
    low: bool


class ShoppingListItemOut(BaseModel):
    """One line of the shopping list."""

    ean: str
    name: str
    quantity: float
    threshold: float
    unit: str
    image_url: str | None = None


class EanNotFound(BaseModel):
    """Body of the 404 answer when an EAN is not known."""

    ean: str


class MovementOut(BaseModel):
    """One change of the stock of a product, as the diary returns it."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ean: str
    delta: float
    quantity_after: float
    reason: str
    source: str
    price: float | None = None
    undoes_id: int | None = None
    undone: bool = False
    created_at: datetime


class ScanRequest(BaseModel):
    """A code read by a scanner, and what to do with it."""

    ean: str = Field(min_length=1, max_length=64)
    mode: ScanMode
    location: Location | None = None


class ScanResultOut(BaseModel):
    """What happened when a code was scanned. Every outcome is a normal 200 answer."""

    status: ScanStatus
    mode: ScanMode
    ean: str
    name: str | None = None
    image_url: str | None = None
    quantity_before: float | None = None
    quantity_after: float | None = None
    unit: str | None = None
    movement_id: int | None = None
    low: bool | None = None


class ReviewCandidateOut(BaseModel):
    """A product the weekly review asks about."""

    ean: str
    name: str
    brand: str | None = None
    image_url: str | None = None
    quantity: float
    unit: str
    reason: ReviewReason
    estimated_empty_on: date | None = None
    days_since_activity: int
