# Flujo de movimientos de inventario

## 1. Propósito

Documentar el funcionamiento actual de las solicitudes de movimientos de inventario, su autorización, la actualización del stock y la gestión de alertas.

Este documento distingue entre el comportamiento verificado en el código, las reglas de negocio definidas para Aroma Cacao y los aspectos que requieren comprobación adicional.

## 2. Actores y permisos

| Rol | Crear solicitudes | Autorizar solicitudes | Consultar movimientos |
|---|---|---|---|
| `Operator` | Sí | No | Mediante endpoints autenticados |
| `Coordinator` | Sí | Sí | Mediante endpoints autenticados |
| `Read-only` | No | No | Sí, solo lectura |

### Regla de autorización

Solo un usuario con el rol `Coordinator` puede autorizar un movimiento pendiente.

Un `Coordinator` puede autorizar una solicitud que él mismo haya creado. No se exige que el solicitante y el autorizador sean personas diferentes.

El rol `Read-only` no debe tener permisos para crear, autorizar, modificar ni eliminar movimientos.

**Nota sobre la implementación:** las rutas revisadas exigen autenticación para consultar movimientos, pero no aplican un filtro de visibilidad por rol. La restricción estricta de solo lectura debe verificarse también en los demás endpoints de la aplicación.

## 3. Tipos de movimiento

| Tipo | Efecto sobre el stock al autorizar |
|---|---|
| `ENTRY` | Suma la cantidad al stock actual. |
| `EXIT` | Resta la cantidad, siempre que exista stock suficiente. |
| `ADJUSTMENT` | Establece el stock actual en la cantidad indicada. |

En `ADJUSTMENT`, la cantidad representa el stock final deseado, no una cantidad que deba sumarse o restarse.

La implementación actual no exige que la cantidad de un ajuste sea mayor que cero; el esquema admite cantidades iguales a cero.

## 4. Flujo principal

### Paso 1. Crear una solicitud

El usuario autenticado envía una solicitud mediante:

`POST /movements`

El cuerpo debe incluir un tipo de movimiento válido y al menos un detalle.

Cada detalle contiene:

- `product_id`: identificador del producto.
- `quantity`: cantidad solicitada.
- `lot_id`: lote opcional.
- `machine_id`: máquina opcional.

El sistema comprueba que el usuario tenga el rol `Operator` o `Coordinator`, que el producto exista y esté activo, y que los datos del lote y de la máquina cumplan las validaciones implementadas.

Si se proporciona un lote, debe existir y pertenecer al producto indicado. Si se proporciona una máquina, debe existir.

Para `ENTRY` y `EXIT`, la cantidad debe ser mayor que cero. El esquema impide cantidades negativas y exige al menos un detalle.

Si las validaciones pasan, el sistema crea el movimiento con estado `pending` y registra el identificador del solicitante en `requesting_user_id`.

**Resultado:** la solicitud queda pendiente. La creación de la solicitud no actualiza por sí misma el stock.

### Paso 2. Consultar la solicitud

Los endpoints de consulta son:

- `GET /movements`: lista movimientos y admite filtros por estado y tipo.
- `GET /movements/{movement_id}`: consulta un movimiento específico.

Ambos requieren autenticación. La ruta de listado ordena los movimientos por identificador descendente.

En las rutas revisadas no se observa un filtro de visibilidad según el rol o el usuario solicitante.

### Paso 3. Autorizar la solicitud

El `Coordinator` utiliza:

`PATCH /movements/{movement_id}/authorize`

La ruta no necesita un cuerpo de solicitud para esta operación.

El sistema comprueba que:

1. El usuario autenticado tenga el rol `Coordinator`.
2. El movimiento exista.
3. Su estado sea `pending`.
4. Tenga detalles asociados.
5. Los productos relacionados existan y estén activos.
6. Las salidas no excedan el stock disponible.

El sistema bloquea la fila del movimiento y las filas de los productos involucrados mediante `with_for_update()` durante la operación.

No se impide que el coordinador autorice una solicitud propia.

### Paso 4. Actualizar el inventario

Si las validaciones se cumplen, el sistema aplica el efecto correspondiente a cada detalle:

- `ENTRY`: suma la cantidad al stock actual.
- `EXIT`: resta la cantidad, si el stock es suficiente.
- `ADJUSTMENT`: reemplaza el stock actual por la cantidad indicada.

Si una salida no dispone de stock suficiente, la operación debe rechazarse sin guardar parcialmente los cambios de esa transacción.

### Paso 5. Gestionar las alertas de stock

Después de calcular el stock, el sistema compara el resultado con el stock mínimo del producto.

- Si el stock queda en el mínimo o por debajo de él, busca una alerta activa para el producto y crea una si no encuentra ninguna.
- Si el stock queda por encima del mínimo, busca las alertas activas y las marca como resueltas.

La alerta registra el producto, la fecha de generación, el stock observado y el estado.

La prevención de duplicados depende actualmente de una consulta previa. La revisión del modelo no encontró una restricción única que garantice por sí sola que nunca existan dos alertas activas del mismo producto. Es necesario comprobar también las restricciones reales de la base de datos.

### Paso 6. Confirmar la autorización

Al finalizar la operación, el sistema:

- Cambia el estado del movimiento a `authorized`.
- Guarda el identificador del coordinador en `authorizing_user_id`.
- Confirma la transacción mediante `commit()`.
- Devuelve la representación del movimiento.

La autorización, los cambios de stock y la gestión de alertas se realizan antes de ese `commit()` final, con la intención de guardar conjuntamente los cambios de la transacción.

## 5. Estados del movimiento

| Estado | Significado |
|---|---|
| `pending` | La solicitud se ha creado y está pendiente de autorización. |
| `authorized` | Un coordinador ha autorizado la solicitud y se ha aplicado el proceso de actualización de inventario. |

Estos son los estados observados en el flujo revisado. No se ha verificado la implementación de estados adicionales, como rechazado o cancelado.

## 6. Trazabilidad

El modelo `Movement` registra:

- `requesting_user_id`: usuario que creó la solicitud.
- `authorizing_user_id`: usuario que la autorizó; es nulo mientras no se haya autorizado.
- `date`: fecha del movimiento.
- `type`: tipo de movimiento.
- `status`: estado actual.
- `reason`: motivo opcional.
- `work_order_number`: número de orden de trabajo opcional.

Cada detalle registra el producto, la cantidad y, cuando corresponda, el lote y la máquina.

Estos datos permiten identificar quién solicitó y quién autorizó un movimiento, incluso cuando ambas referencias corresponden al mismo usuario.

## 7. Errores y caminos alternativos

El flujo debe contemplar, al menos, estos casos:

- Usuario no autenticado: la solicitud no debe acceder a una ruta protegida.
- Rol no autorizado: se devuelve un error de autorización; la ruta de autorización devuelve `403` cuando el usuario no es `Coordinator`.
- Movimiento inexistente: la ruta de autorización devuelve `404`.
- Movimiento que ya no está pendiente: la autorización se rechaza.
- Solicitud sin detalles: la autorización se rechaza.
- Producto inexistente o inactivo: no se debe aplicar el movimiento.
- Lote inexistente o asociado a otro producto: no se debe aceptar el detalle.
- Máquina inexistente: no se debe aceptar el detalle.
- Salida superior al stock disponible: se rechaza la operación.
- Error durante la operación: la transacción debe revertirse para evitar cambios parciales.

Los códigos y mensajes exactos de todos estos errores deben contrastarse con la implementación completa y las pruebas.

## 8. Reglas de negocio de Aroma Cacao

1. Solo `Operator` y `Coordinator` pueden crear solicitudes.
2. Solo `Coordinator` puede autorizar solicitudes.
3. Un coordinador puede autorizar su propia solicitud.
4. Crear una solicitud no modifica el stock.
5. El stock se actualiza al autorizar el movimiento.
6. Una salida no puede dejar el stock negativo.
7. El stock mínimo determina cuándo se genera o resuelve una alerta.
8. `Read-only` debe permanecer estrictamente en modo consulta.

## 9. Aspectos pendientes de verificación

- Confirmar que `Read-only` no puede modificar datos a través de ninguna otra ruta protegida.
- Revisar las restricciones e índices reales de la base de datos para las alertas.
- Comprobar el comportamiento ante errores y concurrencia mediante pruebas.
- Determinar si deben validarse los estados de actividad de lotes y máquinas.
- Verificar qué ocurre con tipos de movimiento inesperados si se introducen directamente en la base de datos.
- Confirmar si existe un flujo de rechazo o cancelación; no se ha identificado en las rutas revisadas.
- Verificar las reglas de autorización de los demás módulos para que los permisos sean coherentes en toda la aplicación.

## 10. Criterios de aceptación del flujo

- Una solicitud válida queda en estado `pending`.
- Crear una solicitud no altera el stock.
- Un `Operator` no puede autorizar movimientos.
- Un `Read-only` no puede crear ni modificar movimientos.
- Un `Coordinator` puede autorizar una solicitud propia o ajena.
- Una salida con stock insuficiente no se confirma.
- Una autorización válida registra al coordinador y actualiza el estado.
- Los cambios de stock, estado y alertas se guardan de manera coherente.
- Las pruebas comprueban tanto los casos válidos como los errores.
