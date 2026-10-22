from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://depistage:depistage@localhost:5432/depistage"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5173,http://localhost:8443"
    allow_public_registration: bool = True
    analytics_min_group_size: int = 5
    analytics_pseudonym_secret: str
    frontend_url: str = "http://localhost:8443"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    invitation_expire_hours: int = 72
    allowed_email_domains: str = ""
    environment: str = "development"
    request_rate_limit_per_minute: int = 10

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def allowed_email_domain_list(self) -> list[str]:
        return [domain.strip().lower().lstrip("@") for domain in self.allowed_email_domains.split(",") if domain.strip()]

    def assert_production_ready(self) -> None:
        if self.environment.lower() != "production":
            return
        unsafe = {"change-this-with-a-long-random-secret", "replace-with-a-second-long-random-secret"}
        if (
            self.jwt_secret in unsafe
            or self.analytics_pseudonym_secret in unsafe
            or len(self.jwt_secret) < 32
            or len(self.analytics_pseudonym_secret) < 32
        ):
            raise RuntimeError("Les secrets JWT et de pseudonymisation doivent être configurés en production")
        if "depistage:depistage" in self.database_url or "change-this-postgres-password" in self.database_url:
            raise RuntimeError("DATABASE_URL doit utiliser un compte PostgreSQL et un mot de passe de production")
        if not self.cors_origin_list or "*" in self.cors_origin_list:
            raise RuntimeError("CORS_ORIGINS doit contenir uniquement les origines web autorisées")
        if not self.allowed_email_domain_list:
            raise RuntimeError("ALLOWED_EMAIL_DOMAINS doit être configuré en production")


@lru_cache
def get_settings() -> Settings:
    return Settings()
