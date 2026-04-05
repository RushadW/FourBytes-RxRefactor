"""File storage — local filesystem with optional GCS support."""
from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path

from app.config import settings


class LocalStorage:
    """Store raw policy documents on the local filesystem."""

    def __init__(self, base_path: str | None = None):
        self.base = Path(base_path or settings.storage_path)
        self.base.mkdir(parents=True, exist_ok=True)

    def save(self, payer_id: str, drug_id: str, filename: str, content: bytes) -> str:
        dest_dir = self.base / payer_id / drug_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / filename
        dest.write_bytes(content)
        return str(dest)

    def read(self, path: str) -> bytes:
        return Path(path).read_bytes()

    def exists(self, path: str) -> bool:
        return Path(path).exists()

    def file_hash(self, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    def get_url(self, path: str) -> str:
        return f"/api/documents/file/{path}"

    def list_files(self, payer_id: str | None = None, drug_id: str | None = None) -> list[str]:
        search_dir = self.base
        if payer_id:
            search_dir = search_dir / payer_id
        if drug_id:
            search_dir = search_dir / drug_id
        if not search_dir.exists():
            return []
        return [str(p) for p in search_dir.rglob("*") if p.is_file()]


class GCSStorage:
    """Store raw documents in Google Cloud Storage. Same interface as LocalStorage."""

    def __init__(self, bucket_name: str | None = None, project: str | None = None):
        try:
            from google.cloud import storage as gcs
            self.client = gcs.Client(project=project or settings.gcs_project)
            self.bucket = self.client.bucket(bucket_name or settings.gcs_bucket)
        except ImportError:
            raise RuntimeError("google-cloud-storage not installed. pip install google-cloud-storage")

    def save(self, payer_id: str, drug_id: str, filename: str, content: bytes) -> str:
        blob_path = f"{payer_id}/{drug_id}/{filename}"
        blob = self.bucket.blob(blob_path)
        blob.upload_from_string(content)
        return blob_path

    def read(self, path: str) -> bytes:
        return self.bucket.blob(path).download_as_bytes()

    def exists(self, path: str) -> bool:
        return self.bucket.blob(path).exists()

    def file_hash(self, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    def get_url(self, path: str, expiration: int = 3600) -> str:
        import datetime
        blob = self.bucket.blob(path)
        return blob.generate_signed_url(expiration=datetime.timedelta(seconds=expiration))

    def list_files(self, payer_id: str | None = None, drug_id: str | None = None) -> list[str]:
        prefix = ""
        if payer_id:
            prefix = f"{payer_id}/"
        if drug_id:
            prefix += f"{drug_id}/"
        return [blob.name for blob in self.bucket.list_blobs(prefix=prefix)]


def get_storage() -> LocalStorage | GCSStorage:
    if settings.storage_backend == "gcs" and settings.gcs_bucket:
        return GCSStorage()
    return LocalStorage()
