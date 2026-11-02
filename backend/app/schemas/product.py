from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
)


# Límites alineados con las columnas de app/models/product.py
# (String(n) y Numeric(10, 2)) para responder 422 en lugar de 500.
RequiredText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1)
]

StockQuantity = Annotated[
    Decimal,
    Field(ge=0, max_digits=10, decimal_places=2)
]


class ProductCreate(BaseModel):
    internal_code: Annotated[RequiredText, Field(max_length=30)]
    name: Annotated[RequiredText, Field(max_length=100)]
    brand: str | None = Field(default=None, max_length=50)
    model: str | None = Field(default=None, max_length=50)
    part_number: str | None = Field(default=None, max_length=50)

    current_stock: StockQuantity = Decimal("0")
    minimum_stock: StockQuantity = Decimal("0")
    maximum_stock: StockQuantity | None = None

    physical_location: str | None = Field(default=None, max_length=100)

    category_id: int
    unit_of_measure_id: int


class ProductUpdate(BaseModel):
    internal_code: Annotated[RequiredText, Field(max_length=30)]
    name: Annotated[RequiredText, Field(max_length=100)]
    brand: str | None = Field(default=None, max_length=50)
    model: str | None = Field(default=None, max_length=50)
    part_number: str | None = Field(default=None, max_length=50)

    minimum_stock: StockQuantity
    maximum_stock: StockQuantity | None = None

    physical_location: str | None = Field(default=None, max_length=100)

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


class CategoryResponse(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(
        from_attributes=True
    )


class UnitOfMeasureResponse(BaseModel):
    id: int
    name: str
    abbreviation: str

    model_config = ConfigDict(
        from_attributes=True
    )
