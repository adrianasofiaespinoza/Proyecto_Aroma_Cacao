from sqlalchemy import select
from app.routers.auth import router as auth_router
from app.database import engine, SessionLocal
from app.models.user import User
from app.routers.users import router as users_router
from app.routers.products import router as products_router
from app.routers.public import router as public_router
from app.routers.movements import router as movements_router
from app.routers.alerts import router as alerts_router

from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine

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


@app.get("/test-db")
def test_database():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database();")
        )

        database_name = result.scalar()

    return {
        "database": database_name,
        "connection": "successful"
    }


@app.get("/test-users")
def test_users():

    with SessionLocal() as db:

        users = db.scalars(
            select(User)
        ).all()

        return [
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
            }
            for user in users
        ]
