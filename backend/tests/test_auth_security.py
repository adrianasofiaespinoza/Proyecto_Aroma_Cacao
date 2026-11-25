"""Sprint 2 (seguridad): límite de intentos, logout que invalida el token de acceso,
renovación de refresh tokens, Recordarme y registro público cerrado."""

from datetime import timedelta

from sqlalchemy import select

from app.models.login_attempt import LoginAttempt
from app.models.refresh_token import RefreshToken
from app.security.jwt import REFRESH_TOKEN_DAYS, REMEMBER_REFRESH_TOKEN_DAYS
from app.security.token_utils import hash_token
from app.services.login_limit import LOGIN_MAX_ATTEMPTS


def login(client, email, password, remember_me=False):
    return client.post(
        "/auth/login",
        json={"email": email, "password": password, "remember_me": remember_me},
    )


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------
# Limitar los intentos de inicio de sesión (Adriana)
# ------------------------------------------------------------

def test_login_locks_after_max_failures(auth_client, make_user):
    user, password = make_user()

    for _ in range(LOGIN_MAX_ATTEMPTS - 1):
        assert login(auth_client, user.email, "incorrecta").status_code == 401

    blocked = login(auth_client, user.email, "incorrecta")
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0

    # Durante el bloqueo, ni la contraseña correcta entra
    assert login(auth_client, user.email, password).status_code == 429


def test_lock_does_not_reveal_if_email_exists(auth_client, make_user):
    user, _ = make_user()
    ghost = "nadie_" + user.email

    wrong = login(auth_client, user.email, "incorrecta")
    missing = login(auth_client, ghost, "incorrecta")
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json() == missing.json()

    for _ in range(LOGIN_MAX_ATTEMPTS - 1):
        last = login(auth_client, ghost, "incorrecta")
    assert last.status_code == 429


def test_successful_login_resets_counter(auth_client, session, make_user):
    user, password = make_user()

    for _ in range(LOGIN_MAX_ATTEMPTS - 1):
        login(auth_client, user.email, "incorrecta")
    assert login(auth_client, user.email, password).status_code == 200
    assert session.get(LoginAttempt, user.email.lower()) is None

    # Tras el reinicio vuelve a tener todos los intentos
    for _ in range(LOGIN_MAX_ATTEMPTS - 1):
        assert login(auth_client, user.email, "incorrecta").status_code == 401


def test_lock_expires(auth_client, session, make_user):
    user, password = make_user()
    for _ in range(LOGIN_MAX_ATTEMPTS):
        login(auth_client, user.email, "incorrecta")

    attempt = session.get(LoginAttempt, user.email.lower())
    attempt.locked_until -= timedelta(hours=1)
    attempt.first_failed_at -= timedelta(hours=1)
    session.commit()

    assert login(auth_client, user.email, password).status_code == 200


def test_attempts_never_store_password(auth_client, session, make_user):
    user, _ = make_user()
    login(auth_client, user.email, "MiClaveSecreta")
    attempt = session.get(LoginAttempt, user.email.lower())
    assert "MiClaveSecreta" not in repr(vars(attempt))


# ------------------------------------------------------------
# Invalidar el token de acceso al cerrar sesión (Tamya)
# ------------------------------------------------------------

def test_access_token_rejected_after_logout(auth_client, make_user):
    user, password = make_user()
    tokens = login(auth_client, user.email, password).json()

    assert auth_client.get("/users/me", headers=bearer(tokens["access_token"])).status_code == 200

    out = auth_client.post(
        "/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers=bearer(tokens["access_token"]),
    )
    assert out.status_code == 200

    after = auth_client.get("/users/me", headers=bearer(tokens["access_token"]))
    assert after.status_code == 401
    assert after.json()["detail"] == "Access token revoked"


def test_logout_only_revokes_its_own_session(auth_client, make_user):
    user, password = make_user()
    first = login(auth_client, user.email, password).json()
    second = login(auth_client, user.email, password).json()

    auth_client.post(
        "/auth/logout",
        json={"refresh_token": first["refresh_token"]},
        headers=bearer(first["access_token"]),
    )
    assert auth_client.get("/users/me", headers=bearer(second["access_token"])).status_code == 200


# ------------------------------------------------------------
# Renovación de refresh tokens (Tamya)
# ------------------------------------------------------------

def test_refresh_token_can_only_be_used_once(auth_client, make_user):
    user, password = make_user()
    tokens = login(auth_client, user.email, password).json()

    first = auth_client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert first.status_code == 200

    again = auth_client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert again.status_code == 401
    assert again.json()["detail"] == "Refresh token revoked"


# ------------------------------------------------------------
# Recordarme se conserva al rotar tokens (Tamya)
# ------------------------------------------------------------

def lifetime_days(session, refresh_token):
    record = session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
    )
    return (record.expires_at - record.created_at).total_seconds() / 86400


def rotate(client, refresh_token, times):
    for _ in range(times):
        res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert res.status_code == 200
        refresh_token = res.json()["refresh_token"]
    return refresh_token


def test_remember_me_survives_two_rotations(auth_client, session, make_user):
    user, password = make_user()
    token = login(auth_client, user.email, password, remember_me=True).json()["refresh_token"]
    assert round(lifetime_days(session, token)) == REMEMBER_REFRESH_TOKEN_DAYS

    token = rotate(auth_client, token, 2)
    assert round(lifetime_days(session, token)) == REMEMBER_REFRESH_TOKEN_DAYS


def test_without_remember_me_stays_short_after_two_rotations(auth_client, session, make_user):
    user, password = make_user()
    token = login(auth_client, user.email, password, remember_me=False).json()["refresh_token"]
    assert round(lifetime_days(session, token)) == REFRESH_TOKEN_DAYS

    token = rotate(auth_client, token, 2)
    assert round(lifetime_days(session, token)) == REFRESH_TOKEN_DAYS


# ------------------------------------------------------------
# Registro público cerrado (Emma)
# ------------------------------------------------------------

def test_public_register_is_closed(auth_client):
    res = auth_client.post(
        "/auth/register",
        json={
            "username": "intruso",
            "full_name": "Intruso",
            "email": "intruso@example.com",
            "password": "ClaveSegura123",
        },
    )
    assert res.status_code in (404, 405)
