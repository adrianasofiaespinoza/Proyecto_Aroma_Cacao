from fastapi import (
    APIRouter,
    Depends,
)

from app.models.user import User
from app.schemas.user import UserResponse
from app.security.auth import get_current_user


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
