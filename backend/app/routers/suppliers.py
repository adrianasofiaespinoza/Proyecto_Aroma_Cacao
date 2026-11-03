from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import Product
from app.models.supplier import ProductSupplier, Supplier
from app.models.user import User
from app.schemas.supplier import (
    SupplierCreate,
    SupplierProductLink,
    SupplierProductPrice,
    SupplierResponse,
)
from app.security.auth import get_current_user, require_roles


router = APIRouter(
    prefix="/suppliers",
    tags=["Suppliers"]
)


def get_supplier_or_404(db: Session, supplier_id: int) -> Supplier:

    supplier = db.get(Supplier, supplier_id)

    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )

    return supplier


def get_link_or_404(supplier: Supplier, product_id: int) -> ProductSupplier:

    link = next(
        (item for item in supplier.product_links if item.product_id == product_id),
        None
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product is not associated with this supplier"
        )

    return link


def ensure_unique_ruc(
    db: Session,
    ruc: str | None,
    exclude_id: int | None = None
):

    if not ruc:
        return

    stmt = select(Supplier.id).where(Supplier.ruc == ruc)
    if exclude_id is not None:
        stmt = stmt.where(Supplier.id != exclude_id)

    if db.scalar(stmt):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="RUC already registered"
        )


def normalized(supplier_data: SupplierCreate) -> dict:
    # Los textos opcionales vacíos se guardan como NULL
    return {
        key: (value or None) if isinstance(value, str) else value
        for key, value in supplier_data.model_dump().items()
    }


# ============================================================
# LIST / GET SUPPLIERS
# ============================================================

@router.get(
    "",
    response_model=list[SupplierResponse],
    summary="List suppliers"
)
def list_suppliers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return db.scalars(
        select(Supplier).order_by(Supplier.company_name)
    ).all()


@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Get supplier by ID"
)
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return get_supplier_or_404(db, supplier_id)


# ============================================================
# CREATE / UPDATE SUPPLIER (Coordinator)
# Sin eliminación, igual que las máquinas
# ============================================================

@router.post(
    "",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier"
)
def create_supplier(
    supplier_data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    data = normalized(supplier_data)
    ensure_unique_ruc(db, data["ruc"])

    supplier = Supplier(**data)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    return supplier


@router.put(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Update a supplier"
)
def update_supplier(
    supplier_id: int,
    supplier_data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    supplier = get_supplier_or_404(db, supplier_id)
    data = normalized(supplier_data)
    ensure_unique_ruc(db, data["ruc"], exclude_id=supplier.id)

    for key, value in data.items():
        setattr(supplier, key, value)

    db.commit()
    db.refresh(supplier)

    return supplier


# ============================================================
# SUPPLIER PRODUCTS (Coordinator)
# ============================================================

@router.post(
    "/{supplier_id}/products",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Associate a product with a reference price"
)
def add_supplier_product(
    supplier_id: int,
    link: SupplierProductLink,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    supplier = get_supplier_or_404(db, supplier_id)

    if not db.get(Product, link.product_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    if any(item.product_id == link.product_id for item in supplier.product_links):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product already associated with this supplier"
        )

    supplier.product_links.append(
        ProductSupplier(
            product_id=link.product_id,
            reference_price=link.reference_price
        )
    )
    db.commit()
    db.refresh(supplier)

    return supplier


@router.patch(
    "/{supplier_id}/products/{product_id}",
    response_model=SupplierResponse,
    summary="Update the reference price of a supplier product"
)
def update_supplier_product(
    supplier_id: int,
    product_id: int,
    price: SupplierProductPrice,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    supplier = get_supplier_or_404(db, supplier_id)
    get_link_or_404(supplier, product_id).reference_price = price.reference_price

    db.commit()
    db.refresh(supplier)

    return supplier


@router.delete(
    "/{supplier_id}/products/{product_id}",
    response_model=SupplierResponse,
    summary="Remove a product from a supplier"
)
def remove_supplier_product(
    supplier_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    supplier = get_supplier_or_404(db, supplier_id)
    supplier.product_links.remove(get_link_or_404(supplier, product_id))

    db.commit()
    db.refresh(supplier)

    return supplier
