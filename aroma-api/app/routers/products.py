from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db

from app.models.user import User

from app.models.product import (
    Product,
    Category,
    UnitOfMeasure,
)

from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
)

from app.security.auth import (
    get_current_user,
)


router = APIRouter(
    prefix="/products",
    tags=["Products"]
)


# ============================================================
# AUTHORIZATION
# ============================================================

def require_coordinator(
    current_user: User
):

    if current_user.role != "Coordinator":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Coordinator permission required"
        )


# ============================================================
# GET ALL PRODUCTS
# ============================================================

@router.get(
    "",
    response_model=list[ProductResponse],
    summary="Get all products"
)
def get_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    products = db.scalars(
        select(Product).order_by(
            Product.id
        )
    ).all()

    return products


# ============================================================
# GET PRODUCT BY ID
# ============================================================

@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get product by ID"
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    product = db.get(
        Product,
        product_id
    )

    if not product:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    return product


# ============================================================
# CREATE PRODUCT
# ============================================================

@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product"
)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    require_coordinator(
        current_user
    )

    # --------------------------------------------------------
    # Check internal code
    # --------------------------------------------------------

    existing_product = db.scalar(
        select(Product).where(
            Product.internal_code
            == product_data.internal_code
        )
    )

    if existing_product:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Internal code already exists"
        )


    # --------------------------------------------------------
    # Check category
    # --------------------------------------------------------

    category = db.get(
        Category,
        product_data.category_id
    )

    if not category:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )


    # --------------------------------------------------------
    # Check unit of measure
    # --------------------------------------------------------

    unit = db.get(
        UnitOfMeasure,
        product_data.unit_of_measure_id
    )

    if not unit:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unit of measure not found"
        )


    # --------------------------------------------------------
    # Check stock values
    # --------------------------------------------------------

    if product_data.minimum_stock < 0:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum stock cannot be negative"
        )


    if (
        product_data.maximum_stock is not None
        and product_data.maximum_stock
        < product_data.minimum_stock
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Maximum stock cannot be lower "
                "than minimum stock"
            )
        )


    # --------------------------------------------------------
    # Create
    # --------------------------------------------------------

    new_product = Product(
        internal_code=product_data.internal_code,
        name=product_data.name,
        brand=product_data.brand,
        model=product_data.model,
        part_number=product_data.part_number,

        current_stock=product_data.current_stock,
        minimum_stock=product_data.minimum_stock,
        maximum_stock=product_data.maximum_stock,

        physical_location=product_data.physical_location,

        status="active",

        category_id=product_data.category_id,
        unit_of_measure_id=(
            product_data.unit_of_measure_id
        )
    )

    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    return new_product


# ============================================================
# UPDATE PRODUCT
# ============================================================

@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product"
)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    require_coordinator(
        current_user
    )

    product = db.get(
        Product,
        product_id
    )

    if not product:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )


    # --------------------------------------------------------
    # Check duplicated internal code
    # --------------------------------------------------------

    duplicate_code = db.scalar(
        select(Product).where(
            Product.internal_code
            == product_data.internal_code,
            Product.id != product_id
        )
    )

    if duplicate_code:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Internal code already exists"
        )


    # --------------------------------------------------------
    # Check category
    # --------------------------------------------------------

    category = db.get(
        Category,
        product_data.category_id
    )

    if not category:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )


    # --------------------------------------------------------
    # Check unit
    # --------------------------------------------------------

    unit = db.get(
        UnitOfMeasure,
        product_data.unit_of_measure_id
    )

    if not unit:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unit of measure not found"
        )


    # --------------------------------------------------------
    # Validate stocks
    # --------------------------------------------------------

    if product_data.minimum_stock < 0:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Minimum stock cannot be negative"
        )


    if (
        product_data.maximum_stock is not None
        and product_data.maximum_stock
        < product_data.minimum_stock
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Maximum stock cannot be lower "
                "than minimum stock"
            )
        )


    # --------------------------------------------------------
    # Update fields
    # --------------------------------------------------------

    product.internal_code = (
        product_data.internal_code
    )

    product.name = product_data.name
    product.brand = product_data.brand
    product.model = product_data.model

    product.part_number = (
        product_data.part_number
    )

    product.current_stock = (
        product_data.current_stock
    )

    product.minimum_stock = (
        product_data.minimum_stock
    )

    product.maximum_stock = (
        product_data.maximum_stock
    )

    product.physical_location = (
        product_data.physical_location
    )

    product.category_id = (
        product_data.category_id
    )

    product.unit_of_measure_id = (
        product_data.unit_of_measure_id
    )

    db.commit()
    db.refresh(product)

    return product


# ============================================================
# DELETE PRODUCT
# SOFT DELETE
# ============================================================

@router.delete(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Deactivate a product"
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    require_coordinator(
        current_user
    )

    product = db.get(
        Product,
        product_id
    )

    if not product:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    product.status = "inactive"

    db.commit()
    db.refresh(product)

    return product
