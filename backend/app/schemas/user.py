from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, ConfigDict, Field, StringConstraints


class UserRegister(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
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

