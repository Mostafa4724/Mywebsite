import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

DATABASE_PATH = os.path.join(
    BASE_DIR,
    "..",
    "database",
    "shopping.db"
)

class Config:

    SECRET_KEY = "YOUR_SECRET"

    JWT_SECRET_KEY = "SUPER_SECRET_KEY"

    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False