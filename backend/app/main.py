import os
import sys

# Asegura que el directorio 'backend' esté en sys.path para resolver 'app.*'
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI(
    title="Bodega Inventory API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
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


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok"
    }
