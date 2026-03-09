"""add processed_files table and deprecate old FK

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-09 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: str | Sequence[str] | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create processed_files table if not already present."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT name FROM sqlite_master"
            " WHERE type='table' AND name='processed_files'"
        )
    )
    if result.fetchone() is not None:
        return

    op.create_table(
        "processed_files",
        sa.Column("workflow_id", sa.String(), nullable=False),
        sa.Column("data_source_id", sa.String(), nullable=False),
        sa.Column("file_path", sa.String(), nullable=False),
        sa.Column("file_etag", sa.String(), nullable=True),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
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
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workflow_id", "data_source_id", "file_path", name="uq_processed_file"
        ),
    )
    with op.batch_alter_table("processed_files", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_processed_files_workflow_id"),
            ["workflow_id"],
            unique=False,
        )
        batch_op.create_index(
            batch_op.f("ix_processed_files_data_source_id"),
            ["data_source_id"],
            unique=False,
        )


def downgrade() -> None:
    """Drop processed_files table."""
    with op.batch_alter_table("processed_files", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_processed_files_data_source_id"))
        batch_op.drop_index(batch_op.f("ix_processed_files_workflow_id"))
    op.drop_table("processed_files")
