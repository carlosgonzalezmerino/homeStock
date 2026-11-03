import json

from scripts.export_openapi import OPENAPI_PATH, render_openapi

UPDATE_HINT = (
    "Run `uv run python -m scripts.export_openapi` and commit docs/openapi.json."
)
FREEZER_FIELDS = {"drawer", "frozen_at", "notes"}


def test_committed_openapi_matches_the_application() -> None:
    assert OPENAPI_PATH.read_text() == render_openapi(), UPDATE_HINT


def test_openapi_exposes_the_freezer_fields_of_inventory() -> None:
    schemas = json.loads(OPENAPI_PATH.read_text())["components"]["schemas"]
    for name in ("InventoryCreate", "InventoryPatch", "InventoryOut"):
        assert FREEZER_FIELDS <= set(schemas[name]["properties"]), name


def test_openapi_lists_the_endpoints_the_frontend_calls() -> None:
    paths = json.loads(OPENAPI_PATH.read_text())["paths"]
    assert {
        "/api/health",
        "/api/resolve/{ean}",
        "/api/products",
        "/api/products/{ean}",
        "/api/inventory",
        "/api/inventory/{ean}",
        "/api/shopping-list",
    } <= set(paths)
