from fastapi import (
    APIRouter,
    Depends,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.schemas.product import ProductResponse


router = APIRouter(
    prefix="/public",
    tags=["Public"]
)


# ============================================================
# PUBLIC API INFORMATION
# ============================================================

@router.get(
    "/info",
    summary="Get public API information"
)
def public_info():

    return {
        "application": "Aroma Cacao Inventory API",
        "version": "1.0.0",
        "authentication_required": False
    }


# ============================================================
# PUBLIC PRODUCTS
# ============================================================

@router.get(
    "/products",
    response_model=list[ProductResponse],
    summary="Get active products without authentication"
)
def public_products(
    db: Session = Depends(get_db)
):

    products = db.scalars(
        select(Product)
        .where(
            Product.status == "active"
        )
        .order_by(
            Product.id
        )
    ).all()

    return products
