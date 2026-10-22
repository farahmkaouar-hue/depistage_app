import os

from sqlalchemy import select

from .database import SessionLocal
from .models import Role, User
from .security import hash_password


def main() -> None:
    
    
    email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "")
    first_name = os.environ.get("BOOTSTRAP_ADMIN_FIRST_NAME", "Administration")
    last_name = os.environ.get("BOOTSTRAP_ADMIN_LAST_NAME", "Programme VHC")

    if not email or len(password) < 12:
        raise SystemExit("BOOTSTRAP_ADMIN_EMAIL et un mot de passe d'au moins 12 caractères sont requis")

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            raise SystemExit("Un compte existe déjà pour cette adresse")
        db.add(User(email=email, password_hash=hash_password(password), first_name=first_name, last_name=last_name, role=Role.direction, is_active=True, email_verified=True))
        db.commit()

    print(f"Compte Laboratoire créé pour {email}")


if __name__ == "__main__":
    main()
