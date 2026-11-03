from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
)


class LoanCreate(BaseModel):
    product_id: int
    # Numeric(10, 2) y chk_loan_quantity (quantity > 0)
    quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    # Si no existe un trabajador con ese nombre, se registra
    worker_name: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]


class LoanResponse(BaseModel):
    id: int
    worker_id: int
    worker_name: str | None = None
    product_id: int
    quantity: Decimal
    loan_date: datetime
    return_date: datetime | None
    status: str

    model_config = ConfigDict(
        from_attributes=True
    )


class WorkerResponse(BaseModel):
    id: int
    full_name: str
    position: str | None

    model_config = ConfigDict(
        from_attributes=True
    )
