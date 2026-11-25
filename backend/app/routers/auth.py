from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

from jose import JWTError

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.database import get_db

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.revoked_access_token import RevokedAccessToken

from app.schemas.user import (
    UserLogin,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
)

from app.security.auth import bearer_scheme
from app.security.password import verify_password
from app.services.login_limit import (
    LOGIN_LOCK_MINUTES,
    clear_attempts,
    get_attempt,
    register_failure,
    seconds_locked,
)

from app.security.jwt import (
    REFRESH_TOKEN_DAYS,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_access_token_expires_in,
)

from app.security.token_utils import (
    hash_token,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password"
)
def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):

    # Contador de fallos del correo, con la fila bloqueada (services/login_limit.py)
    attempt = get_attempt(db, login_data.email)

    wait = seconds_locked(attempt)
    if wait:
        db.commit()
        raise too_many_attempts(wait)

    user = db.scalar(
        select(User).where(
            User.email == login_data.email
        )
    )

    # El mismo mensaje si el correo no existe o la contraseña no coincide
    valid = bool(
        user
        and user.password_hash
        and verify_password(login_data.password, user.password_hash)
    )

    if not valid:
        wait = register_failure(attempt)
        db.commit()
        if wait:
            raise too_many_attempts(wait)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Contraseña correcta: se reinicia el contador
    clear_attempts(db, login_data.email)

    if not user.is_active:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    access_token = create_access_token(
        user.id
    )

    refresh_token, expires_at = (
        create_refresh_token(
            user.id,
            login_data.remember_me
        )
    )

    # Store only HASH of refresh token
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(
            refresh_token
        ),
        expires_at=expires_at
    )

    db.add(refresh_record)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": get_access_token_expires_in()
    }


# ============================================================
# REFRESH
# ============================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token"
)
def refresh_access_token(
    data: RefreshRequest,
    db: Session = Depends(get_db)
):

    try:

        payload = decode_token(
            data.refresh_token
        )

    except JWTError:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


    if payload.get("type") != "refresh":

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )


    user_id = payload.get("sub")

    if not user_id:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    token_hash_value = hash_token(
        data.refresh_token
    )

    # with_for_update: si llegan dos renovaciones con el mismo token, la segunda
    # espera a que termine la primera y entonces lo ve revocado (401).
    # Así nunca quedan dos sesiones válidas a partir de un mismo refresh token.
    stored_token = db.scalar(
        select(RefreshToken)
        .where(
            RefreshToken.token_hash
            == token_hash_value
        )
        .with_for_update()
    )

    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )

    if stored_token.revoked_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked"
        )

    if stored_token.expires_at < get_utc_now():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )

    user = db.get(
        User,
        user_id_int
    )

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User unavailable"
        )

    # Revoke current token
    stored_token.revoked_at = get_utc_now()

    # Determine if original token had remember_me duration
    remember_me = False
    if stored_token.created_at and stored_token.expires_at:
        token_lifetime_days = (stored_token.expires_at - stored_token.created_at).days
        if token_lifetime_days > REFRESH_TOKEN_DAYS:
            remember_me = True

    new_refresh_token, new_expires_at = create_refresh_token(
        user.id,
        remember_me
    )

    new_refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(
            new_refresh_token
        ),
        expires_at=new_expires_at
    )

    db.add(new_refresh_record)
    db.commit()

    new_access_token = create_access_token(
        user.id
    )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": get_access_token_expires_in()
    }


# ============================================================
# LOGOUT
# ============================================================

@router.post(
    "/logout",
    summary="Logout: revoke the refresh token and the current access token"
)
def logout_user(
    data: LogoutRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db)
):

    # El token de acceso (cabecera Authorization) deja de servir de inmediato.
    # Se guarda y confirma primero, para que quede revocado aunque el refresh token falle.
    if credentials is not None:
        revoke_access_token(db, credentials.credentials)
        db.commit()

    token_hash_value = hash_token(
        data.refresh_token
    )


    stored_token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash
            == token_hash_value
        )
    )


    if not stored_token:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


    if stored_token.revoked_at:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token already revoked"
        )


    stored_token.revoked_at = get_utc_now()

    db.commit()


    return {
        "message": "Logout successful"
    }


# ============================================================
# HELPERS
# ============================================================

def too_many_attempts(wait_seconds: int) -> HTTPException:
    """429 con Retry-After. No dice si el correo existe."""
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=(
            "Too many failed login attempts. "
            f"Try again in {LOGIN_LOCK_MINUTES} minutes"
        ),
        headers={"Retry-After": str(wait_seconds)},
    )


def revoke_access_token(db: Session, token: str) -> None:
    """Guarda el jti de un token de acceso válido para rechazarlo en get_current_user.

    Un token inválido o ya vencido se ignora: no sirve de todos modos.
    Aprovecha para borrar los registros cuyo token ya venció.
    """
    try:
        payload = decode_token(token)
    except JWTError:
        return

    jti = payload.get("jti")
    sub = payload.get("sub")
    exp = payload.get("exp")
    if payload.get("type") != "access" or not jti or not sub or not exp:
        return

    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        return

    now = get_utc_now()
    db.execute(
        delete(RevokedAccessToken).where(RevokedAccessToken.expires_at < now)
    )
    db.execute(
        insert(RevokedAccessToken)
        .values(
            jti=jti,
            user_id=user_id,
            expires_at=datetime.fromtimestamp(exp, timezone.utc).replace(tzinfo=None),
            revoked_at=now,
        )
        .on_conflict_do_nothing(index_elements=[RevokedAccessToken.jti])
    )
