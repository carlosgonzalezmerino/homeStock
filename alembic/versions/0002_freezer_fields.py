"""Adds the freezer drawer, the frozen date and the notes to inventory items.

The three columns are nullable and nothing is backfilled: existing rows keep their data
and read as "no drawer, no date, no note". A date is not invented for them.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Adds `drawer`, `frozen_at` and `notes` as nullable columns."""
    with op.batch_alter_table("inventory_items") as batch:
        batch.add_column(sa.Column("drawer", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("frozen_at", sa.Date(), nullable=True))
        batch.add_column(sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    """Removes the three columns. The data stored in them is lost."""
    with op.batch_alter_table("inventory_items") as batch:
        batch.drop_column("notes")
        batch.drop_column("frozen_at")
        batch.drop_column("drawer")
