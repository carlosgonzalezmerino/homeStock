"""Adds `checked_at` to inventory items: the last time the stock was confirmed as real.

The weekly review needs it for "it is still there", which is not a stock movement
because a movement never has a delta of 0. The column is nullable and nothing is
backfilled.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Adds the nullable `checked_at` column."""
    with op.batch_alter_table("inventory_items") as batch:
        batch.add_column(sa.Column("checked_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Removes the column. Which items were confirmed is lost."""
    with op.batch_alter_table("inventory_items") as batch:
        batch.drop_column("checked_at")
