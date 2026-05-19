from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, admin

app = FastAPI(
    title="INI AWAN API",
    description="Backend API untuk portal cloud INI AWAN",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/", tags=["health"])
def health_check():
    return {"status": "ok", "service": "INI AWAN API"}
