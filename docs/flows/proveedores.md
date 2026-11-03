# Flujo de proveedores

## 1. Propósito y alcance

Registrar proveedores y su información de contacto, asociarles los productos que ofrecen con un precio de referencia opcional, y consultar esa información.

## 2. Permisos

| Operación | Endpoint | Roles |
|---|---|---|
| Listar / consultar | `GET /suppliers`, `GET /suppliers/{id}` | Cualquier usuario autenticado |
| Crear / editar | `POST /suppliers`, `PUT /suppliers/{id}` | `Coordinator` |
| Asociar producto | `POST /suppliers/{id}/products` `{product_id, reference_price?}` | `Coordinator` |
| Cambiar precio | `PATCH /suppliers/{id}/products/{product_id}` `{reference_price}` | `Coordinator` |
| Quitar producto | `DELETE /suppliers/{id}/products/{product_id}` | `Coordinator` |

El README asigna la gestión de proveedores al `Coordinator`.

## 3. Reglas y validaciones

- `company_name` es obligatorio (1–100 caracteres).
- `ruc` es opcional y solo admite dígitos (1–20). Un RUC duplicado devuelve `409`. Ecuador usa 13 dígitos, pero no se fija esa longitud, para no acoplar el sistema a un solo país.
- `contact_person` (100), `phone` (20), `address` (150) y `email` (formato válido, 100) son opcionales. Los textos vacíos se guardan como `NULL`.
- **Sin eliminación**, igual que las máquinas: los proveedores se pueden crear y editar, pero no borrar.
- `reference_price` es opcional, `>= 0` y con 2 decimales como máximo. Coincide con `chk_reference_price` de la BD.
- Asociar un producto inexistente → `404`. Una asociación duplicada → `409`. Modificar o quitar una asociación inexistente → `404`.

## 4. Interfaz (`frontend/proveedores.html`)

`frontend/src/components/SuppliersPage.jsx`: tarjetas con búsqueda (nombre, RUC, contacto, correo) y un modal "Ver productos" con el precio de referencia. Solo el `Coordinator` ve los botones de crear, editar, asociar, editar precio y quitar.

## 5. Pruebas

- `backend/tests/test_suppliers.py`: creación y edición, normalización de campos vacíos, permisos, RUC duplicado o no numérico, varios proveedores sin RUC, correo y longitudes, y asociación, precio y eliminación de productos con sus errores.
- Navegador (2026-11-01, sandbox con transacción revertida): crear, error de RUC, RUC duplicado (`409`), asociar con precio, editar el precio, quitar, editar el proveedor y vista de solo lectura para `Read-only`.

## 6. Pendiente

- Mostrar los proveedores de cada producto en la vista de productos: no se ha implementado.
- Si en el futuro se necesita retirar proveedores, habrá que agregar un estado (migración).
