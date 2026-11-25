import os
import sys

# Asegura que el directorio 'backend' esté en sys.path para resolver 'app.*'
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.logging_config import configure_logging

configure_logging()
logger = logging.getLogger("app")

from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.products import router as products_router
from app.routers.public import router as public_router
from app.routers.movements import router as movements_router
from app.routers.alerts import router as alerts_router
from app.routers.catalogs import router as catalogs_router
from app.routers.machines import router as machines_router
from app.routers.loans import router as loans_router
from app.routers.suppliers import router as suppliers_router
from app.routers.lots import router as lots_router
from app.routers.settings import favicon, router as settings_router
from app.services.company import require_module
from app.database import engine

DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"


def cors_origins() -> list[str]:
    """Orígenes permitidos desde CORS_ORIGINS, separados por comas. Nunca '*': hay credenciales."""
    raw = os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    origins = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    for origin in origins:
        if origin == "*" or not origin.startswith(("http://", "https://")):
            raise RuntimeError(
                f"CORS_ORIGINS no válido: {origin!r}. Usa orígenes completos (https://dominio), nunca '*'."
            )
    return origins

app = FastAPI(
    title="Bodega Inventory API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(products_router)
app.include_router(public_router)
app.include_router(movements_router)
app.include_router(alerts_router)
app.include_router(catalogs_router)
app.include_router(lots_router)
app.include_router(settings_router)

# Módulos activables por empresa: si están desactivados, sus endpoints responden 403.
app.include_router(machines_router, dependencies=[Depends(require_module("machines"))])
app.include_router(loans_router, dependencies=[Depends(require_module("loans"))])
app.include_router(suppliers_router, dependencies=[Depends(require_module("suppliers"))])


@app.get("/")
def root():
    return {
        "message": "Bodega Inventory API"
    }


app.add_api_route("/favicon.ico", favicon, methods=["GET"], include_in_schema=False)


@app.middleware("http")
async def log_unhandled_errors(request: Request, call_next):
    """Todo error no controlado queda registrado (sin secretos) y el cliente recibe un 500 genérico."""
    try:
        return await call_next(request)
    except Exception:
        logger.exception("Error no controlado en %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})


def database_ok() -> bool:
    """SELECT 1 con límite de 2 segundos."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SET LOCAL statement_timeout = 2000"))
            connection.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("La base de datos no responde: %s", type(exc).__name__)
        return False


@app.get("/health", tags=["Health"])
def health_check():
    """Lo vigila el monitor externo (UptimeRobot): 503 si la base de datos no responde."""
    if not database_ok():
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})
    return {
        "status": "ok",
        "database": "ok"
    }
