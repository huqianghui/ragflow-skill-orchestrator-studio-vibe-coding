"""add agent_sessions table

Revision ID: a1b2c3d4e5f6
Revises: d750dfb7d5f0
Create Date: 2026-03-08 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "d750dfb7d5f0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create agent_sessions table if not already present (init migration may include it)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_sessions'")
    )
    if result.fetchone() is not None:
        return
    op.create_table(
        "agent_sessions",
        sa.Column("agent_name", sa.String(length=50), nullable=False),
        sa.Column("native_session_id", sa.String(length=255), nullable=True),
        sa.Column(
            "title",
            sa.String(length=255),
            nullable=False,
            server_default="New Session",
        ),
        sa.Column(
            "mode", sa.String(length=20), nullable=False, server_default="code"
        ),
        sa.Column(
            "source",
            sa.String(length=50),
            nullable=False,
            server_default="playground",
        ),
        sa.Column("id", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Drop agent_sessions table."""
    op.drop_table("agent_sessions")
