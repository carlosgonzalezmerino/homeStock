"""Alembic environment: connects the migrations to the project database.

The URL comes from `sqlalchemy.url` when it is set (tests do this), otherwise from
`app.settings.settings.database_url`, which is also what the application uses.
"""

from logging.config import fileConfig

from sqlalchemy import create_engine
from sqlmodel import SQLModel

import app.models  # noqa: F401  registers every table on SQLModel.metadata
from alembic import context
from app.settings import settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = SQLModel.metadata


def database_url() -> str:
    """Returns the database URL that migrations run against.

    Returns:
        The `sqlalchemy.url` option when set, otherwise the application's database URL.
    """
    return config.get_main_option("sqlalchemy.url") or settings.database_url


def run_migrations_offline() -> None:
    """Writes the migration SQL to standard output, without a connection."""
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Applies the pending migrations on a live connection, inside one transaction."""
    engine = create_engine(database_url())
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=connection.dialect.name == "sqlite",
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
