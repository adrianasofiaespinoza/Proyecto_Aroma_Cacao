"""Código de recuperación y contraseña temporal (decisión de la usuaria, 2026-11-27).

- La persona recupera su contraseña sola, con su correo y su código de un solo uso.
- El coordinador (o soporte) resetea como respaldo: contraseña temporal de un solo
  ingreso y enlace, a la vez.
"""

import uuid

from app.models.user import User
from app.services.recovery import normalize_code
from tests.test_password_reset import as_coordinator, bearer, login, new_user_payload


def recover(client, email, code, new_password="Recuperada123"):
    return client.post("/auth/recover", json={"email": email, "recovery_code": code, "new_password": new_password})


def first_login_code(auth_client, make_user):
    """Usuario nuevo que elige su contraseña: devuelve (email, contraseña, código)."""
    _, headers = as_coordinator(auth_client, make_user)
    payload = new_user_payload()
    auth_client.post("/users", json=payload, headers=headers)
    h = bearer(login(auth_client, payload["email"], payload["password"]).json()["access_token"])
    res = auth_client.post("/users/me/password", headers=h, json={
        "current_password": payload["password"], "new_password": "MiPropiaClave99",
    })
    assert res.status_code == 200
    return payload["email"], "MiPropiaClave99", res.json()["recovery_code"]


def test_first_password_gives_recovery_code(auth_client, make_user, session):
    email, _, code = first_login_code(auth_client, make_user)
    assert code and len(code) == 14 and code.count("-") == 2
    user = session.query(User).filter_by(email=email).one()
    # Solo se guarda el hash
    assert user.recovery_code_hash and code not in user.recovery_code_hash


def test_normal_change_keeps_existing_code(auth_client, make_user):
    email, password, code = first_login_code(auth_client, make_user)
    h = bearer(login(auth_client, email, password).json()["access_token"])
    res = auth_client.post("/users/me/password", headers=h, json={"current_password": password, "new_password": "OtraClave12345"})
    assert res.json()["recovery_code"] is None
    assert recover(auth_client, email, code).status_code == 200


def test_recover_with_code_without_coordinator(auth_client, make_user):
    email, password, code = first_login_code(auth_client, make_user)
    old_refresh = login(auth_client, email, password).json()["refresh_token"]

    # Acepta minúsculas y sin guiones
    res = recover(auth_client, email, code.lower().replace("-", " "))
    assert res.status_code == 200
    new_code = res.json()["recovery_code"]
    assert new_code and new_code != code

    assert login(auth_client, email, password).status_code == 401
    assert login(auth_client, email, "Recuperada123").status_code == 200
    # Cierra las sesiones abiertas
    assert auth_client.post("/auth/refresh", json={"refresh_token": old_refresh}).status_code == 401
    # El código usado ya no sirve; el nuevo sí
    assert recover(auth_client, email, code, "OtraMas12345").status_code == 400
    assert recover(auth_client, email, new_code, "OtraMas12345").status_code == 200


def test_wrong_code_or_unknown_email_same_answer_and_counts_as_attempt(auth_client, make_user):
    email, password, code = first_login_code(auth_client, make_user)
    unknown = f"nadie_{uuid.uuid4().hex[:6]}@example.com"
    a = recover(auth_client, email, "AAAA-BBBB-CCCC")
    b = recover(auth_client, unknown, code)
    assert a.status_code == b.status_code == 400
    assert a.json() == b.json()
    # Comparte el límite del login: no se puede adivinar probando
    for _ in range(4):
        recover(auth_client, email, "AAAA-BBBB-CCCC")
    assert recover(auth_client, email, code).status_code == 429
    assert login(auth_client, email, password).status_code == 429


def test_user_without_code_cannot_recover(auth_client, make_user):
    user, _ = make_user("Operator")
    assert recover(auth_client, user.email, "AAAA-BBBB-CCCC").status_code == 400


def test_inactive_user_cannot_recover(auth_client, make_user, session):
    email, _, code = first_login_code(auth_client, make_user)
    user = session.query(User).filter_by(email=email).one()
    user.is_active = False
    session.commit()
    assert recover(auth_client, email, code).status_code == 400


def test_regenerate_code_needs_password(auth_client, make_user):
    email, password, code = first_login_code(auth_client, make_user)
    h = bearer(login(auth_client, email, password).json()["access_token"])
    assert auth_client.post("/users/me/recovery-code", headers=h, json={"current_password": "mala"}).status_code == 400
    res = auth_client.post("/users/me/recovery-code", headers=h, json={"current_password": password})
    assert res.status_code == 200
    assert recover(auth_client, email, code).status_code == 400
    assert recover(auth_client, email, res.json()["recovery_code"]).status_code == 200


def test_existing_user_gets_code_on_next_change(auth_client, make_user):
    user, password = make_user("Operator")
    h = bearer(login(auth_client, user.email, password).json()["access_token"])
    res = auth_client.post("/users/me/password", headers=h, json={"current_password": password, "new_password": "Cambio123456"})
    assert res.json()["recovery_code"]


def test_normalize_code():
    assert normalize_code(" abcd efgh-jkmn ") == "ABCD-EFGH-JKMN"


# ------------------------------------------------------------
# Reseteo por el coordinador: temporal de un solo ingreso + enlace
# ------------------------------------------------------------

def test_reset_gives_temporary_password_for_one_login(auth_client, make_user):
    _, headers = as_coordinator(auth_client, make_user)
    user, old = make_user("Operator")
    old_refresh = login(auth_client, user.email, old).json()["refresh_token"]

    res = auth_client.post(f"/users/{user.id}/password-reset", headers=headers)
    assert res.status_code == 201
    temporary = res.json()["temporary_password"]
    assert len(temporary) == 11 and res.json()["token"]

    assert login(auth_client, user.email, old).status_code == 401
    assert auth_client.post("/auth/refresh", json={"refresh_token": old_refresh}).status_code == 401

    # Entra con la temporal, pero solo puede cambiarla
    h = bearer(login(auth_client, user.email, temporary).json()["access_token"])
    assert auth_client.get("/products", headers=h).json()["detail"] == "Password change required"
    changed = auth_client.post("/users/me/password", headers=h, json={"current_password": temporary, "new_password": "Propia123456"})
    assert changed.status_code == 200
    assert changed.json()["recovery_code"]
    # La temporal ya no sirve
    assert login(auth_client, user.email, temporary).status_code == 401
    assert login(auth_client, user.email, "Propia123456").status_code == 200


def test_link_from_reset_also_works_and_gives_code(auth_client, make_user):
    _, headers = as_coordinator(auth_client, make_user)
    user, _ = make_user("Operator")
    res = auth_client.post(f"/users/{user.id}/password-reset", headers=headers).json()
    done = auth_client.post("/auth/password-reset", json={"token": res["token"], "new_password": "PorEnlace1234"})
    assert done.status_code == 200 and done.json()["recovery_code"]
    assert login(auth_client, user.email, res["temporary_password"]).status_code == 401
    me = auth_client.get("/users/me", headers=bearer(login(auth_client, user.email, "PorEnlace1234").json()["access_token"]))
    assert me.json()["must_change_password"] is False


def test_recovery_cancels_pending_links(auth_client, make_user):
    email, _, code = first_login_code(auth_client, make_user)
    _, headers = as_coordinator(auth_client, make_user)
    user_id = auth_client.get("/users", headers=headers).json()
    target = next(u for u in user_id if u["email"] == email)
    token = auth_client.post(f"/users/{target['id']}/password-reset", headers=headers).json()["token"]
    assert recover(auth_client, email, code).status_code == 200
    assert auth_client.get(f"/auth/password-reset/{token}").status_code == 404
