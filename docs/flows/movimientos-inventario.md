# Flujo de movimientos de inventario

## 1. Propósito

Documentar el funcionamiento de las solicitudes de movimientos de inventario, su autorización o rechazo, la actualización del stock, la gestión de alertas y la interfaz que las utiliza.

Este documento distingue entre comportamiento implementado, comportamiento probado y aspectos pendientes.

## 2. Actores y permisos

| Rol | Crear solicitudes | Autorizar / rechazar | Consultar movimientos |
|---|---|---|---|
| `Operator` | Sí | No (`403`) | Sí |
| `Coordinator` | Sí | Sí | Sí |
| `Read-only` | No (`403`) | No (`403`) | Sí, solo lectura |

- Un `Coordinator` puede autorizar o rechazar una solicitud creada por él mismo.
- Los permisos se aplican en el backend. La interfaz además oculta los botones que el rol no puede usar.
- **Probado** (`test_movements_flow.py`): `Read-only` recibe `403` al crear, autorizar, rechazar y desactivar productos, y `200` al consultar productos y movimientos.

## 3. Tipos de movimiento

| Tipo | Cantidad | Motivo | Efecto al autorizar |
|---|---|---|---|
| `ENTRY` | `> 0` | Opcional | Suma la cantidad al stock. |
| `EXIT` | `> 0` | **Obligatorio** | Resta la cantidad solo si hay suficiente **disponible** (stock − prestado). |
| `ADJUSTMENT` | `>= 0` | **Obligatorio** | Establece el stock en **lo contado en bodega + lo prestado**. |

En `ADJUSTMENT`, la cantidad es **lo contado físicamente en bodega**, no una diferencia. Las herramientas prestadas no están en bodega, así que el sistema las suma: `stock final = contado + prestado` (decisión de la usuaria del 2026-11-03). Sin préstamos activos, equivale al stock final. Se permite `0`.

**Regla acordada:** una salida que supera el stock disponible **siempre se rechaza** y el stock nunca queda negativo. No existe autorización de emergencia. El README mencionaba esa posibilidad; se decidió no implementarla.

## 4. Flujo principal

### Paso 1. Crear una solicitud — `POST /movements`

Cuerpo:

```json
{
  "type": "EXIT",
  "reason": "Cambio de rodamiento en molino M-1",
  "work_order_number": "OT-1234",
  "details": [{ "product_id": 1, "quantity": "2", "lot_id": null, "machine_id": null }]
}
```

Validaciones (Pydantic, `422`):

- `type` ∈ `ENTRY`, `EXIT`, `ADJUSTMENT`; al menos un detalle.
- `quantity >= 0`, con un máximo de 10 dígitos y 2 decimales (`Numeric(10,2)`).
- `reason` es obligatorio (sin contar espacios) en `EXIT` y `ADJUSTMENT`; máximo 150 caracteres.
- `work_order_number`: máximo 30 caracteres.

Validaciones del router:

- El rol debe ser `Operator` o `Coordinator` (`403`).
- `ENTRY`/`EXIT` con cantidad `<= 0` → `400`.
- El producto debe existir (`404`) y estar activo (`400`).
- El lote, si se envía, debe existir (`404`) y pertenecer al producto (`400`).
- La máquina, si se envía, debe existir (`404`).

**Resultado:** `201`, estado `pending` y `requesting_user_id` igual al usuario autenticado. **El stock no cambia.**

### Paso 2. Consultar — `GET /movements`, `GET /movements/{id}`

- Ordenado por `id` descendente.
- Filtros opcionales: `status_filter` ∈ `pending | authorized | rejected` y `type_filter` ∈ `ENTRY | EXIT | ADJUSTMENT`. Un valor no válido devuelve `422`.
- La respuesta incluye `requesting_user_name` y `authorizing_user_name` (nombre completo), para que la interfaz no necesite un listado de usuarios.

### Paso 3a. Autorizar — `PATCH /movements/{id}/authorize`

1. Rol `Coordinator` (`403`).
2. El movimiento existe (`404`) y está `pending` (`400`). La fila se bloquea con `with_for_update()`.
3. Por cada detalle: el producto se bloquea con `with_for_update()`, debe existir y estar activo, y se aplica el efecto del tipo de movimiento. Un `EXIT` mayor que lo disponible (stock − herramientas prestadas, ver `prestamos.md`) devuelve `400` (`Insufficient stock ... Loaned ... Available ...`).
4. `update_stock_alerts()` sincroniza las alertas de cada producto.
5. Estado `authorized`, `authorizing_user_id` y un único `commit()`.

Si cualquier paso falla, `get_db` revierte la transacción: no se guardan cambios parciales de stock, estado ni alertas.

### Paso 3b. Rechazar — `PATCH /movements/{id}/reject`

1. Rol `Coordinator` (`403`).
2. El movimiento existe (`404`) y está `pending` (`400`). Usa el mismo bloqueo de fila que la autorización, para que ambas no puedan ejecutarse a la vez.
3. Estado `rejected`. `authorizing_user_id` registra quién rechazó.
4. **No modifica el stock ni las alertas.**

## 5. Estados

```
pending ──authorize──▶ authorized
   │
   └──────reject─────▶ rejected
```

`authorized` y `rejected` son estados finales: cualquier nueva autorización o rechazo devuelve `400`. No existe cancelación por parte del solicitante.

## 6. Base de datos

Restricciones reales de PostgreSQL relacionadas con este flujo:

| Restricción | Regla |
|---|---|
| `chk_movement_type` | `type IN ('ENTRY','EXIT','ADJUSTMENT')` |
| `chk_movement_status` | `status IN ('pending','authorized','rejected')` |
| `chk_movement_quantity` | `quantity >= 0` |

`chk_movement_status` y `chk_movement_quantity` se modificaron mediante `database/migrations/001_movement_reject_and_zero_adjustment.sql`, aplicada en la BD local el 2026-11-01. Antes, el estado `rejected` y los ajustes a 0 fallaban con un `500`. **Pendiente:** aplicar la migración en cualquier otra base de datos, como la de Render si existe.

## 7. Trazabilidad

`Movement` registra el tipo, la fecha (UTC), el solicitante, quien autorizó o rechazó, el estado, el motivo y la orden de trabajo. Cada detalle registra el producto, la cantidad, el lote y la máquina.

## 8. Interfaz (`frontend/movimientos.html`)

Componente `frontend/src/components/MovementsPage.jsx`, montado por `src/movimientos-react.jsx`:

- Lista los movimientos reales con filtros en el cliente (Todos, Pendientes con contador, Entradas, Salidas, Ajustes) y estados de carga, error con opción de reintentar y lista vacía.
- **Nuevo movimiento** (solo `Operator` y `Coordinator`): tipo, producto activo con su stock, cantidad (en un ajuste, "Stock final contado"), orden de trabajo y motivo (obligatorio en salidas y ajustes). Valida en el cliente y muestra los errores del servidor. Avisa si una salida supera el stock.
- **Revisar** (solo `Coordinator`, movimientos pendientes): muestra los detalles con el stock actual (y lo prestado, si hay) y el resultante, y ofrece Autorizar o Rechazar. Autorizar se deshabilita si una salida supera lo disponible. El formulario de nueva solicitud también muestra lo prestado y avisa con el mismo criterio. Tras la acción, recarga los movimientos y productos.
- **Ver detalle** (resto de casos): solo lectura, incluido quién autorizó o rechazó.
- En las salidas, el selector "Máquina destino (opcional)" lista primero las máquinas compatibles con el producto (ver `maquinas.md`). El detalle muestra la máquina.
- Limitaciones actuales: la interfaz crea solicitudes de un solo detalle y no tiene selector de lote, porque no existe un endpoint de lotes. La fecha la asigna el servidor.

## 9. Pruebas

| Archivo | Requiere BD | Cubre |
|---|---|---|
| `backend/tests/test_schema_validation.py` | No | Límites de longitud y numéricos, decimales, motivo, tipos válidos. |
| `backend/tests/test_movements_flow.py` | Sí (transacción revertida) | Permisos por rol, pendiente sin cambio de stock, autorización propia, salida insuficiente sin cambios, alerta al llegar al mínimo, ajuste a 0, motivo obligatorio, rechazo, estados finales, `404`, filtros y catálogos. |
| `backend/tests/test_inventory_limits.py` | Sí | Límites de ajustes. |

Resultado local (2026-11-01): **47 pruebas aprobadas** y `ruff check .` sin hallazgos.

Verificación en el navegador (Playwright + Chromium), como `Coordinator` y `Read-only`: listado, filtros, visibilidad de botones por rol, validaciones del formulario, modal de detalle y redirección a `login.html` con un token inválido.

El 2026-11-01 también se verificaron las escrituras desde el navegador, con el backend en **modo sandbox**: una única transacción de PostgreSQL que se revierte al detener el servidor. Se probó crear un `EXIT` con máquina destino, revisarlo (stock actual y resultante), autorizarlo (el stock baja) y crear y rechazar un `ENTRY` (el stock no cambia). Como `Operator`: crea solicitudes, pero no ve "Revisar". Al terminar se comprobó que la BD no había cambiado.

## 10. Pendiente

- Probar el inicio de sesión real (con contraseña) y luego crear → autorizar y crear → rechazar con credenciales reales. El flujo ya se verificó en el sandbox con tokens generados localmente.
- `EXIT` con lote: `lot.remaining_quantity` no se descuenta al autorizar.
- Lotes y máquinas no tienen un campo de estado (activo/inactivo), por lo que no hay nada que validar. Si se agrega, habrá que validarlo al crear y al autorizar.
- Un `ADJUSTMENT` con dos detalles del mismo producto aplica el último; no se rechaza la duplicidad.
- Concurrencia: el bloqueo pesimista está implementado, pero no se ha probado con transacciones concurrentes reales.
- `test_movements_flow.py` y `test_inventory_limits.py` no se ejecutan en CI porque requieren PostgreSQL. `test_schema_validation.py` podría agregarse a CI, ya que no la necesita.
