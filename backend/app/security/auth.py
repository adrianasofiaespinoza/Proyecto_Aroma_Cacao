from fastapi import (
    Depends,
    HTTPException,
    Request,
    status,
)

from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from jose import JWTError

from sqlalchemy.orm import Session

from app.database import get_db
from app.models.revoked_access_token import RevokedAccessToken
from app.models.user import User
from app.security.jwt import decode_token


# Equipo de desarrollo: configura la instalación y ve el sistema en modo lectura.
# La empresa cliente no lo ve en Usuarios ni puede asignarlo; se crea por consola.
SUPPORT_ROLE = "Support"

# Con la contraseña inicial (o recién restablecida por consola) solo se permite esto
PASSWORD_CHANGE_PATHS = {"/users/me", "/users/me/password"}


bearer_scheme = HTTPBearer(
    auto_error=False
)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db)
):

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    token = credentials.credentials

    try:
        payload = decode_token(token)

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token"
        )

    # Make sure it is an ACCESS token,
    # not a refresh token
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token"
        )

    # Token invalidado al cerrar sesión (routers/auth.py: logout)
    jti = payload.get("jti")
    if jti and db.get(RevokedAccessToken, jti) is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token revoked"
        )

    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token"
        )

    user = db.get(
        User,
        user_id_int
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    # Nadie usa el sistema con una contraseña que otra persona conoce
    if user.must_change_password and request.url.path not in PASSWORD_CHANGE_PATHS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required"
        )

    return user


def require_roles(*roles: str):
    """Dependencia que exige uno de los roles indicados (403 si no)."""

    def checker(
        current_user: User = Depends(get_current_user)
    ):

        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}"
            )

        return current_user

    return checker
