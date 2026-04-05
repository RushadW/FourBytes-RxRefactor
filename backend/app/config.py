from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./data/anton_rx.db"

    # Storage
    storage_backend: str = "local"  # "local" or "gcs"
    storage_path: str = "./data/documents"
    gcs_bucket: str = ""
    gcs_project: str = ""

    # ChromaDB
    chroma_path: str = "./data/chroma"

    # Anthropic Claude
    anthropic_api_key: str = ""

    # GCP
    google_project_id: str = ""
    google_api_key: str = ""

    # Document AI
    docai_processor_id: str = ""
    docai_location: str = "us"

    # Server
    cors_origins: str = "*"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
