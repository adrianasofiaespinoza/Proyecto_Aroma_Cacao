# Flujo de lotes y vencimientos

## 1. Propósito y alcance

Registrar lotes, fechas de vencimiento y cantidades restantes de los productos que requieren trazabilidad, como pide el README. Los demás productos funcionan sin lotes.

## 2. Reglas de negocio (confirmadas por la usuaria el 2026-11-05)

- **Trazabilidad por producto:** `product.requires_lot` (migración 002). En estos productos toda entrada, salida y ajuste debe indicar un lote. En los demás, indicar un lote devuelve `400`.
- **La suma de los lotes coincide con `current_stock`.** Para garantizarlo:
  - Un producto con lotes empieza con stock 0 (`400` si se crea con stock).
  - `requires_lot` solo se puede cambiar cuando el stock es 0 (`400`).
  - La cantidad de un lote nunca se edita directamente: solo cambia con movimientos autorizados.
  - **Un producto con lotes no se puede prestar** (`400`). Los préstamos son para herramientas y los lotes, para insumos.
- **Lotes vencidos:** un lote vence al terminar su fecha de vencimiento (el mismo día todavía es válido). No admite entradas ni salidas, ni al crear la solicitud ni al autorizarla (`400`). Para retirarlo se usa un **ajuste a 0** con su motivo.
- **Aviso:** el dashboard muestra los lotes con existencias vencidos o que vencen en los próximos **30 días**. El valor es fijo en `DashboardPage.jsx` y pasará a la configuración de la empresa.

## 3. Permisos y endpoints

| Operación | Endpoint | Roles |
|---|---|---|
| Listar | `GET /lots`, `GET /lots?expiring_within_days=30` | Cualquier usuario autenticado |
| Registrar | `POST /products/{id}/lots` `{lot_number, expiration_date?}` | `Operator`, `Coordinator` |
| Corregir número o vencimiento | `PUT /lots/{id}` | `Coordinator` |

El `Operator` puede registrar lotes porque los necesita para solicitar entradas. Es seguro porque todo lote empieza con cantidad 0.

Validaciones al registrar:

- `lot_number`: 1–30 caracteres, único por producto (`409`).
- `expiration_date`: opcional; no puede estar en el pasado (`400`). Al corregir sí se admite una fecha pasada, para reflejar la realidad.
- El producto debe existir (`404`), estar activo (`400`) y requerir lotes (`400`).

## 4. Efecto de los movimientos al autorizar

La fila del lote se bloquea con `with_for_update()` y las reglas se repiten, porque el lote pudo vencer mientras la solicitud estaba pendiente.

| Tipo | Lote | `current_stock` |
|---|---|---|
| `ENTRY` | Suma la cantidad | Suma la cantidad |
| `EXIT` | Resta; `400` si el lote no tiene suficiente | Resta |
| `ADJUSTMENT` | Queda en lo contado de ese lote | Cambia en la diferencia (`contado − cantidad anterior del lote`) |

En productos con lotes, el ajuste es por lote: la cantidad es lo contado de ese lote, no el total de la bodega.

## 5. Interfaz

- **Productos:** casilla "Este producto requiere trazabilidad por lote" (al activarla, el stock inicial se deshabilita), etiqueta "Lotes" en la tabla y botón para abrir `LotsModal.jsx`: lista de lotes, registro y corrección según el rol.
- **Movimientos:**
  - Selector de lote con vencimiento y cantidad. Los lotes vencidos, y en las salidas los que no tienen existencias, aparecen deshabilitados.
  - En las entradas se puede registrar un lote nuevo desde el mismo formulario.
  - Avisos si una salida supera lo que queda en el lote, y vista previa del stock en los ajustes.
  - Al revisar: datos del lote, stock resultante y "Autorizar" deshabilitado si el lote está vencido o no alcanza.
- **Dashboard:** tabla "Lotes vencidos o por vencer".
- **Préstamos:** no ofrece productos con lotes.

## 6. Pruebas

- `backend/tests/test_lots.py`: permisos, duplicados, fecha pasada, cantidad no editable, lote obligatorio o rechazado, lote de otro producto, sincronía de lotes y stock en entradas, salidas y ajustes, vencidos (también en solicitudes pendientes), el filtro de vencimiento, cambio de `requires_lot` y préstamos bloqueados.
- Navegador (2026-11-05, backend en modo sandbox con transacción revertida; la BD quedó sin cambios): recorrido completo como `Coordinator` y vista de solo lectura como `Read-only`.

## 7. Pendiente

- Salida automática del lote que vence primero (FEFO): hoy se elige manualmente.
- Días de aviso configurables (Sprint 3).
- Importar lotes desde Excel o CSV (Sprint 5).
