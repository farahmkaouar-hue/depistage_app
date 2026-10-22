"""Add referral doctors managed by the observatory.

Revision ID: 0003_referral_doctors
Revises: 0002_patient_fields
"""

from alembic import op


revision = "0003_referral_doctors"
down_revision = "0002_patient_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS referral_doctors (
            id UUID PRIMARY KEY,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            facility VARCHAR(200) NOT NULL,
            governorate VARCHAR(100),
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(30),
            specialty VARCHAR(150),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
    """)

    # Bases créées avant cette migration : ces champs sont optionnels dans l'API.
    for column in ("governorate", "phone", "specialty"):
        op.execute(f"ALTER TABLE referral_doctors ALTER COLUMN {column} DROP NOT NULL")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS referral_doctors")
