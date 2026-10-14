-- =========================================================
-- AROMA CACAO S.A.
-- Maintenance Area Inventory System
-- PostgreSQL
-- =========================================================


-- =========================================================
-- 1. USERS
-- =========================================================

CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,

    -- NULL is allowed for Google/GitHub-only accounts
    password_hash VARCHAR(255),

    role VARCHAR(20) NOT NULL DEFAULT 'Read-only',

    -- Physical implementation of active/inactive status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    auth_provider VARCHAR(30) NOT NULL DEFAULT 'local',
    provider_user_id VARCHAR(255),

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_user_role
        CHECK (
            role IN (
                'Coordinator',
                'Operator',
                'Read-only'
            )
        ),

    CONSTRAINT uq_social_account
        UNIQUE (auth_provider, provider_user_id)
);


-- =========================================================
-- 2. REFRESH TOKENS
-- For JWT refresh / logout
-- =========================================================

CREATE TABLE refresh_tokens (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id INTEGER NOT NULL,

    token_hash VARCHAR(255) NOT NULL UNIQUE,

    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 3. CATEGORY
-- =========================================================

CREATE TABLE category (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(50) NOT NULL UNIQUE
);


-- =========================================================
-- 4. UNIT OF MEASURE
-- =========================================================

CREATE TABLE unit_of_measure (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(30) NOT NULL UNIQUE,
    abbreviation VARCHAR(10) NOT NULL
);


-- =========================================================
-- 5. PRODUCT
-- =========================================================

CREATE TABLE product (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    internal_code VARCHAR(30) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    brand VARCHAR(50),
    model VARCHAR(50),
    part_number VARCHAR(50),

    current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,

    minimum_stock NUMERIC(10,2) NOT NULL DEFAULT 0,

    maximum_stock NUMERIC(10,2),

    physical_location VARCHAR(100),

    status VARCHAR(10) NOT NULL DEFAULT 'active',

    category_id INTEGER NOT NULL,

    unit_of_measure_id INTEGER NOT NULL,

    CONSTRAINT chk_product_status
        CHECK (
            status IN ('active', 'inactive')
        ),

    CONSTRAINT chk_minimum_stock
        CHECK (
            minimum_stock >= 0
        ),

    CONSTRAINT chk_maximum_stock
        CHECK (
            maximum_stock IS NULL
            OR maximum_stock >= minimum_stock
        ),

    CONSTRAINT fk_product_category
        FOREIGN KEY (category_id)
        REFERENCES category(id),

    CONSTRAINT fk_product_unit
        FOREIGN KEY (unit_of_measure_id)
        REFERENCES unit_of_measure(id)
);


-- =========================================================
-- 6. SUPPLIER
-- =========================================================

CREATE TABLE supplier (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    company_name VARCHAR(100) NOT NULL,

    ruc VARCHAR(20) UNIQUE,

    contact_person VARCHAR(100),

    phone VARCHAR(20),

    address VARCHAR(150),

    email VARCHAR(100)
);


-- =========================================================
-- 7. PRODUCT - SUPPLIER
-- Resolves N:M relationship
-- =========================================================

CREATE TABLE product_supplier (
    product_id INTEGER NOT NULL,

    supplier_id INTEGER NOT NULL,

    reference_price NUMERIC(10,2),

    PRIMARY KEY (
        product_id,
        supplier_id
    ),

    CONSTRAINT fk_product_supplier_product
        FOREIGN KEY (product_id)
        REFERENCES product(id),

    CONSTRAINT fk_product_supplier_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES supplier(id),

    CONSTRAINT chk_reference_price
        CHECK (
            reference_price IS NULL
            OR reference_price >= 0
        )
);


-- =========================================================
-- 8. MACHINE
-- =========================================================

CREATE TABLE machine (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    identification_code VARCHAR(30) NOT NULL UNIQUE,

    location VARCHAR(100)
);


-- =========================================================
-- 9. PRODUCT - MACHINE
-- Resolves N:M relationship
-- =========================================================

CREATE TABLE product_machine (
    product_id INTEGER NOT NULL,

    machine_id INTEGER NOT NULL,

    PRIMARY KEY (
        product_id,
        machine_id
    ),

    CONSTRAINT fk_product_machine_product
        FOREIGN KEY (product_id)
        REFERENCES product(id),

    CONSTRAINT fk_product_machine_machine
        FOREIGN KEY (machine_id)
        REFERENCES machine(id)
);


-- =========================================================
-- 10. LOT
-- =========================================================

CREATE TABLE lot (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id INTEGER NOT NULL,

    lot_number VARCHAR(30) NOT NULL,

    expiration_date DATE,

    remaining_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT fk_lot_product
        FOREIGN KEY (product_id)
        REFERENCES product(id),

    CONSTRAINT chk_lot_quantity
        CHECK (
            remaining_quantity >= 0
        ),

    CONSTRAINT uq_product_lot
        UNIQUE (
            product_id,
            lot_number
        )
);


-- =========================================================
-- 11. MOVEMENT
-- ENTRY / EXIT / ADJUSTMENT
-- =========================================================

CREATE TABLE movement (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    type VARCHAR(10) NOT NULL,

    date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    requesting_user_id INTEGER NOT NULL,

    authorizing_user_id INTEGER,

    status VARCHAR(15) NOT NULL DEFAULT 'pending',

    reason VARCHAR(150),

    work_order_number VARCHAR(30),

    CONSTRAINT chk_movement_type
        CHECK (
            type IN (
                'ENTRY',
                'EXIT',
                'ADJUSTMENT'
            )
        ),

    CONSTRAINT chk_movement_status
        CHECK (
            status IN (
                'pending',
                'authorized'
            )
        ),

    CONSTRAINT fk_movement_requesting_user
        FOREIGN KEY (requesting_user_id)
        REFERENCES users(id),

    CONSTRAINT fk_movement_authorizing_user
        FOREIGN KEY (authorizing_user_id)
        REFERENCES users(id)
);


-- =========================================================
-- 12. MOVEMENT DETAIL
-- =========================================================

CREATE TABLE movement_detail (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    movement_id INTEGER NOT NULL,

    product_id INTEGER NOT NULL,

    quantity NUMERIC(10,2) NOT NULL,

    lot_id INTEGER,

    machine_id INTEGER,

    CONSTRAINT chk_movement_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT fk_detail_movement
        FOREIGN KEY (movement_id)
        REFERENCES movement(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_detail_product
        FOREIGN KEY (product_id)
        REFERENCES product(id),

    CONSTRAINT fk_detail_lot
        FOREIGN KEY (lot_id)
        REFERENCES lot(id),

    CONSTRAINT fk_detail_machine
        FOREIGN KEY (machine_id)
        REFERENCES machine(id)
);


-- =========================================================
-- 13. ALERT
-- =========================================================

CREATE TABLE alert (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    product_id INTEGER NOT NULL,

    date_generated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    stock_at_alert NUMERIC(10,2) NOT NULL,

    status VARCHAR(10) NOT NULL DEFAULT 'active',

    CONSTRAINT chk_alert_status
        CHECK (
            status IN (
                'active',
                'resolved'
            )
        ),

    CONSTRAINT fk_alert_product
        FOREIGN KEY (product_id)
        REFERENCES product(id)
);


-- =========================================================
-- 14. WORKER
-- A worker does not necessarily have a system account
-- =========================================================

CREATE TABLE worker (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    full_name VARCHAR(100) NOT NULL,

    position VARCHAR(50)
);


-- =========================================================
-- 15. LOAN
-- =========================================================

CREATE TABLE loan (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    worker_id INTEGER NOT NULL,

    product_id INTEGER NOT NULL,

    quantity NUMERIC(10,2) NOT NULL,

    loan_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    return_date TIMESTAMP,

    status VARCHAR(10) NOT NULL DEFAULT 'loaned',

    CONSTRAINT chk_loan_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT chk_loan_status
        CHECK (
            status IN (
                'loaned',
                'returned'
            )
        ),

    CONSTRAINT fk_loan_worker
        FOREIGN KEY (worker_id)
        REFERENCES worker(id),

    CONSTRAINT fk_loan_product
        FOREIGN KEY (product_id)
        REFERENCES product(id)
);


-- =========================================================
-- INDEXES
-- Useful for common searches
-- =========================================================

CREATE INDEX idx_product_name
    ON product(name);

CREATE INDEX idx_product_category
    ON product(category_id);

CREATE INDEX idx_product_status
    ON product(status);

CREATE INDEX idx_movement_date
    ON movement(date);

CREATE INDEX idx_movement_requesting_user
    ON movement(requesting_user_id);

CREATE INDEX idx_movement_status
    ON movement(status);

CREATE INDEX idx_movement_detail_product
    ON movement_detail(product_id);

CREATE INDEX idx_alert_product
    ON alert(product_id);

CREATE INDEX idx_alert_status
    ON alert(status);

CREATE INDEX idx_lot_product
    ON lot(product_id);

CREATE INDEX idx_refresh_user
    ON refresh_tokens(user_id);


-- =========================================================
-- INITIAL CATALOG DATA
-- =========================================================

INSERT INTO category (name)
VALUES
    ('Tools'),
    ('Spare Parts'),
    ('Supplies'),
    ('Equipment'),
    ('Materials');


INSERT INTO unit_of_measure (
    name,
    abbreviation
)
VALUES
    ('Unit', 'u'),
    ('Kilogram', 'kg'),
    ('Liter', 'L'),
    ('Meter', 'm');


-- =========================================================
-- END
-- =========================================================