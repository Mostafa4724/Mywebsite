from dotenv import load_dotenv
from pathlib import Path
import os
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

DATABASE_PATH = os.path.join(BASE_DIR, "database", "shopping.db")


def _env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=_env_int("ACCESS_TOKEN_MINUTES", 60)
    )

    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=_env_int("REFRESH_TOKEN_DAYS", 30)
    )

    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"

    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    @classmethod
    def validate(cls):
        if not cls.SECRET_KEY or not cls.JWT_SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY and JWT_SECRET_KEY environment variables are required."
            )

        if cls.SECRET_KEY == cls.JWT_SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY and JWT_SECRET_KEY must be different."
            )

        minimum = _env_int("MIN_PASSWORD_LENGTH", 8)

        if minimum < 8:
            raise RuntimeError(
                "MIN_PASSWORD_LENGTH must be at least 8."
            )


Config.validate()