"""Initial schema: products, off_products and inventory_items as created by create_all.

Databases that already exist were built this way before migrations were introduced.
They must be marked with `alembic stamp 0001` instead of running this file, because
the tables are already there.

Revision ID: 0001
Revises:
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TEXT_LENGTH = 255


def upgrade() -> None:
    """Creates the three tables and their indexes."""
    _create_products()
    _create_off_products()
    _create_inventory_items()


def _create_products() -> None:
    """Creates the catalogue table, with its nutrition columns and provenance."""
    op.create_table(
        "products",
        sa.Column("ean", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("name", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("brand", sa.String(_TEXT_LENGTH), nullable=True),
        sa.Column("description", sa.String(_TEXT_LENGTH), nullable=True),
        sa.Column("image_url", sa.String(_TEXT_LENGTH), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("quantity_desc", sa.String(_TEXT_LENGTH), nullable=True),
        *_nutrition_columns(),
        sa.Column("source", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("ean"),
    )


def _create_off_products() -> None:
    """Creates the imported OpenFoodFacts subset, indexed by EAN."""
    op.create_table(
        "off_products",
        sa.Column("ean", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("name", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("brand", sa.String(_TEXT_LENGTH), nullable=True),
        sa.Column("image_url", sa.String(_TEXT_LENGTH), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("quantity_desc", sa.String(_TEXT_LENGTH), nullable=True),
        *_nutrition_columns(),
        sa.PrimaryKeyConstraint("ean"),
    )
    op.create_index("ix_off_products_ean", "off_products", ["ean"], unique=False)


def _create_inventory_items() -> None:
    """Creates the stock table, with one row per tracked EAN."""
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ean", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("threshold", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("location", sa.String(_TEXT_LENGTH), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["ean"], ["products.ean"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_items_ean", "inventory_items", ["ean"], unique=True)


def _nutrition_columns() -> list[sa.Column]:
    """Builds the eight nutrition columns per 100 g, all nullable.

    Returns:
        The columns, in the same order as the models.
    """
    names = [
        "kcal_per_100g",
        "fat_per_100g",
        "saturated_fat_per_100g",
        "carbs_per_100g",
        "sugars_per_100g",
        "fiber_per_100g",
        "proteins_per_100g",
        "salt_per_100g",
    ]
    return [sa.Column(name, sa.Float(), nullable=True) for name in names]


def downgrade() -> None:
    """Drops the three tables, dependants first."""
    op.drop_index("ix_inventory_items_ean", table_name="inventory_items")
    op.drop_table("inventory_items")
    op.drop_index("ix_off_products_ean", table_name="off_products")
    op.drop_table("off_products")
    op.drop_table("products")
