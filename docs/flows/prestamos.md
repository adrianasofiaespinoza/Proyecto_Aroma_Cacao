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

## 5. Interfaz (`frontend/prestamos.html`)

`frontend/src/components/LoansPage.jsx`:

- Filtros Todos, Prestados (con contador, por defecto) y Devueltos. Botón "Devolver" para `Operator` y `Coordinator`.
- Formulario: herramienta con su cantidad disponible (se deshabilitan las que no tienen disponible), cantidad y trabajador con autocompletado de los existentes. Avisa cuando el trabajador es nuevo y explica que el préstamo no modifica el stock registrado.
- Campos de la maqueta omitidos porque no existen en la BD: fecha de préstamo editable (la asigna el servidor) y devolución estimada.

## 6. Pruebas

- `test_users_machines_loans.py`: el stock no cambia, límite de disponibilidad, la devolución libera disponibilidad, doble devolución (`400`), reutilización del trabajador sin distinguir mayúsculas, validaciones, producto inactivo y permisos por rol.
- Navegador (sandbox): préstamo a un trabajador nuevo, rechazo de una cantidad mayor a la disponible, devolución como `Operator` y ausencia de acciones para `Read-only`.

## 7. Pendiente y decisiones abiertas

- **Interacción con salidas:** al autorizar un `EXIT` hoy solo se compara con `current_stock`, no con la cantidad disponible. Una salida podría dejar el stock por debajo de lo prestado. Hay que decidir si la salida debe validarse contra el disponible.
- No hay restricción de categoría: cualquier producto activo se puede prestar. No se fijó la categoría "Tools" para no acoplar el sistema a un catálogo concreto.
- No existe vista ni gestión de trabajadores (cargo, edición) aparte del autocompletado.
