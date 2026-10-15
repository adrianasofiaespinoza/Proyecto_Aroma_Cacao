from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

from jose import JWTError

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered"
        )
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


    stored_token.revoked_at = get_utc_now()

    db.commit()


    return {
        "message": "Logout successful"
    }