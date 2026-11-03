# Flujo de préstamos y devoluciones de herramientas

## 1. Propósito y alcance

Registrar el préstamo de herramientas a trabajadores, que no necesitan una cuenta en el sistema, y su devolución, conociendo en todo momento qué está prestado y a quién.

## 2. Decisiones de negocio (confirmadas por la usuaria el 2026-11-01)

- **Un préstamo no modifica `current_stock`.** La herramienta sigue siendo de la empresa. La cantidad **disponible** se calcula como `current_stock − suma de préstamos en estado loaned`.
- No se puede prestar más de lo disponible.
- `Operator` y `Coordinator` registran préstamos y devoluciones **directamente**, sin autorización. `Read-only` solo consulta.

## 3. Endpoints

| Operación | Endpoint | Roles |
|---|---|---|
| Listar | `GET /loans?status_filter=loaned\|returned` | Cualquier usuario autenticado |
| Trabajadores | `GET /workers` | Cualquier usuario autenticado |
| Prestar | `POST /loans` `{product_id, quantity, worker_name}` | `Operator`, `Coordinator` |
| Devolver | `PATCH /loans/{id}/return` | `Operator`, `Coordinator` |

## 4. Flujo

### Préstamo

1. Validación: `quantity > 0` con 2 decimales como máximo, y `worker_name` de 1 a 100 caracteres (`422`).
2. Se bloquea la fila del producto (`with_for_update()`) para serializar los préstamos simultáneos.
3. El producto debe existir (`404`) y estar activo (`400`).
4. Si `quantity > disponible` → `400` (`Insufficient available quantity ... Available: X`).
5. El trabajador se busca por nombre sin distinguir mayúsculas. Si no existe, se crea en `worker`.
6. Se crea el préstamo con estado `loaned` y fecha UTC.

### Devolución

1. El préstamo existe (`404`) y está `loaned` (`400` si ya se devolvió). La fila se bloquea.
2. Pasa a estado `returned` con `return_date` UTC. Siempre es una devolución completa: la tabla no admite devoluciones parciales.

### Relación con las salidas de inventario

**Regla confirmada por la usuaria el 2026-11-01:** al autorizar un `EXIT`, la cantidad se valida contra lo **disponible** (`current_stock − prestado`), no contra `current_stock`. Las herramientas prestadas no pueden salir del inventario; si no alcanza, la autorización devuelve `400` con `Current`, `Loaned`, `Available` y `Requested`. El cálculo está en `backend/app/services/stock.py`, que comparten préstamos y movimientos.

**Ajustes (decisión del 2026-11-03):** en un `ADJUSTMENT` se registra solo lo contado en bodega, sin las herramientas prestadas. Al autorizarlo, `current_stock = contado + prestado`. La interfaz muestra "Contado · Prestado · Stock resultante".

`ENTRY` no tiene en cuenta los préstamos.

## 5. Interfaz (`frontend/prestamos.html`)

`frontend/src/components/LoansPage.jsx`:

- Filtros Todos, Prestados (con contador, por defecto) y Devueltos. Botón "Devolver" para `Operator` y `Coordinator`.
- Formulario: herramienta con su cantidad disponible (se deshabilitan las que no tienen disponible), cantidad y trabajador con autocompletado de los existentes. Avisa cuando el trabajador es nuevo y explica que el préstamo no modifica el stock registrado.
- Campos de la maqueta omitidos porque no existen en la BD: fecha de préstamo editable (la asigna el servidor) y devolución estimada.

## 6. Pruebas

- `test_users_machines_loans.py`: el stock no cambia, límite de disponibilidad, la devolución libera disponibilidad, doble devolución (`400`), reutilización del trabajador sin distinguir mayúsculas, validaciones, producto inactivo y permisos por rol.
- `test_exit_validates_against_available_not_loaned`: con stock 10 y 6 prestados, una salida de 5 se rechaza y una de 4 se autoriza; tras la devolución, lo prestado vuelve a poder salir.
- `test_adjustment_counts_warehouse_and_adds_loaned`: con 4 prestados, un conteo de 5 deja el stock en 9 y lo disponible para salir en 5.
- Navegador (sandbox): con 2 prestados, un ajuste con 1 contado muestra "Stock resultante: 3.00" y al autorizarlo el stock queda en 3.
- Navegador (sandbox): con stock 3 y 2 prestados, una salida de 2 muestra el aviso y deja deshabilitado "Autorizar".
- Navegador (sandbox): préstamo a un trabajador nuevo, rechazo de una cantidad mayor a la disponible, devolución como `Operator` y ausencia de acciones para `Read-only`.

## 7. Pendiente

- No hay restricción de categoría: cualquier producto activo se puede prestar. No se fijó la categoría "Tools" para no acoplar el sistema a un catálogo concreto.
- No existe vista ni gestión de trabajadores (cargo, edición) aparte del autocompletado.
