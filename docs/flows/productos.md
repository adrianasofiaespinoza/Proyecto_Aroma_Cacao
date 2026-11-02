# Flujo de productos

## 1. Propósito y alcance

Crear, consultar, editar y desactivar productos del inventario. El stock actual solo cambia mediante movimientos autorizados (ver `movimientos-inventario.md`). La única excepción es el stock inicial, que se fija al crear el producto.

## 2. Permisos

| Operación | Endpoint | Roles |
|---|---|---|
| Listar / consultar | `GET /products`, `GET /products/{id}` | Cualquier usuario autenticado |
| Crear | `POST /products` | `Coordinator` (otros: `403`) |
| Editar | `PUT /products/{id}` | `Coordinator` |
| Desactivar | `DELETE /products/{id}` | `Coordinator` |
| Catálogos | `GET /categories`, `GET /units` | Cualquier usuario autenticado |

## 3. Validaciones

Pydantic (`422`), alineadas con las columnas de `app/models/product.py`:

| Campo | Regla |
|---|---|
| `internal_code` | Obligatorio, sin espacios en los extremos, 1–30 caracteres |
| `name` | Obligatorio, sin espacios en los extremos, 1–100 caracteres |
| `brand`, `model`, `part_number` | Opcionales, máximo 50 caracteres |
| `physical_location` | Opcional, máximo 100 caracteres |
| `current_stock`, `minimum_stock`, `maximum_stock` | `>= 0`, máximo 10 dígitos y 2 decimales |

Router:

- Código interno duplicado → `409`.
- Categoría o unidad inexistente → `404`.
- `maximum_stock < minimum_stock` → `400`. PostgreSQL también lo exige con `chk_maximum_stock`.
- `ProductUpdate` no contiene `current_stock`: si se envía, se ignora.

Antes de esta revisión, un texto demasiado largo o un número fuera de rango llegaba a PostgreSQL y devolvía `500`. Ahora devuelve `422` (probado en `test_schema_validation.py`).

## 4. Desactivación

`DELETE` es un borrado lógico (`status = 'inactive'`) que resuelve las alertas activas. Un producto inactivo no admite nuevas solicitudes de movimiento ni autorizaciones. No existe reactivación.

## 5. Alertas

Al crear, editar el mínimo o desactivar un producto se llama a `update_stock_alerts()` dentro de la misma transacción (ver `alertas-stock.md`).

## 6. Interfaz (`frontend/productos.html`)

Componente `frontend/src/components/ProductsPage.jsx` (con `ProductTable.jsx` y `ProductFormModal.jsx`):

- Tabla con el código, el nombre (marca, modelo y ubicación), la categoría, el stock con su unidad, el mínimo, el estado y una advertencia de stock bajo.
- Búsqueda (código, nombre, marca, modelo, n.º de parte) y filtros por categoría y estado. Por defecto muestra los activos.
- Solo `Coordinator`: botones Nuevo, Editar y Desactivar (este último con confirmación).
- Formulario con selectores de categoría y unidad cargados desde la API. Al editar, el stock actual queda deshabilitado. Valida en el cliente y muestra los errores del servidor (por ejemplo, `Internal code already exists`).

Verificado en el navegador (2026-11-01) como `Coordinator` y `Read-only`, sin escrituras: listado, filtros, visibilidad por rol, error de validación, `409` por código duplicado y stock deshabilitado al editar.

## 7. Pendiente

- La creación y la edición se verificaron en el navegador con el backend en modo sandbox (transacción revertida). Falta la desactivación desde el navegador y la prueba con credenciales reales.
- Reactivación de productos: no está definida.
- Paginación: el listado devuelve todos los productos, lo que es suficiente para el volumen actual.
- La BD local contiene 6 productos `LIMIT_*` que dejó `test_inventory_limits.py` (su limpieza falla). Hay que decidir si se eliminan y corregir esa prueba.
