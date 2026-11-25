from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, ConfigDict, Field, StringConstraints


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    must_change_password: bool = False
    auth_provider: str
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int

class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ============================================================
# USER MANAGEMENT (Coordinator)
# ============================================================

Role = Literal["Coordinator", "Operator", "Read-only"]

FullName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class UserCreate(BaseModel):
    username: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
    ]
    full_name: FullName
    email: EmailStr = Field(max_length=100)
    # Contraseña inicial; se guarda solo como hash Argon2id
    password: str = Field(min_length=8, max_length=128)
    role: Role = "Operator"
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: FullName
    email: EmailStr = Field(max_length=100)
    role: Role
    is_active: bool



class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    # Refresh token de la sesión actual: se conserva y se cierran las demás.
    # Si no se envía, se cierran todas las sesiones persistentes del usuario.
    refresh_token: str | None = None


class PasswordResetLink(BaseModel):
    """Respuesta al Coordinator: el token se muestra una sola vez."""
    token: str
    expires_at: datetime


class PasswordResetInfo(BaseModel):
    """Lo que ve la persona al abrir el enlace, antes de elegir su contraseña."""
    full_name: str
    email: EmailStr


class PasswordResetComplete(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)
