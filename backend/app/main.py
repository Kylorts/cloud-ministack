from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.activity import request_ip
from app.routers import auth, admin, plans, subscriptions, storage, activity, hosting, gateway, access_keys, s3proxy, hostingproxy

app = FastAPI(
    title="INI AWAN API",
    description="Backend API untuk portal cloud INI AWAN",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _client_ip(request: Request) -> str | None:
    """IP klien: utamakan X-Forwarded-For / X-Real-IP (di belakang proxy/LB),
    fallback ke alamat koneksi langsung."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    return request.client.host if request.client else None


class CaptureIPMiddleware:
    """Pure-ASGI middleware: set request_ip pada konteks request. (BaseHTTPMiddleware
    via @app.middleware tak bisa dipakai — contextvar-nya tak sampai ke handler.)"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        token = request_ip.set(_client_ip(Request(scope)))
        try:
            await self.app(scope, receive, send)
        finally:
            request_ip.reset(token)


app.add_middleware(CaptureIPMiddleware)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(plans.router)
app.include_router(subscriptions.router)
app.include_router(storage.router)
app.include_router(activity.router)
app.include_router(hosting.router)
app.include_router(gateway.router)
app.include_router(access_keys.router)
app.include_router(s3proxy.router)
app.include_router(hostingproxy.router)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "service": "INI AWAN API"}
