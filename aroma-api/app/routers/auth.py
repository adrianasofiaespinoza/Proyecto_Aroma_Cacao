from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from jose import JWTError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db

from app.models.user import User
from app.models.refresh_token import RefreshToken

from app.schemas.user import (
    UserRegister,
    UserResponse,
    UserLogin,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
)

from app.security.password import (
    hash_password,
    verify_password,
)

from app.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)

from app.security.token_utils import (
    hash_token,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user"
)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):

    existing_username = db.scalar(
        select(User).where(
            User.username == user_data.username
        )
    )

    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered"
        )

    existing_email = db.scalar(
        select(User).where(
            User.email == user_data.email
        )
    )

    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    password_hash = hash_password(
        user_data.password
    )

    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=password_hash,
        role="Read-only",
        is_active=True,
        auth_provider="local",
        provider_user_id=None
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


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

    user = db.scalar(
        select(User).where(
            User.email == login_data.email
        )
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not user.is_active:
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
        "expires_in": 900
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
            detail="Refresh token not found"
        )


    if stored_token.revoked_at:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked"
        )


    if stored_token.expires_at < datetime.utcnow():

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )


    user = db.get(
        User,
        int(user_id)
    )


    if not user or not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User unavailable"
        )


    new_access_token = create_access_token(
        user.id
    )


    return {
        "access_token": new_access_token,

        # Keep same refresh token for now
        "refresh_token": data.refresh_token,

        "token_type": "bearer",
        "expires_in": 900
    }


# ============================================================
# LOGOUT
# ============================================================

@router.post(
    "/logout",
    summary="Logout and revoke refresh token"
)
def logout_user(
    data: LogoutRequest,
    db: Session = Depends(get_db)
):

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


    stored_token.revoked_at = datetime.utcnow()

    db.commit()


    return {
        "message": "Logout successful"
    }