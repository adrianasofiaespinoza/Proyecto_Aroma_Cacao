"""
Fixtures compartidos para pruebas sobre PostgreSQL local.

Cada prueba se ejecuta dentro de una transacción externa que se revierte
al final, por lo que no deja datos en aroma_inventory. Solo se conectan a
la base de datos las pruebas que usan estos fixtures.
"""

import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models.product import Category, Product, UnitOfMeasure
from app.models.company_settings import CompanySettings
from app.models.user import User
from app.security.auth import get_current_user
from app.services.company import DEFAULTS


@pytest.fixture
def session():
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    # Las pruebas suponen la configuración por defecto (módulos activos, sin
    # autoaprobación), sea cual sea la de esta BD. Se revierte con la transacción.
    settings = db.get(CompanySettings, 1)
    if settings is not None:
        for key, value in DEFAULTS.items():
            setattr(settings, key, value)
        db.commit()
    try:
        yield db
    finally:
        db.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def users(session):
    created = {}
    for role in ("Coordinator", "Operator", "Read-only", "Support"):
        suffix = uuid.uuid4().hex[:8]
        user = User(
            username=f"flow_{suffix}",
            full_name=f"Test {role}",
            email=f"flow_{suffix}@example.com",
            role=role,
        )
        session.add(user)
        created[role] = user
    # commit del savepoint: sobrevive a los rollback de los endpoints,
    # pero se revierte con la transacción externa al final de la prueba
    session.commit()
    return created


@pytest.fixture
def client(session, users):
    acting = {"user": users["Coordinator"]}

    def override_db():
        # Igual que get_db: revierte ante cualquier excepción
        try:
            yield session
        except Exception:
            session.rollback()
            raise

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: acting["user"]

    test_client = TestClient(app)
    test_client.act_as = lambda role: acting.update(user=users[role])
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def product(session):
    item = Product(
        internal_code=f"FLOW-{uuid.uuid4().hex[:8]}",
        name="Producto de flujo",
        current_stock=Decimal("10"),
        minimum_stock=Decimal("3"),
        status="active",
        category_id=session.scalar(select(Category.id)),
        unit_of_measure_id=session.scalar(select(UnitOfMeasure.id)),
    )
    session.add(item)
    # commit del savepoint: sobrevive a los rollback de los endpoints,
    # pero se revierte con la transacción externa al final de la prueba
    session.commit()
    return item


@pytest.fixture
def auth_client(session):
    """Cliente que valida los tokens de verdad (sin saltarse get_current_user).

    Para probar login, refresh, logout y cambio de contraseña.
    """

    def override_db():
        try:
            yield session
        except Exception:
            session.rollback()
            raise

    app.dependency_overrides[get_db] = override_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(session):
    """Crea un usuario con contraseña real. Devuelve (usuario, contraseña)."""
    from app.security.password import hash_password

    def _make(role="Operator", password="ClaveSegura123", is_active=True):
        suffix = uuid.uuid4().hex[:8]
        user = User(
            username=f"auth_{suffix}",
            full_name=f"Auth {role}",
            email=f"auth_{suffix}@example.com",
            role=role,
            is_active=is_active,
            password_hash=hash_password(password),
        )
        session.add(user)
        session.commit()
        return user, password

    return _make
