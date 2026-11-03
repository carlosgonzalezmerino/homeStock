from fastapi import FastAPI

from app.api import inventory, products, resolve, shopping_list
from app.db import get_engine, is_engine_set, set_engine


def create_app() -> FastAPI:
    """Builds the FastAPI application with all its routers.

    Returns:
        The application, ready to be served or tested.
    """
    app = FastAPI(title="homeStock")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        """Reports that the service is up."""
        return {"status": "ok"}

    app.include_router(resolve.router)
    app.include_router(products.router)
    app.include_router(inventory.router)
    app.include_router(shopping_list.router)
    return app


def _bootstrap() -> FastAPI:
    """Sets the default engine, unless a test already set one, and builds the app.

    The schema is not created here: run `alembic upgrade head` first.

    Returns:
        The application.
    """
    if not is_engine_set():
        set_engine(get_engine())
    return create_app()


app = _bootstrap()
