from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, admin, plans, subscriptions, storage, activity, hosting, gateway

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

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(plans.router)
app.include_router(subscriptions.router)
app.include_router(storage.router)
app.include_router(activity.router)
app.include_router(hosting.router)
app.include_router(gateway.router)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "service": "INI AWAN API"}
