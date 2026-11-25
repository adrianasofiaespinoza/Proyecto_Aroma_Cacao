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
    PasswordChange,
    PasswordResetLink,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.security.auth import SUPPORT_ROLE, get_current_user, require_roles
from app.security.password import hash_password, verify_password
from app.security.token_utils import hash_token
from app.services.password_reset import create_reset


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
# CHANGE OWN PASSWORD (any role)
# ============================================================

@router.post(
    "/me/password",
    summary="Change the authenticated user's own password"
)
def change_my_password(
    data: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    if not current_user.password_hash or not verify_password(
        data.current_password,
        current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    if data.new_password == data.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current one"
        )

    current_user.password_hash = hash_password(data.new_password)
    current_user.must_change_password = False

    # Se cierran las demás sesiones persistentes; la actual se conserva si envía su refresh token
    stmt = update(RefreshToken).where(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked_at.is_(None)
    )
    if data.refresh_token:
        stmt = stmt.where(
            RefreshToken.token_hash != hash_token(data.refresh_token)
        )
    db.execute(
        stmt.values(
            revoked_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
    )

    db.commit()

    return {
        "message": "Password updated"
    }


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

    # Las cuentas de soporte (equipo de desarrollo) no son de la empresa: no se listan
    return db.scalars(
        select(User)
        .where(User.role != SUPPORT_ROLE)
        .order_by(User.full_name)
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
        # El Coordinator conoce la contraseña inicial: la persona debe cambiarla al entrar
        must_change_password=True,
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

    # Una cuenta de soporte no existe para la empresa: no se puede editar ni desactivar
    if not user or user.role == SUPPORT_ROLE:
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

    # Nunca puede quedar el sistema sin un Coordinator activo. Se bloquean las filas
    # de los Coordinators activos, así dos cambios simultáneos (A quita a B y B quita a A)
    # se aplican de uno en uno y el segundo ve el resultado del primero.
    removes_coordinator = (
        user.role == "Coordinator"
        and user.is_active
        and (user_data.role != "Coordinator" or not user_data.is_active)
    )
    if removes_coordinator:
        active_coordinators = db.scalars(
            select(User.id)
            .where(
                User.role == "Coordinator",
                User.is_active.is_(True)
            )
            .order_by(User.id)
            .with_for_update()
        ).all()
        if not [uid for uid in active_coordinators if uid != user.id]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active Coordinator is required"
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
# PASSWORD RESET LINK (Coordinator)
# ============================================================

@router.post(
    "/{user_id}/password-reset",
    response_model=PasswordResetLink,
    status_code=status.HTTP_201_CREATED,
    summary="Create a one-time link for the user to choose a new password"
)
def create_password_reset(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("Coordinator")
    )
):
    user = db.get(User, user_id)

    # Las cuentas de soporte no existen para la empresa
    if not user or user.role == SUPPORT_ROLE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reset the password of an inactive user"
        )

    token, expires_at = create_reset(db, user, current_user)
    db.commit()

    return {"token": token, "expires_at": expires_at}


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
