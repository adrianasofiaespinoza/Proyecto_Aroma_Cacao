from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
)


RequiredText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1)
]


class MachineCreate(BaseModel):
    name: Annotated[RequiredText, Field(max_length=100)]
    identification_code: Annotated[RequiredText, Field(max_length=30)]
    location: str | None = Field(default=None, max_length=100)


class MachineResponse(BaseModel):
    id: int
    name: str
    identification_code: str
    location: str | None
    product_ids: list[int] = []

    model_config = ConfigDict(
        from_attributes=True
    )


class MachineProductLink(BaseModel):
    product_id: int
