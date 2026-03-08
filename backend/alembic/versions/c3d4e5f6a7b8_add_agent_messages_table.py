"""add agent_messages table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-08 20:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create agent_messages table if not already present (init migration may include it)."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT name FROM sqlite_master"
            " WHERE type='table' AND name='agent_messages'"
        )
    )
    if result.fetchone() is not None:
        return
    op.create_table(
        "agent_messages",
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
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
    with op.batch_alter_table("agent_messages", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_agent_messages_session_id"), ["session_id"]
        )


def downgrade() -> None:
    """Drop agent_messages table."""
    with op.batch_alter_table("agent_messages", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_agent_messages_session_id"))
    op.drop_table("agent_messages")
