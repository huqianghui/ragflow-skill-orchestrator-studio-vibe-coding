"""init tables

Revision ID: d750dfb7d5f0
Revises:
Create Date: 2026-03-05 11:40:56.887331

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d750dfb7d5f0"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "connections",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("connection_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("0")),
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
        sa.UniqueConstraint("name"),
    )
    with op.batch_alter_table("connections", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_connections_name"), ["name"], unique=True)

    op.create_table(
        "pipelines",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("graph_data", sa.JSON(), nullable=False),
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
    with op.batch_alter_table("pipelines", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_pipelines_name"), ["name"], unique=False)

    op.create_table(
        "skills",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("skill_type", sa.String(length=50), nullable=False),
        sa.Column("config_schema", sa.JSON(), nullable=False),
        sa.Column("is_builtin", sa.Boolean(), nullable=False),
        sa.Column("source_code", sa.Text(), nullable=True),
        sa.Column("additional_requirements", sa.Text(), nullable=True),
        sa.Column("test_input", sa.JSON(), nullable=True),
        sa.Column("connection_mappings", sa.JSON(), nullable=True),
        sa.Column("required_resource_types", sa.JSON(), nullable=True),
        sa.Column("bound_connection_id", sa.String(), nullable=True),
        sa.Column("config_values", sa.JSON(), nullable=True),
        sa.Column("pipeline_io", sa.JSON(), nullable=True),
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
        sa.UniqueConstraint("name"),
    )
    with op.batch_alter_table("skills", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_skills_name"), ["name"], unique=True)

    op.create_table(
        "workflows",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("graph_data", sa.JSON(), nullable=True),
        sa.Column("data_source_ids", sa.JSON(), nullable=False),
        sa.Column("routes", sa.JSON(), nullable=False),
        sa.Column("default_route", sa.JSON(), nullable=True),
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
    with op.batch_alter_table("workflows", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_workflows_name"), ["name"], unique=False)

    op.create_table(
        "data_sources",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("connection_config", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("file_count", sa.Integer(), nullable=False),
        sa.Column("total_size", sa.Integer(), nullable=False),
        sa.Column("pipeline_id", sa.String(), nullable=True),
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

    op.create_table(
        "targets",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("connection_config", sa.JSON(), nullable=False),
        sa.Column("field_mappings", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("pipeline_id", sa.String(), nullable=True),
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
            batch_op.f("ix_processed_files_workflow_id"), ["workflow_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_processed_files_data_source_id"),
            ["data_source_id"],
            unique=False,
        )

    op.create_table(
        "runs",
        sa.Column("pipeline_id", sa.String(), nullable=False),
        sa.Column("datasource_id", sa.String(), nullable=True),
        sa.Column("target_id", sa.String(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("mode", sa.String(length=10), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("total_documents", sa.Integer(), nullable=False),
        sa.Column("processed_documents", sa.Integer(), nullable=False),
        sa.Column("failed_documents", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=True),
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
        sa.ForeignKeyConstraint(["datasource_id"], ["data_sources.id"]),
        sa.ForeignKeyConstraint(["pipeline_id"], ["pipelines.id"]),
        sa.ForeignKeyConstraint(["target_id"], ["targets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_runs_pipeline_id"), ["pipeline_id"], unique=False)

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
            batch_op.f("ix_workflow_runs_workflow_id"), ["workflow_id"], unique=False
        )

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

    op.create_table(
        "agent_sessions",
        sa.Column("agent_name", sa.String(length=50), nullable=False),
        sa.Column("native_session_id", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False, server_default="New Session"),
        sa.Column("mode", sa.String(length=20), nullable=False, server_default="code"),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="playground"),
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

    op.create_table(
        "agent_configs",
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("modes", sa.JSON(), nullable=False),
        sa.Column(
            "available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("version", sa.String(length=100), nullable=True),
        sa.Column("provider", sa.String(length=100), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("install_hint", sa.String(length=255), nullable=True),
        sa.Column("tools", sa.JSON(), nullable=False),
        sa.Column("mcp_servers", sa.JSON(), nullable=False),
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
        sa.UniqueConstraint("name"),
    )
    with op.batch_alter_table("agent_configs", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_agent_configs_name"), ["name"], unique=True
        )

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
    """Downgrade schema."""
    with op.batch_alter_table("agent_messages", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_agent_messages_session_id"))
    op.drop_table("agent_messages")
    with op.batch_alter_table("agent_configs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_agent_configs_name"))
    op.drop_table("agent_configs")
    op.drop_table("agent_sessions")
    with op.batch_alter_table("runs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_runs_pipeline_id"))
    op.drop_table("runs")
    op.drop_table("targets")
    op.drop_table("data_sources")
    with op.batch_alter_table("processed_files", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_processed_files_data_source_id"))
        batch_op.drop_index(batch_op.f("ix_processed_files_workflow_id"))
    op.drop_table("processed_files")
    with op.batch_alter_table("pipeline_runs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_pipeline_runs_workflow_run_id"))
    op.drop_table("pipeline_runs")
    with op.batch_alter_table("workflow_runs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_workflow_runs_workflow_id"))
    op.drop_table("workflow_runs")
    with op.batch_alter_table("workflows", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_workflows_name"))
    op.drop_table("workflows")
    with op.batch_alter_table("skills", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_skills_name"))
    op.drop_table("skills")
    with op.batch_alter_table("pipelines", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_pipelines_name"))
    op.drop_table("pipelines")
    with op.batch_alter_table("connections", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_connections_name"))
    op.drop_table("connections")
