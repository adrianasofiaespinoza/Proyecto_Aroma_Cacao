import os
import uuid

from datetime import (
    datetime,
    timedelta,
    timezone,
)

from dotenv import load_dotenv
from jose import JWTError, jwt


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))
    )
)
ENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(ENV_PATH)


SECRET_KEY = os.getenv("JWT_SECRET")

if not SECRET_KEY:
    raise RuntimeError(
        f"JWT_SECRET no está configurada. Revisa el archivo: {ENV_PATH}"
    )

if len(SECRET_KEY) < 32:
    raise RuntimeError(
        "JWT_SECRET es demasiado corta. Debe tener al menos 32 caracteres para HS256."
    )

ALGORITHM = "HS256"

ACCESS_TOKEN_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_MINUTES",
        15
    )
)

REFRESH_TOKEN_DAYS = int(
    os.getenv(
        "REFRESH_TOKEN_DAYS",
        7
    )
)

REMEMBER_REFRESH_TOKEN_DAYS = int(
    os.getenv(
        "REMEMBER_REFRESH_TOKEN_DAYS",
        30
    )
)


def get_access_token_expires_in() -> int:
    return ACCESS_TOKEN_MINUTES * 60


def create_access_token(
    user_id: int
) -> str:

    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_MINUTES
        )
    )

    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def create_refresh_token(
    user_id: int,
    remember_me: bool
) -> tuple[str, datetime]:

    days = (
        REMEMBER_REFRESH_TOKEN_DAYS
        if remember_me
        else REFRESH_TOKEN_DAYS
    )

    expire = (
        datetime.now(timezone.utc)
        + timedelta(days=days)
    )

    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    # PostgreSQL column is TIMESTAMP without timezone
    expires_at = expire.replace(
        tzinfo=None
    )

    return token, expires_at


def decode_token(
    token: str
) -> dict:

    return jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM]
    )