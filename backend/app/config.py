from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "iniawan"

    JWT_SECRET_KEY: str = "changeme"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    CORS_ORIGINS: str = "http://localhost:5174"

    MINISTACK_ENDPOINT: str = "http://localhost:4566"
    MINISTACK_ACCESS_KEY: str = "test"
    MINISTACK_SECRET_KEY: str = "test"
    MINISTACK_REGION: str = "us-east-1"

    # Email (Mailpit lokal secara default; ganti ke SMTP asli via env)
    SMTP_HOST: str = "mailpit"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""          # kosong = tanpa auth (Mailpit)
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@iniawan.id"
    SMTP_FROM_NAME: str = "JadeStack"
    APP_BASE_URL: str = "http://localhost:81"
    RESET_TOKEN_TTL_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


settings = Settings()
