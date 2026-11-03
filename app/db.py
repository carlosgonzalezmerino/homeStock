from collections.abc import Iterator

from sqlalchemy import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.settings import settings

_engine: Engine | None = None


def get_engine(url: str = settings.database_url) -> Engine:
    """Builds a database engine.

    An in-memory SQLite URL gets a shared connection, so every session sees the same
    data.

    Args:
        url: The SQLAlchemy URL of the database.

    Returns:
        The engine for that database.
    """
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
    """Creates every table from the models, without recording a migration version.

    The application schema is managed by Alembic. This helper is for tests that need an
    empty throwaway database.

    Args:
        engine: The engine of the database to fill.
    """
    SQLModel.metadata.create_all(engine)


def set_engine(engine: Engine) -> None:
    """Sets the engine that request sessions use.

    Args:
        engine: The engine to use from now on.
    """
    global _engine
    _engine = engine


def is_engine_set() -> bool:
    """Tells whether an engine has been set.

    Returns:
        `True` when `set_engine` has been called.
    """
    return _engine is not None


def get_session() -> Iterator[Session]:
    """Provides a database session for one request, closed afterwards.

    Yields:
        A session bound to the configured engine.

    Raises:
        RuntimeError: When no engine has been set.
    """
    if _engine is None:
        raise RuntimeError("engine not initialized; call set_engine()")
    with Session(_engine) as session:
        yield session
