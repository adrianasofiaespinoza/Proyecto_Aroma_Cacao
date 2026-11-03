# Flujo de máquinas y repuestos compatibles

## 1. Propósito y alcance

Registrar las máquinas de planta (nombre, código de identificación, ubicación), asociarles los repuestos compatibles (`product_machine`) y usarlas como máquina destino en las salidas de inventario.

## 2. Permisos

| Operación | Endpoint | Roles |
|---|---|---|
| Listar / consultar | `GET /machines`, `GET /machines/{id}` | Cualquier usuario autenticado |
| Crear / editar | `POST /machines`, `PUT /machines/{id}` | `Coordinator` |
| Asociar repuesto | `POST /machines/{id}/products` `{product_id}` | `Coordinator` |
| Quitar repuesto | `DELETE /machines/{id}/products/{product_id}` | `Coordinator` |

## 3. Reglas y validaciones

- `name` (1–100) e `identification_code` (1–30) son obligatorios; `location` (máximo 100) es opcional.
- `identification_code` duplicado → `409`.
- **Sin eliminación** (decisión de la usuaria): las máquinas se pueden crear y editar, pero no borrar, para conservar el historial de los movimientos que las referencian. La tabla no tiene un campo de estado.
- Asociar un producto inexistente → `404`. Una asociación duplicada → `409`. Quitar una asociación inexistente → `404`.
- La respuesta incluye `product_ids` (repuestos compatibles).

## 4. Relación con movimientos

En la solicitud de una salida (`EXIT`), la interfaz ofrece el selector "Máquina destino (opcional)", que primero lista las máquinas compatibles con el producto. El valor se guarda en `movement_detail.machine_id`; el backend ya validaba que la máquina existiera.

## 5. Interfaz (`frontend/maquinas.html`)

`frontend/src/components/MachinesPage.jsx`: tarjetas con búsqueda, un mensaje cuando no hay máquinas y un modal de repuestos compatibles (con stock). Solo el `Coordinator` ve los botones de crear, editar, asociar y quitar.

## 6. Pruebas

- `test_users_machines_loans.py`: CRUD, permisos, código duplicado, validación, `404`, asociar y quitar repuestos.
- Navegador (sandbox): crear una máquina, asociar un repuesto, actualizar el contador de la tarjeta, usarla como destino de una salida autorizada y ocultar las acciones a `Operator` y `Read-only`.

## 7. Pendiente

- Las asociaciones con productos inactivos se conservan y se muestran como "(inactivo)".
- Si en el futuro se necesita retirar máquinas, habrá que agregar un estado (migración).
