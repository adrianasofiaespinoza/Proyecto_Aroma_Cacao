"""Dos renovaciones simultáneas con el mismo refresh token (Sprint 2, Tamya).

A diferencia del resto, esta prueba confirma datos de verdad (necesita dos conexiones
reales a la vez), así que solo corre si se activa a propósito y en una BD de pruebas:

    RUN_CONCURRENCY_TESTS=1 DATABASE_URL=.../aroma_test pytest tests/test_refresh_concurrency.py

Al terminar borra el usuario que creó (sus refresh tokens se borran en cascada).

Resultado documentado en docs/authentication.md:
- Sin bloqueo de fila, las dos renovaciones respondían 200: quedaban dos sesiones válidas
  a partir de un solo refresh token.
- Con with_for_update(), la segunda espera a la primera y recibe 401 (token revocado).
"""

import os
import threading
import time
import uuid

import pytest
from fastapi.testclient import TestClient

import app.routers.auth as auth_router
from app.database import SessionLocal
from app.main import app
from app.models.login_attempt import LoginAttempt
from app.models.user import User
from app.security.password import hash_password

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_CONCURRENCY_TESTS") != "1",
    reason="Confirma datos reales: activar con RUN_CONCURRENCY_TESTS=1 en una BD de pruebas",
)


@pytest.fixture
def real_user():
    suffix = uuid.uuid4().hex[:8]
    with SessionLocal() as db:
        user = User(
            username=f"conc_{suffix}",
            full_name="Concurrencia",
            email=f"conc_{suffix}@example.com",
            role="Operator",
            password_hash=hash_password("ClaveSegura123"),
        )
        db.add(user)
        db.commit()
        user_id, email = user.id, user.email
    yield email
    with SessionLocal() as db:
        db.query(LoginAttempt).filter(LoginAttempt.email == email).delete()
        db.query(User).filter(User.id == user_id).delete()
        db.commit()


def test_simultaneous_refresh_leaves_one_valid_session(real_user, monkeypatch):
    client = TestClient(app)
    tokens = client.post(
        "/auth/login", json={"email": real_user, "password": "ClaveSegura123"}
    ).json()

    # Ensancha la ventana de carrera: cada renovación tarda 0,5 s entre leer y guardar
    original = auth_router.create_refresh_token

    def slow_create(*args, **kwargs):
        time.sleep(0.5)
        return original(*args, **kwargs)

    monkeypatch.setattr(auth_router, "create_refresh_token", slow_create)

    results = []
    barrier = threading.Barrier(2)

    def refresh():
        barrier.wait()
        res = TestClient(app).post(
            "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
        )
        results.append(res.status_code)

    threads = [threading.Thread(target=refresh) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(results) == [200, 401]
