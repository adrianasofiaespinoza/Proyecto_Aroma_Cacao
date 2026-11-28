"""Contraseña propia: cambio obligatorio al primer ingreso y enlace de un solo uso.

El Coordinator nunca conoce la contraseña final de otra persona.
Cada prueba corre dentro de una transacción que se revierte (conftest.py).
"""

import uuid
from datetime import timedelta

from sqlalchemy import select

from app.models.password_reset_token import PasswordResetToken
from app.models.user import User


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password, "remember_me": True})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def new_user_payload(**overrides):
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "username": f"nuevo_{suffix}", "full_name": "Persona Nueva", "email": f"nuevo_{suffix}@example.com",
        "password": "Inicial12345", "role": "Operator",
    }
    payload.update(overrides)
    return payload


def as_coordinator(auth_client, make_user):
    coordinator, password = make_user("Coordinator")
    token = login(auth_client, coordinator.email, password).json()["access_token"]
    return coordinator, bearer(token)


# ------------------------------------------------------------
# Cambio obligatorio con la contraseña inicial
# ------------------------------------------------------------

def test_new_user_must_change_initial_password(auth_client, make_user):
    _, headers = as_coordinator(auth_client, make_user)
    payload = new_user_payload()
    created = auth_client.post("/users", json=payload, headers=headers)
    assert created.status_code == 201
    assert created.json()["must_change_password"] is True

    tokens = login(auth_client, payload["email"], payload["password"]).json()
    h = bearer(tokens["access_token"])

    # Con la contraseña inicial solo ve sus datos y puede cambiarla
    me = auth_client.get("/users/me", headers=h)
    assert me.status_code == 200 and me.json()["must_change_password"] is True
    blocked = auth_client.get("/products", headers=h)
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "Password change required"

    changed = auth_client.post("/users/me/password", headers=h, json={
        "current_password": payload["password"], "new_password": "MiPropiaClave99",
        "refresh_token": tokens["refresh_token"],
    })
    assert changed.status_code == 200
    assert auth_client.get("/users/me", headers=h).json()["must_change_password"] is False
    assert auth_client.get("/products", headers=h).status_code == 200


def test_existing_users_are_not_forced(auth_client, make_user):
    user, password = make_user("Operator")
    h = bearer(login(auth_client, user.email, password).json()["access_token"])
    assert auth_client.get("/products", headers=h).status_code == 200


# ------------------------------------------------------------
# Enlace de un solo uso
# ------------------------------------------------------------

def test_coordinator_link_lets_user_choose_password(auth_client, make_user, session):
    coordinator, headers = as_coordinator(auth_client, make_user)
    user, old_password = make_user("Operator")
    old_refresh = login(auth_client, user.email, old_password).json()["refresh_token"]

    link = auth_client.post(f"/users/{user.id}/password-reset", headers=headers)
    assert link.status_code == 201
    token = link.json()["token"]

    # Solo se guarda el hash, con quién lo generó
    stored = session.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    assert stored.token_hash != token
    assert stored.created_by_id == coordinator.id

    info = auth_client.get(f"/auth/password-reset/{token}")
    assert info.status_code == 200
    assert info.json()["email"] == user.email

    done = auth_client.post("/auth/password-reset", json={"token": token, "new_password": "ElegidaPorMi1"})
    assert done.status_code == 200

    # La anterior ya no sirve, la nueva sí, y las sesiones abiertas se cerraron
    assert login(auth_client, user.email, old_password).status_code == 401
    assert login(auth_client, user.email, "ElegidaPorMi1").status_code == 200
    assert auth_client.post("/auth/refresh", json={"refresh_token": old_refresh}).status_code == 401


def test_link_works_only_once(auth_client, make_user):
    _, headers = as_coordinator(auth_client, make_user)
    user, _ = make_user("Operator")
    token = auth_client.post(f"/users/{user.id}/password-reset", headers=headers).json()["token"]
    assert auth_client.post("/auth/password-reset", json={"token": token, "new_password": "Primera12345"}).status_code == 200
    second = auth_client.post("/auth/password-reset", json={"token": token, "new_password": "Segunda12345"})
    assert second.status_code == 404
    assert auth_client.get(f"/auth/password-reset/{token}").status_code == 404


def test_new_link_cancels_previous(auth_client, make_user):
    _, headers = as_coordinator(auth_client, make_user)
    user, _ = make_user("Operator")
    first = auth_client.post(f"/users/{user.id}/password-reset", headers=headers).json()["token"]
    second = auth_client.post(f"/users/{user.id}/password-reset", headers=headers).json()["token"]
    assert auth_client.get(f"/auth/password-reset/{first}").status_code == 404
    assert auth_client.get(f"/auth/password-reset/{second}").status_code == 200


def test_expired_link_is_rejected(auth_client, make_user, session):
    _, headers = as_coordinator(auth_client, make_user)
    user, _ = make_user("Operator")
    token = auth_client.post(f"/users/{user.id}/password-reset", headers=headers).json()["token"]
    stored = session.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)))
    stored.expires_at = stored.created_at - timedelta(minutes=1)
    session.commit()
    assert auth_client.post("/auth/password-reset", json={"token": token, "new_password": "Tarde1234567"}).status_code == 404


def test_link_clears_login_lock(auth_client, make_user):
    _, headers = as_coordinator(auth_client, make_user)
    user, _ = make_user("Operator")
    for _ in range(5):
        login(auth_client, user.email, "incorrecta")
    assert login(auth_client, user.email, "incorrecta").status_code == 429
    token = auth_client.post(f"/users/{user.id}/password-reset", headers=headers).json()["token"]
    auth_client.post("/auth/password-reset", json={"token": token, "new_password": "Desbloqueo123"})
    assert login(auth_client, user.email, "Desbloqueo123").status_code == 200


def test_only_coordinator_and_support_reset_and_never_for_support(client, users):
    for role in ("Operator", "Read-only"):
        client.act_as(role)
        assert client.post(f"/users/{users['Operator'].id}/password-reset").status_code == 403
    for role in ("Coordinator", "Support"):
        client.act_as(role)
        assert client.post(f"/users/{users['Operator'].id}/password-reset").status_code == 201
        assert client.post(f"/users/{users['Support'].id}/password-reset").status_code == 404


def test_inactive_user_gets_no_link(client, session, users):
    target = session.get(User, users["Read-only"].id)
    target.is_active = False
    session.commit()
    assert client.post(f"/users/{target.id}/password-reset").status_code == 400


def test_short_password_is_rejected(auth_client, make_user):
    _, headers = as_coordinator(auth_client, make_user)
    user, _ = make_user("Operator")
    token = auth_client.post(f"/users/{user.id}/password-reset", headers=headers).json()["token"]
    assert auth_client.post("/auth/password-reset", json={"token": token, "new_password": "corta"}).status_code == 422
