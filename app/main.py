from fastapi import FastAPI

from app.api import inventory, products, resolve, shopping_list
from app.db import create_db_and_tables, get_engine, set_engine


def create_app() -> FastAPI:
    app = FastAPI(title="homeStock")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(resolve.router)
    app.include_router(products.router)
    app.include_router(inventory.router)
    app.include_router(shopping_list.router)
    return app


def _bootstrap() -> FastAPI:
    from app import db as db_module

    if db_module._engine is None:
        engine = get_engine()
        set_engine(engine)
        create_db_and_tables(engine)
    return create_app()


app = _bootstrap()
