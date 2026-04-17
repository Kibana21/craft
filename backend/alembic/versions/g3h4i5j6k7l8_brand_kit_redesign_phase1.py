"""Brand kit redesign phase 1 — versioning columns, color names, font key rename

Revision ID: g3h4i5j6k7l8
Revises: f2c3d4e5f6a7
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "g3h4i5j6k7l8"
down_revision = "f2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("brand_kit", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("brand_kit", sa.Column("changelog", sa.Text(), nullable=True))
    op.add_column("brand_kit", sa.Column("activated_by", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("brand_kit", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("brand_kit", sa.Column("color_names", postgresql.JSONB(), nullable=True))

    op.create_foreign_key(
        "fk_brand_kit_activated_by",
        "brand_kit",
        "users",
        ["activated_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("idx_brand_kit_activated_by", "brand_kit", ["activated_by"])
    op.create_index(
        "idx_brand_kit_active",
        "brand_kit",
        ["is_active"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )

    op.execute(sa.text("UPDATE brand_kit SET is_active = true, activated_at = now()"))

    op.execute(sa.text("""
        UPDATE brand_kit
        SET fonts = (fonts - 'accent' - 'accent_url')
                    || jsonb_build_object(
                         'disclaimer', fonts->>'accent',
                         'disclaimer_url', fonts->>'accent_url',
                         'disclaimer_inherited', 'true'
                       )
        WHERE fonts ? 'accent'
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        UPDATE brand_kit
        SET fonts = (fonts - 'disclaimer' - 'disclaimer_url' - 'disclaimer_inherited')
                    || jsonb_build_object(
                         'accent', fonts->>'disclaimer',
                         'accent_url', fonts->>'disclaimer_url'
                       )
        WHERE fonts ? 'disclaimer'
    """))

    op.drop_index("idx_brand_kit_active", table_name="brand_kit")
    op.drop_index("idx_brand_kit_activated_by", table_name="brand_kit")
    op.drop_constraint("fk_brand_kit_activated_by", "brand_kit", type_="foreignkey")
    op.drop_column("brand_kit", "color_names")
    op.drop_column("brand_kit", "activated_at")
    op.drop_column("brand_kit", "activated_by")
    op.drop_column("brand_kit", "changelog")
    op.drop_column("brand_kit", "is_active")
