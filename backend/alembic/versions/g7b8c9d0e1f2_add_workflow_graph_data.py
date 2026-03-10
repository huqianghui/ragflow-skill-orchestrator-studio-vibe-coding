"""add workflow graph_data column

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-10 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g7b8c9d0e1f2"
down_revision: str | Sequence[str] | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add graph_data column to workflows table if it doesn't exist."""
    conn = op.get_bind()
    result = conn.execute(sa.text("PRAGMA table_info(workflows)"))
    columns = [row[1] for row in result.fetchall()]
    if "graph_data" not in columns:
        with op.batch_alter_table("workflows", schema=None) as batch_op:
            batch_op.add_column(sa.Column("graph_data", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove graph_data column from workflows table."""
    with op.batch_alter_table("workflows", schema=None) as batch_op:
        batch_op.drop_column("graph_data")
