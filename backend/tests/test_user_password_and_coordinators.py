"""Sprint 2 (seguridad): cambio de contraseña propio y al menos un Coordinator activo (Emma)."""

from sqlalchemy import select, update

from app.models.refresh_token import RefreshToken
from app.models.user import User


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------
# Cambio de contraseña por el propio usuario
# ------------------------------------------------------------

def change(client, access_token, current, new, refresh_token=None):
    body = {"current_password": current, "new_password": new}
    if refresh_token:
        body["refresh_token"] = refresh_token
    return client.post("/users/me/password", json=body, headers=bearer(access_token))


def test_change_password_works_for_every_role(auth_client, make_user):
    for role in ("Coordinator", "Operator", "Read-only"):
        user, password = make_user(role=role)
        tokens = login(auth_client, user.email, password).json()

        res = change(auth_client, tokens["access_token"], password, "NuevaClave456")
        assert res.status_code == 200, role

        assert login(auth_client, user.email, password).status_code == 401
        assert login(auth_client, user.email, "NuevaClave456").status_code == 200


def test_change_password_validations(auth_client, make_user):
    user, password = make_user()
    token = login(auth_client, user.email, password).json()["access_token"]

    wrong = change(auth_client, token, "incorrecta", "NuevaClave456")
    assert wrong.status_code == 400
    assert wrong.json()["detail"] == "Current password is incorrect"

    assert change(auth_client, token, password, "corta").status_code == 422
    assert change(auth_client, token, password, password).status_code == 400
    assert auth_client.post(
        "/users/me/password",
        json={"current_password": password, "new_password": "NuevaClave456"},
    ).status_code == 401


def test_change_password_closes_other_sessions(auth_client, session, make_user):
    user, password = make_user()
    current = login(auth_client, user.email, password).json()
    other = login(auth_client, user.email, password).json()

    res = change(
        auth_client, current["access_token"], password, "NuevaClave456",
        refresh_token=current["refresh_token"],
    )
    assert res.status_code == 200

    # La otra sesión ya no puede renovar; la actual sí
    assert auth_client.post("/auth/refresh", json={"refresh_token": other["refresh_token"]}).status_code == 401
    assert auth_client.post("/auth/refresh", json={"refresh_token": current["refresh_token"]}).status_code == 200


def test_change_password_without_refresh_token_closes_all(auth_client, session, make_user):
    user, password = make_user()
    tokens = login(auth_client, user.email, password).json()

    change(auth_client, tokens["access_token"], password, "NuevaClave456")

    active = session.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
    ).all()
    assert active == []


# ------------------------------------------------------------
# Siempre al menos un Coordinator activo
# ------------------------------------------------------------

def leave_only(session, keep_ids):
    """Deja activos solo estos Coordinators (dentro de la transacción de la prueba)."""
    session.execute(
        update(User)
        .where(User.role == "Coordinator", User.id.not_in(keep_ids))
        .values(is_active=False)
    )
    session.commit()


def payload(user, **changes):
    data = {
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }
    data.update(changes)
    return data


def test_cannot_remove_the_last_active_coordinator(client, session, users, make_user):
    # El que actúa ya no es Coordinator activo (lo quitó otro al mismo tiempo):
    # sin la nueva regla, el sistema quedaría sin ninguno.
    target, _ = make_user(role="Coordinator")
    leave_only(session, [target.id])

    demote = client.put(f"/users/{target.id}", json=payload(target, role="Operator"))
    assert demote.status_code == 400
    assert demote.json()["detail"] == "At least one active Coordinator is required"

    deactivate = client.put(f"/users/{target.id}", json=payload(target, is_active=False))
    assert deactivate.status_code == 400

    session.refresh(target)
    assert target.role == "Coordinator" and target.is_active


def test_can_remove_a_coordinator_when_another_remains(client, session, users, make_user):
    target, _ = make_user(role="Coordinator")
    leave_only(session, [target.id, users["Coordinator"].id])

    res = client.put(f"/users/{target.id}", json=payload(target, role="Operator"))
    assert res.status_code == 200


def test_editing_last_coordinator_without_removing_role_is_allowed(client, session, make_user):
    target, _ = make_user(role="Coordinator")
    leave_only(session, [target.id])

    res = client.put(f"/users/{target.id}", json=payload(target, full_name="Nombre nuevo"))
    assert res.status_code == 200
