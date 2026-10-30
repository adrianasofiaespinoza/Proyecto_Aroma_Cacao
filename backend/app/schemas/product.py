from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class ProductCreate(BaseModel):
    internal_code: str
    name: str
    brand: str | None = None
    model: str | None = None
    part_number: str | None = None

    current_stock: Decimal = Field(default=Decimal("0"), ge=0)
    minimum_stock: Decimal = Field(default=Decimal("0"), ge=0)
    maximum_stock: Decimal | None = Field(default=None, ge=0)

    physical_location: str | None = None

    category_id: int
    unit_of_measure_id: int


class ProductUpdate(BaseModel):
    internal_code: str
    name: str
    brand: str | None = None
    model: str | None = None
    part_number: str | None = None

    minimum_stock: Decimal = Field(ge=0)
    maximum_stock: Decimal | None = Field(default=None, ge=0)

    physical_location: str | None = None

    category_id: int
    unit_of_measure_id: int


class ProductResponse(BaseModel):
    id: int
    internal_code: str
    name: str
    brand: str | None
    model: str | None
    part_number: str | None

    current_stock: Decimal
    minimum_stock: Decimal
    maximum_stock: Decimal | None

    physical_location: str | None

    status: str

    category_id: int
    unit_of_measure_id: int

    model_config = ConfigDict(
        from_attributes=True
    )
