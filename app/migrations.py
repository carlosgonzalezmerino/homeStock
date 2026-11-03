"""Runs the Alembic migrations of the homeStock schema against a database URL."""

from pathlib import Path

from alembic.config import Config

from alembic import command

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def alembic_config(url: str) -> Config:
    """Builds the Alembic configuration for a database.

    Args:
        url: The SQLAlchemy URL of the database to migrate.

    Returns:
        A configuration that the Alembic commands can run with.
    """
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(PROJECT_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return config


def upgrade_to_head(url: str) -> None:
    """Applies every migration that the database has not received yet.

    Args:
        url: The SQLAlchemy URL of the database to upgrade.
    """
    command.upgrade(alembic_config(url), "head")
