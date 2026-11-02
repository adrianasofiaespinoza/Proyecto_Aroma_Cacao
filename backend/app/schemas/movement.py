from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MovementDetailCreate(BaseModel):
    product_id: int
    # Numeric(10, 2) en movement_detail.quantity
    quantity: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
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
    reason: str | None = Field(default=None, max_length=150)
    work_order_number: str | None = Field(default=None, max_length=30)
    details: list[MovementDetailCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def require_reason(self):
        # Regla acordada: salidas y ajustes deben justificarse
        if self.type in ("EXIT", "ADJUSTMENT"):
            if not self.reason or not self.reason.strip():
                raise ValueError(
                    "Reason is required for EXIT and ADJUSTMENT movements"
                )
            self.reason = self.reason.strip()
        return self


class MovementResponse(BaseModel):
    id: int
    type: str
    date: datetime
    status: str
    requesting_user_id: int
    authorizing_user_id: int | None = None
    requesting_user_name: str | None = None
    authorizing_user_name: str | None = None
    reason: str | None = None
    work_order_number: str | None = None
    details: list[MovementDetailResponse] = []

    model_config = ConfigDict(from_attributes=True)
