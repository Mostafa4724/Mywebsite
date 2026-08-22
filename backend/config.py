import os
from dotenv import load_dotenv
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))

DATABASE_PATH = os.path.join(
    BASE_DIR,
    "..",
    "database",
    "shopping.db"
)

class Config:

    SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET")

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "SUPER_SECRET_KEY")

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False