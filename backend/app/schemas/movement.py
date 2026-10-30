from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MovementDetailCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(ge=0)
    lot_id: int | None = None
    machine_id: int | None = None


class MovementDetailResponse(BaseModel):
    id: int
    movement_id: int
    product_id: int
    quantity: Decimal
    lot_id: int | None = None
    machine_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class MovementCreate(BaseModel):
    type: Literal["ENTRY", "EXIT", "ADJUSTMENT"]
    reason: str | None = None
    work_order_number: str | None = None
    details: list[MovementDetailCreate] = Field(min_length=1)


class MovementResponse(BaseModel):
    id: int
    type: str
    date: datetime
    status: str
    requesting_user_id: int
    authorizing_user_id: int | None = None
    reason: str | None = None
    work_order_number: str | None = None
    details: list[MovementDetailResponse] = []

    model_config = ConfigDict(from_attributes=True)
