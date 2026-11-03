"""Adds the shopping list as saved data: one row per product the user wants to buy.

Until now the list was a query over the low stock. This migration only creates the new
table; it changes and deletes nothing that already exists.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TEXT_LENGTH = 255


def upgrade() -> None:
    """Creates `shopping_list_items` and its unique index by EAN."""
    op.create_table(
        "shopping_list_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ean", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("checked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["ean"], ["products.ean"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_shopping_list_items_ean", "shopping_list_items", ["ean"], unique=True
    )


def downgrade() -> None:
    """Drops the table. The items on the list are lost, which is expected."""
    op.drop_index("ix_shopping_list_items_ean", table_name="shopping_list_items")
    op.drop_table("shopping_list_items")
