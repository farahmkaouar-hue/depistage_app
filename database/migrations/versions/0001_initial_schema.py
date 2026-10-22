"""Initial production schema for an empty database.

Revision ID: 0001_initial_schema
Revises:
"""
from pathlib import Path

from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema = Path(__file__).parents[2] / "sql" / "001_schema.sql"
    statements = [statement.strip() for statement in schema.read_text(encoding="utf-8").split(";") if statement.strip()]
    for statement in statements:
        op.execute(statement)


def downgrade() -> None:
    # Le retrait d'une base de données de santé doit être contrôlé hors migration automatique.
    raise RuntimeError("La suppression du schéma doit suivre la procédure de rétention approuvée.")
