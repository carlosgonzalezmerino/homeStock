from collections.abc import Iterator

from sqlalchemy import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.settings import settings

_engine: Engine | None = None


def get_engine(url: str = settings.database_url) -> Engine:
    if not url.startswith("sqlite"):
        return create_engine(url)

    connect_args = {"check_same_thread": False}
    if url == "sqlite://":
        # In-memory SQLite: use StaticPool so all connections share the same DB
        return create_engine(
            url,
            connect_args=connect_args,
            poolclass=StaticPool,
        )
    return create_engine(url, connect_args=connect_args)


def create_db_and_tables(engine: Engine) -> None:
    SQLModel.metadata.create_all(engine)


def set_engine(engine: Engine) -> None:
    global _engine
    _engine = engine


def is_engine_set() -> bool:
    return _engine is not None


def get_session() -> Iterator[Session]:
    if _engine is None:
        raise RuntimeError("engine not initialized; call set_engine()")
    with Session(_engine) as session:
        yield session
