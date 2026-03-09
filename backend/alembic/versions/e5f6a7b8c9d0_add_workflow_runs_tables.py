"""add workflow_runs and pipeline_runs tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-09 14:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: str | Sequence[str] | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create workflow_runs and pipeline_runs tables if not already present."""
    conn = op.get_bind()

    # workflow_runs
    result = conn.execute(
        sa.text(
            "SELECT name FROM sqlite_master"
            " WHERE type='table' AND name='workflow_runs'"
        )
    )
    if result.fetchone() is None:
        op.create_table(
            "workflow_runs",
            sa.Column("workflow_id", sa.String(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("total_files", sa.Integer(), nullable=False),
            sa.Column("processed_files", sa.Integer(), nullable=False),
            sa.Column("failed_files", sa.Integer(), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
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
        )
        with op.batch_alter_table("workflow_runs", schema=None) as batch_op:
            batch_op.create_index(
                batch_op.f("ix_workflow_runs_workflow_id"),
                ["workflow_id"],
                unique=False,
            )

    # pipeline_runs
    result = conn.execute(
        sa.text(
            "SELECT name FROM sqlite_master"
            " WHERE type='table' AND name='pipeline_runs'"
        )
    )
    if result.fetchone() is None:
        op.create_table(
            "pipeline_runs",
            sa.Column("workflow_run_id", sa.String(), nullable=False),
            sa.Column("pipeline_id", sa.String(), nullable=False),
            sa.Column("route_name", sa.String(length=255), nullable=False),
            sa.Column("target_ids", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("total_files", sa.Integer(), nullable=False),
            sa.Column("processed_files", sa.Integer(), nullable=False),
            sa.Column("failed_files", sa.Integer(), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
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
            sa.ForeignKeyConstraint(["workflow_run_id"], ["workflow_runs.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        with op.batch_alter_table("pipeline_runs", schema=None) as batch_op:
            batch_op.create_index(
                batch_op.f("ix_pipeline_runs_workflow_run_id"),
                ["workflow_run_id"],
                unique=False,
            )


def downgrade() -> None:
    """Drop pipeline_runs and workflow_runs tables."""
    with op.batch_alter_table("pipeline_runs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_pipeline_runs_workflow_run_id"))
    op.drop_table("pipeline_runs")
    with op.batch_alter_table("workflow_runs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_workflow_runs_workflow_id"))
    op.drop_table("workflow_runs")
