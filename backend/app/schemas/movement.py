from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class MovementDetailCreate(BaseModel):
    product_id: int
    quantity: Decimal = Field(gt=0)
    lot_id: int | None = None
    machine_id: int | None = None


class MovementCreate(BaseModel):
    type: Literal["ENTRY", "EXIT", "ADJUSTMENT"]

    reason: str | None = None
    work_order_number: str | None = None

    details: list[MovementDetailCreate] = Field(min_length=1)

class MovementAuthorize(BaseModel):
    pass
