from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.security.auth import get_current_user, require_roles
from app.security.password import hash_password


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user"
)
def get_me(
    current_user: User = Depends(
        get_current_user
    )
):

    return current_user


# ============================================================
# LIST USERS (Coordinator)
# ============================================================

@router.get(
    "",
    response_model=list[UserResponse],
    summary="List users"
)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("Coordinator")
    )
):

    return db.scalars(
        select(User).order_by(
            User.full_name
        )
    ).all()


# ============================================================
# CREATE USER (Coordinator)
# ============================================================

@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user with role and initial password"
)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("Coordinator")
    )
):

    ensure_unique(db, username=user_data.username, email=user_data.email)

    new_user = User(
        username=user_data.username,
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        is_active=user_data.is_active,
        auth_provider="local",
        provider_user_id=None
    )

    db.add(new_user)
    commit_or_conflict(db)
    db.refresh(new_user)

    return new_user


# ============================================================
# UPDATE USER (Coordinator)
# ============================================================

@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user's data, role or status"
)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("Coordinator")
    )
):

    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Evita que el sistema se quede sin un Coordinator que lo administre
    if user.id == current_user.id and (
        not user_data.is_active
        or user_data.role != "Coordinator"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate yourself or remove your own Coordinator role"
        )

    ensure_unique(db, email=user_data.email, exclude_id=user.id)

    was_active = user.is_active

    user.full_name = user_data.full_name
    user.email = user_data.email
    user.role = user_data.role
    user.is_active = user_data.is_active

    # Al desactivar, se revocan sus sesiones persistentes
    if was_active and not user.is_active:
        db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user.id,
                RefreshToken.revoked_at.is_(None)
            )
            .values(
                revoked_at=datetime.now(timezone.utc).replace(tzinfo=None)
            )
        )

    commit_or_conflict(db)
    db.refresh(user)

    return user


# ============================================================
# HELPERS
# ============================================================

def ensure_unique(
    db: Session,
    username: str | None = None,
    email: str | None = None,
    exclude_id: int | None = None
):

    checks = []
    if username is not None:
        checks.append((User.username == username, "Username already registered"))
    if email is not None:
        checks.append((User.email == email, "Email already registered"))

    for condition, message in checks:
        stmt = select(User.id).where(condition)
        if exclude_id is not None:
            stmt = stmt.where(User.id != exclude_id)

        if db.scalar(stmt):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message
            )


def commit_or_conflict(db: Session):

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered"
        )
