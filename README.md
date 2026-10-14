# Aroma Cacao S.A. — Inventory Management System

## 1. Project Context

### 1.1 Company and Problem

Aroma Cacao S.A. is an Ecuadorian cocoa export company. Its maintenance department requires a web-based inventory management system to organize and manage the tools, spare parts, supplies, equipment, and materials used in daily maintenance operations.

The proposed system aims to improve inventory organization, stock visibility, traceability, and control over inventory transactions. It should support reliable stock records, controlled access to information, authorization of inventory movements, and identification of products requiring replenishment.

The application is intended to be a responsive web application, not a native mobile application.

### 1.2 Main Functional Requirements

#### Product and Stock Management

The system is expected to support:

- Registering, editing, searching, and deactivating products while preserving historical records.
- Classifying products into tools, spare parts, supplies, equipment, and materials.
- Recording internal product codes, names, brands, models, part numbers when applicable, units of measurement, and physical workshop locations.
- Defining current, minimum, and maximum stock levels.
- Detecting products whose current stock is less than or equal to the minimum threshold.
- Displaying low-stock alerts within the application.
- Maintaining an expandable catalog of units of measurement.
- Tracking batches, expiration dates, and remaining quantities for products that require traceability.

#### Supplier Management

The system is expected to support:

- Registering suppliers and their contact information.
- Associating products with one or more suppliers.
- Recording supplier-specific prices for products.
- Querying supplier information.

#### Machine and Spare-Part Management

The system is expected to support:

- Registering machines with names, identification codes, and physical plant locations.
- Associating spare parts with one or more machines.
- Recording the destination machine for relevant outgoing inventory movements.

#### Inventory Movements and Authorization

The system is expected to support:

- Recording incoming transactions, outgoing transactions, and stock adjustments.
- Recording the product, quantity, date, requesting user, applicable batch, destination machine, reason for outgoing transactions, and work-order reference when available.
- Requiring Coordinator authorization before executing inventory movements requested by Operators.
- Updating stock only when the corresponding movement is authorized and executed.
- Allowing the Coordinator to explicitly authorize an outgoing movement exceeding available stock in exceptional circumstances, such as emergencies.
- Retaining inventory movement history for at least one year for auditing purposes.

#### Tool Loans

The system is expected to support:

- Registering tool loans to workers, including workers without system accounts.
- Tracking loan status and returns.

#### User Management and Access Control

The system defines three roles:

1. **Coordinator:** Full administrative access, including user, product, and supplier management and authorization of inventory movements.
2. **Operator:** Can request incoming and outgoing inventory transactions. These transactions require Coordinator authorization before execution.
3. **Read-only:** Can consult permitted information but cannot perform inventory operations.

The system should support user registration, login, active or inactive account status, and the creation of additional users as the maintenance team grows.

### 1.3 Out-of-Scope Functionality

The following features are outside the defined project scope:

- Email or SMS notifications; low-stock alerts are displayed within the application.
- Exporting data or reports to Excel or PDF.
- Advanced consumption analytics, usage trends, or cost analysis.
- A complete purchase-order management module.
- A complete work-order management module; only a reference number is stored when applicable.
- Integration with external ERP, accounting, procurement, or other systems.
- A native mobile application.
- A separate Administrator role; the Coordinator role provides administrative access.
- Permanent deletion of products; products are deactivated to preserve historical records.
- Social authentication through Google, GitHub, or other external identity providers.

These requirements define the intended scope of the system and do not imply that all listed features have been implemented.

---

## 2. Technology Stack

The selected technology stack is:

| Technology           | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| React                | Frontend development and interactive user interfaces |
| Tailwind CSS         | Styling and responsive interface design              |
| Python               | Backend programming language                         |
| FastAPI              | Backend development and REST API endpoints           |
| PostgreSQL           | Relational database management                       |
| SQLAlchemy           | Object-relational mapping and database interaction   |
| Pydantic             | Request validation and data schemas                  |
| JWT                  | Token-based authentication                           |
| Argon2               | Password hashing                                     |
| OpenAPI / Swagger UI | API documentation and endpoint exploration           |
| Postman              | API testing                                          |

The backend follows a client-server approach in which the frontend communicates with the FastAPI REST API through HTTP requests and JSON. SQLAlchemy provides database interaction with PostgreSQL.

The actual implementation and integration of each technology should be verified in the repository before assuming that the entire application is complete.

---

## 3. Current API Implementation

The project includes a REST API developed with Python and FastAPI. The implementation details below are based on the available project documentation and must be distinguished from the completion status of the overall inventory management system.

**Current development status:** Authentication is the main functionality reported as implemented. Other documented endpoints and business rules require verification against the source code and actual runtime behavior.

### 3.1 Authentication and User Management

The documented API includes:

| Endpoint               | Intended purpose                                        |
| ---------------------- | ------------------------------------------------------- |
| `POST /auth/register`  | Register a user                                         |
| `POST /auth/login`     | Authenticate a user                                     |
| `POST /auth/refresh`   | Obtain a new access token using a refresh token         |
| `POST /auth/logout`    | Revoke a refresh token                                  |
| `GET /users/me`        | Retrieve the currently authenticated user's information |
| `GET /public/info`     | Access public application information                   |
| `GET /public/products` | Access public product information                       |

The documented authentication implementation includes:

- Argon2 password hashing instead of plaintext password storage.
- JWT access tokens for protected API endpoints.
- Refresh tokens stored as hashes and supporting revocation.
- A Remember Me feature based on refresh tokens.
- Identification of the authenticated user through the access token.
- Three application roles: Coordinator, Operator, and Read-only.
- Protected endpoints with role-based access restrictions.

Access tokens are sent through the following HTTP header:

`Authorization: Bearer <access_token>`

The backend is expected to validate the token and use the authenticated identity when processing protected operations.

The API uses internal authentication based on application credentials and tokens. Social login is outside the project scope.

Token expiration policies, refresh-token rotation, browser storage, cookie configuration, signing algorithms, and other security details must not be assumed unless verified in the implementation.

### 3.2 API Architecture and Validation

The backend uses:

- FastAPI to define endpoints and process requests.
- Pydantic to validate request data and define schemas.
- JSON for API requests and responses.
- SQLAlchemy for database interaction.
- PostgreSQL for persistent relational storage.
- OpenAPI and Swagger UI for API documentation, with the documentation interface reported at `/docs`.
- Postman and Swagger UI for endpoint testing.

The existence of a working API does not establish that the React and Tailwind CSS frontend is complete or fully integrated.

### 3.3 Database Entities

The documented data model includes entities such as:

- `User`
- `Product`
- `Movement`
- `MovementDetail`
- `Alert`
- `Category`
- `UnitOfMeasure`
- `Supplier`
- `ProductSupplier`
- `Machine`
- `ProductMachine`
- `Lot`
- `Worker`
- `Loan`
- `RefreshToken`

These entities describe the reported or intended data model. Their presence in source code does not independently prove that all database tables, relationships, migrations, or associated workflows are operational.

PostgreSQL is the selected database, but the actual schema, connection configuration, migration status, and persistence behavior must be verified directly.

### 3.4 Product Management

The API documentation describes product operations for:

- Creating products.
- Listing products.
- Retrieving individual products.
- Updating products.
- Deactivating products through logical deletion.

Documented validations include unique internal product codes, valid category and unit references, valid minimum stock, and a maximum stock level that cannot be lower than the minimum.

These operations must be checked against the current source code before being considered fully implemented.

### 3.5 Inventory Movement Logic

The documented movement types are:

- `ENTRY`: Adds stock.
- `EXIT`: Removes stock.
- `ADJUSTMENT`: Sets the recorded stock to a specified quantity.

The documented statuses include `pending` and `authorized`.

The described behavior is:

- Operators can request movements.
- Coordinators can authorize movements.
- Requesting and authorizing user IDs are recorded.
- Incoming movements add the authorized quantity to current stock.
- Outgoing movements check stock availability before subtracting the requested quantity.
- Adjustments set stock to the specified quantity, with negative quantities rejected by validation.

Pending movements should not affect official stock before authorization and execution.

**Known requirement/API discrepancy:** The project requirements permit a Coordinator to authorize an outgoing movement that exceeds available stock in exceptional circumstances. The documented API behavior rejects outgoing movements that exceed current stock. This discrepancy remains a point requiring investigation and clarification. The exceptional authorization must not be described as implemented unless the source code and tests confirm it.

### 3.6 Low-Stock Alerts

The documented alert rule is:

`current_stock <= minimum_stock`

When the condition is met, the API is described as creating an alert. Duplicate active alerts for the same product are prevented, and alerts have active or resolved states.

The documented behavior generates alerts after movements are authorized. Whether every stock-changing operation triggers the appropriate alert must be verified.

Alerts are intended to be displayed within the application. Email and SMS notifications are out of scope.

### 3.7 Traceability

The documented movement model records:

- `requesting_user_id`: the user who requested the movement.
- `authorizing_user_id`: the user who authorized the movement.

These identities are derived from the authenticated user rather than relying solely on a freely supplied user ID from the client.

This provides a basis for identifying who requested and authorized inventory transactions.

However, this does not by itself prove that the system enforces the required one-year retention period, preserves every relevant historical change, or provides tamper-resistant audit logs. Those requirements need separate verification.

###

---

## 4. Current Development Status

Authentication is the main functionality currently reported as implemented. The status of the remaining modules must be established by inspecting the repository and testing the application.

The following areas require verification:

- PostgreSQL connection, schema, and migrations.
- User and role management.
- Product management.
- Inventory movement workflows and stock updates.
- Coordinator authorization and the exceptional-overstock rule.
- Low-stock alert behavior.
- Supplier management.
- Lot and expiration tracking.
- Machine and spare-part associations.
- Tool loans and returns.
- Movement-history retention.
- React frontend implementation and integration.
- Automated test coverage.

When evaluating any feature, distinguish between:

- **Implemented and tested:** Working behavior has been verified through relevant tests.
- **Implemented but not fully tested:** Code exists, but verification is incomplete.
- **Partially implemented:** Only some required behavior is available.
- **Defined but unverified:** Models, schemas, endpoints, or documentation exist, but operational behavior has not been established.
- **Not implemented:** The required functionality is missing.
- **Unknown:** There is insufficient evidence to determine its status.

AI assistants and developers working on this project should inspect the existing code before making changes or asserting implementation status. Requirements describe the intended system; the source code and verified test results determine what is actually implemented.
