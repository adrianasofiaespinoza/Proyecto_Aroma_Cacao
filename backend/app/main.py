from fastapi import FastAPI

from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.products import router as products_router
from app.routers.public import router as public_router
from app.routers.movements import router as movements_router
from app.routers.alerts import router as alerts_router

app = FastAPI(
    title="Aroma Cacao Inventory API",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(products_router)
app.include_router(public_router)
app.include_router(movements_router)
app.include_router(alerts_router)


@app.get("/")
def root():
    return {
        "message": "Aroma Cacao Inventory API"
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok"
    }
