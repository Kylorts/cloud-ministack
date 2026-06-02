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

def upload_object(
    bucket_name: str,
    object_key: str,
    file_data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    client = get_s3_client()
    client.put_object(
        Bucket=bucket_name,
        Key=object_key,
        Body=file_data,
        ContentType=content_type,
    )
    head = client.head_object(Bucket=bucket_name, Key=object_key)
    return head.get("ETag", "").strip('"')


def download_object(bucket_name: str, object_key: str) -> Generator[bytes, None, None]:
    client = get_s3_client()
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
