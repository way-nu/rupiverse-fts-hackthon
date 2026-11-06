"""rv4 profile: user_profiles (Spec §7). Create table only; downgrade drops it (PM-approved, new table).

Revision ID: 0002_rv4_profile
Revises: 0001_rv1_auth
Create Date: 2026-11-06 20:51:11.161137
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_rv4_profile"
down_revision: str | None = "0001_rv1_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("full_name", sa.String(length=80), nullable=True),
        sa.Column("age", sa.SmallInteger(), nullable=True),
        sa.Column("gender", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(length=10), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_by", sa.Uuid(), nullable=True),
        sa.CheckConstraint("gender IN ('male', 'female', 'other')", name=op.f("ck_user_profiles_gender")),
        sa.CheckConstraint("phone ~ '^[0-9]{10}$'", name=op.f("ck_user_profiles_phone_digits")),
        sa.CheckConstraint("age BETWEEN 18 AND 120", name=op.f("ck_user_profiles_age_range")),
        sa.CheckConstraint("char_length(full_name) BETWEEN 3 AND 80", name=op.f("ck_user_profiles_full_name_length")),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_user_profiles_created_by_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by"], ["users.id"], name=op.f("fk_user_profiles_deleted_by_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"], ["users.id"], name=op.f("fk_user_profiles_updated_by_users"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_user_profiles_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_profiles")),
        sa.UniqueConstraint("user_id", name=op.f("uq_user_profiles_user_id")),
    )
    op.create_index(op.f("ix_user_profiles_user_id"), "user_profiles", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_profiles_user_id"), table_name="user_profiles")
    op.drop_table("user_profiles")
