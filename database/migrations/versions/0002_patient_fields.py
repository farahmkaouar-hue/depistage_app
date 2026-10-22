"""Add new patient fields.

Revision ID: 0002_patient_fields
Revises: 0001_initial_schema
"""

from alembic import op


revision = "0002_patient_fields"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS maiden_name VARCHAR(100)
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS postal_code VARCHAR(4)
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS anonymized_code VARCHAR(19)
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS date_first_use DATE
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS date_last_use DATE
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS date_last_risk_exposure DATE
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS current_sharing VARCHAR(3)
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS previous_sharing VARCHAR(3)
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS frequency VARCHAR(100)
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS route VARCHAR(100)
    """)

    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS
        ix_patients_anonymized_code
        ON patients(anonymized_code)
        WHERE anonymized_code IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS ix_patients_anonymized_code
    """)

    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS route")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS frequency")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS previous_sharing")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS current_sharing")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS date_last_risk_exposure")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS date_last_use")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS date_first_use")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS anonymized_code")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS postal_code")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS maiden_name")