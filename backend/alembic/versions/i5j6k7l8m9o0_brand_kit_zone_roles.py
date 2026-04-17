"""Add zone_roles JSONB column to brand_kit

Revision ID: i5j6k7l8m9o0
Revises: h4i5j6k7l8m9
Create Date: 2026-04-16
"""

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "i5j6k7l8m9o0"
down_revision = "h4i5j6k7l8m9"
branch_labels = None
depends_on = None

DEFAULT_ZONE_ROLES = {
    "poster_background": "primary",
    "cta_fill": "primary",
    "disclaimer_strip": "secondary",
    "badge_callout": "accent",
    "headline_text": "white",
}


def upgrade() -> None:
    op.add_column(
        "brand_kit",
        sa.Column("zone_roles", postgresql.JSONB, nullable=True),
    )
    # Backfill defaults on all existing rows
    op.execute(
        sa.text(
            "UPDATE brand_kit SET zone_roles = CAST(:zone_roles AS jsonb)"
        ).bindparams(zone_roles=json.dumps(DEFAULT_ZONE_ROLES))
    )


def downgrade() -> None:
    op.drop_column("brand_kit", "zone_roles")
