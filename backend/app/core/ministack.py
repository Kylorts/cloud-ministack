import io
from typing import Generator

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import settings


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.MINISTACK_ENDPOINT,
        aws_access_key_id=settings.MINISTACK_ACCESS_KEY,
        aws_secret_access_key=settings.MINISTACK_SECRET_KEY,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
        region_name=settings.MINISTACK_REGION,
    )


# ── Bucket operations ──────────────────────────────────────────────

def create_bucket(internal_name: str) -> None:
    client = get_s3_client()
    client.create_bucket(Bucket=internal_name)


def delete_bucket(internal_name: str) -> None:
    client = get_s3_client()
    client.delete_bucket(Bucket=internal_name)


def bucket_exists(internal_name: str) -> bool:
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=internal_name)
        return True
    except ClientError:
        return False


# ── Object operations ──────────────────────────────────────────────

# Isi placeholder saat objek perlu "dipulihkan" di MiniStack (mis. setelah
# MiniStack kehilangan datanya/restart). Metadata sebenarnya tetap di DB.
OBJECT_PLACEHOLDER = b"jadestack-placeholder"


def _ensure_bucket_exists(client, bucket_name: str) -> None:
    """Pastikan bucket ada di MiniStack. Auto-recreate jika hilang (misal setelah restart)."""
    try:
        client.head_bucket(Bucket=bucket_name)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchBucket"):
            client.create_bucket(Bucket=bucket_name)
        else:
            raise


def upload_object(
    bucket_name: str,
    object_key: str,
    file_data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    client = get_s3_client()
    _ensure_bucket_exists(client, bucket_name)
    client.put_object(
        Bucket=bucket_name,
        Key=object_key,
        Body=file_data,
        ContentType=content_type,
    )
    head = client.head_object(Bucket=bucket_name, Key=object_key)
    return head.get("ETag", "").strip('"')


def ensure_object_exists(client, bucket_name: str, object_key: str, content_type: str | None = None) -> bool:
    """Pastikan objek ada di MiniStack; jika hilang, upload placeholder (self-heal).

    Dipakai agar inkonsistensi DB↔MiniStack (mis. MiniStack reset) tidak membuat
    daftar/unduh file rusak — metadata DB tetap sumber kebenaran. Return True bila
    objek tersedia (sudah ada atau berhasil dipulihkan).
    """
    _ensure_bucket_exists(client, bucket_name)
    try:
        client.head_object(Bucket=bucket_name, Key=object_key)
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        if code not in ("404", "NoSuchKey"):
            return False
        try:
            client.put_object(
                Bucket=bucket_name,
                Key=object_key,
                Body=OBJECT_PLACEHOLDER,
                ContentType=content_type or "application/octet-stream",
            )
            return True
        except ClientError:
            return False


def download_object(bucket_name: str, object_key: str) -> Generator[bytes, None, None]:
    client = get_s3_client()
    _ensure_bucket_exists(client, bucket_name)
    response = client.get_object(Bucket=bucket_name, Key=object_key)
    stream = response["Body"]
    try:
        while chunk := stream.read(8192):
            yield chunk
    finally:
        stream.close()


def delete_object(bucket_name: str, object_key: str) -> None:
    client = get_s3_client()
    client.delete_object(Bucket=bucket_name, Key=object_key)


def get_object_metadata(bucket_name: str, object_key: str) -> dict:
    client = get_s3_client()
    head = client.head_object(Bucket=bucket_name, Key=object_key)
    return {
        "size_bytes": head["ContentLength"],
        "content_type": head.get("ContentType", "application/octet-stream"),
        "checksum": head.get("ETag", "").strip('"'),
    }


# ── Static Hosting operations ──────────────────────────────────────
# Semua file hosting disimpan di 1 bucket khusus dengan prefix:
#   {slug}/{deployment_ref}/{path...}

HOSTING_BUCKET = "jadestack-hosting"


def ensure_hosting_bucket() -> None:
    client = get_s3_client()
    _ensure_bucket_exists(client, HOSTING_BUCKET)


def upload_hosting_file(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    client = get_s3_client()
    _ensure_bucket_exists(client, HOSTING_BUCKET)
    client.put_object(Bucket=HOSTING_BUCKET, Key=key, Body=data, ContentType=content_type)


def get_hosting_file(key: str) -> tuple[bytes, str]:
    """Ambil file hosting. Raise ClientError jika tidak ada."""
    client = get_s3_client()
    resp = client.get_object(Bucket=HOSTING_BUCKET, Key=key)
    body = resp["Body"].read()
    content_type = resp.get("ContentType", "application/octet-stream")
    return body, content_type


def delete_hosting_prefix(prefix: str) -> None:
    """Hapus semua object di bawah prefix tertentu."""
    client = get_s3_client()
    try:
        resp = client.list_objects_v2(Bucket=HOSTING_BUCKET, Prefix=prefix)
        keys = [{"Key": o["Key"]} for o in resp.get("Contents", [])]
        if keys:
            client.delete_objects(Bucket=HOSTING_BUCKET, Delete={"Objects": keys})
    except ClientError:
        pass
