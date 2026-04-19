"""Add file_url, original_filename, file_size to compliance_documents

Revision ID: j6k7l8m9n0p1
Revises: i5j6k7l8m9o0
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa

revision = "j6k7l8m9n0p1"
down_revision = "i5j6k7l8m9o0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("compliance_documents", sa.Column("file_url", sa.String(500), nullable=True))
    op.add_column("compliance_documents", sa.Column("original_filename", sa.String(500), nullable=True))
    op.add_column("compliance_documents", sa.Column("file_size", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("compliance_documents", "file_size")
    op.drop_column("compliance_documents", "original_filename")
    op.drop_column("compliance_documents", "file_url")
