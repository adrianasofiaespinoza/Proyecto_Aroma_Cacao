from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
)


def optional_text(max_length: int):
    return Annotated[
        str | None,
        StringConstraints(strip_whitespace=True, max_length=max_length)
    ]


ReferencePrice = Annotated[
    Decimal | None,
    Field(default=None, ge=0, max_digits=10, decimal_places=2)
]


class SupplierCreate(BaseModel):
    company_name: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    # RUC: solo dígitos (Ecuador usa 13); se deja flexible hasta 20
    ruc: Annotated[
        str | None,
        StringConstraints(strip_whitespace=True, pattern=r"^\d{1,20}$")
    ] = None
    contact_person: optional_text(100) = None
    phone: optional_text(20) = None
    address: optional_text(150) = None
    email: EmailStr | None = Field(default=None, max_length=100)


class SupplierProductResponse(BaseModel):
    product_id: int
    reference_price: Decimal | None

    model_config = ConfigDict(
        from_attributes=True
    )


class SupplierResponse(BaseModel):
    id: int
    company_name: str
    ruc: str | None
    contact_person: str | None
    phone: str | None
    address: str | None
    email: str | None
    product_links: list[SupplierProductResponse] = []

    model_config = ConfigDict(
        from_attributes=True
    )


class SupplierProductLink(BaseModel):
    product_id: int
    reference_price: ReferencePrice = None


class SupplierProductPrice(BaseModel):
    reference_price: ReferencePrice = None
