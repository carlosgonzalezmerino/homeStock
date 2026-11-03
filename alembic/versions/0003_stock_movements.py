"""Adds the insert-only diary of stock changes and backfills the past.

Every inventory row with stock gets one `initial` movement dated like the row itself,
so the history does not pretend that everything was bought on the day of the
deployment.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TEXT_LENGTH = 255
_INITIAL_REASON = "initial"
_MIGRATION_SOURCE = "migration"


def upgrade() -> None:
    """Creates `stock_movements`, its index, and one `initial` row per stocked item."""
    _create_table()
    _backfill()


def _create_table() -> None:
    """Creates the movements table and the index by EAN."""
    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ean", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("delta", sa.Float(), nullable=False),
        sa.Column("quantity_after", sa.Float(), nullable=False),
        sa.Column("reason", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("source", sa.String(_TEXT_LENGTH), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("undoes_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["ean"], ["products.ean"]),
        sa.ForeignKeyConstraint(["undoes_id"], ["stock_movements.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stock_movements_ean", "stock_movements", ["ean"], unique=False)


def _backfill() -> None:
    """Writes the `initial` movement of every item that has stock, in one statement."""
    op.execute(
        sa.text(
            "INSERT INTO stock_movements "
            "(ean, delta, quantity_after, reason, source, created_at) "
            "SELECT ean, quantity, quantity, :reason, :source, created_at "
            "FROM inventory_items WHERE quantity > 0"
        ).bindparams(reason=_INITIAL_REASON, source=_MIGRATION_SOURCE)
    )


def downgrade() -> None:
    """Drops the movements table. The whole history is lost, which is expected."""
    op.drop_index("ix_stock_movements_ean", table_name="stock_movements")
    op.drop_table("stock_movements")
