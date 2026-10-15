from fastapi import (
    Depends,
    HTTPException,
    status,
)

from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from jose import JWTError

from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.jwt import decode_token


bearer_scheme = HTTPBearer(
    auto_error=False
)


def get_current_user(
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

    return user
