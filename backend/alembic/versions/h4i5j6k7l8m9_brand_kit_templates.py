"""Brand kit templates table with 4 default templates

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-04-16
"""

import json
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "h4i5j6k7l8m9"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None

DEFAULT_TEMPLATES = [
    {
        "name": "Hero — Subject left",
        "layout_key": "hero_subject_left",
        "zones": [
            {"name": "creative", "x": 0, "y": 0, "width": 594, "height": 1080},
            {"name": "logo", "x": 650, "y": 54, "width": 380, "height": 120},
            {"name": "headline", "x": 620, "y": 240, "width": 420, "height": 320},
            {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
        ],
    },
    {
        "name": "Full bleed top",
        "layout_key": "full_bleed_top",
        "zones": [
            {"name": "creative", "x": 0, "y": 0, "width": 1080, "height": 594},
            {"name": "logo", "x": 40, "y": 640, "width": 200, "height": 80},
            {"name": "headline", "x": 40, "y": 740, "width": 1000, "height": 160},
            {"name": "body", "x": 40, "y": 900, "width": 800, "height": 80},
            {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
        ],
    },
    {
        "name": "Hero — Subject right",
        "layout_key": "hero_subject_right",
        "zones": [
            {"name": "creative", "x": 648, "y": 0, "width": 432, "height": 1080},
            {"name": "logo", "x": 40, "y": 54, "width": 200, "height": 80},
            {"name": "headline", "x": 40, "y": 240, "width": 560, "height": 320},
            {"name": "body", "x": 40, "y": 580, "width": 560, "height": 160},
            {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
        ],
    },
    {
        "name": "Editorial top title",
        "layout_key": "editorial_top_title",
        "zones": [
            {"name": "headline", "x": 40, "y": 40, "width": 1000, "height": 200},
            {"name": "creative", "x": 0, "y": 260, "width": 1080, "height": 540},
            {"name": "body", "x": 40, "y": 820, "width": 760, "height": 120},
            {"name": "logo", "x": 840, "y": 840, "width": 200, "height": 80},
            {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
        ],
    },
]


def upgrade() -> None:
    op.create_table(
        "brand_kit_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "brand_kit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("brand_kit.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("layout_key", sa.String(100), unique=True, nullable=False),
        sa.Column("zones", postgresql.JSONB, nullable=False),
        sa.Column("is_default", sa.Boolean, server_default="false", nullable=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_bkt_brand_kit_id", "brand_kit_templates", ["brand_kit_id"])
    op.create_index("idx_bkt_created_by", "brand_kit_templates", ["created_by"])

    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT id FROM brand_kit WHERE is_active = true LIMIT 1"))
    row = result.fetchone()
    if row:
        bk_id = str(row[0])
        for t in DEFAULT_TEMPLATES:
            conn.execute(
                sa.text(
                    "INSERT INTO brand_kit_templates (id, brand_kit_id, name, layout_key, zones, is_default) "
                    "VALUES (:id, :brand_kit_id, :name, :layout_key, CAST(:zones AS jsonb), :is_default)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "brand_kit_id": bk_id,
                    "name": t["name"],
                    "layout_key": t["layout_key"],
                    "zones": json.dumps(t["zones"]),
                    "is_default": True,
                },
            )


def downgrade() -> None:
    op.drop_index("idx_bkt_created_by", table_name="brand_kit_templates")
    op.drop_index("idx_bkt_brand_kit_id", table_name="brand_kit_templates")
    op.drop_table("brand_kit_templates")
