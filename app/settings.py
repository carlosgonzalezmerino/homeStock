import os


class Settings:
    """Configuration read from environment variables, with local defaults."""

    database_url: str = os.environ.get("DATABASE_URL", "sqlite:///homestock.db")
    mercadona_base_url: str = os.environ.get(
        "MERCADONA_BASE_URL", "https://tienda.mercadona.es/api/products/{id}"
    )
    mercadona_timeout: float = float(os.environ.get("MERCADONA_TIMEOUT", "3.0"))


settings = Settings()
