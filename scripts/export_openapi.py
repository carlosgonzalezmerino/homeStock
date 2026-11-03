import json
import sys
from pathlib import Path

from app.main import create_app

# Where the committed copy of the API description lives.
# The frontend contract test reads it.
OPENAPI_PATH = Path(__file__).resolve().parents[1] / "docs" / "openapi.json"


def render_openapi() -> str:
    """Describes the API as stable JSON text.

    Returns:
        The OpenAPI document with sorted keys and a final newline, so diffs stay small.
    """
    return json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n"


def main() -> None:
    """Command line entry point: writes the API description to `docs/openapi.json`."""
    OPENAPI_PATH.write_text(render_openapi())
    print(f"Wrote {OPENAPI_PATH}")


if __name__ == "__main__":
    main()
    sys.exit(0)
