from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    StringConstraints,
)


LotNumber = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=30)
]


class LotCreate(BaseModel):
    lot_number: LotNumber
    expiration_date: date | None = None


class LotResponse(BaseModel):
    id: int
    product_id: int
    lot_number: str
    expiration_date: date | None
    remaining_quantity: Decimal

    model_config = ConfigDict(
        from_attributes=True
    )
