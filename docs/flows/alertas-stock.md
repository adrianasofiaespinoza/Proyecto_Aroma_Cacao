# Flujo: Alertas de Stock Mínimo

## 1. Objetivo
Garantizar que el sistema notifique (mediante la creación de un registro de alerta) siempre que el stock de un producto activo sea igual o inferior al stock mínimo definido, independientemente de cómo se haya producido el cambio.

## 2. Reglas de Negocio
- **Disparo de Alerta:** Se debe crear una alerta con estado `active` si:
  - `product.status == 'active'`
  - `product.current_stock <= product.minimum_stock`
  - No existe ya una alerta `active` para ese producto.
- **Consolidación:** Si existen múltiples alertas `active` para un mismo producto, se conserva la más reciente y las demás se marcan como `resolved`.
- **Resolución de Alerta:** Todas las alertas `active` de un producto deben pasar a estado `resolved` si:
  - `product.current_stock > product.minimum_stock`
  - `product.status != 'active'` (El producto es desactivado).
- **Trazabilidad:** Las alertas no se eliminan, solo cambian su estado para conservar el historial.

## 3. Implementación Técnica

### Lógica Centralizada
La regla de negocio reside en `backend/app/services/alerts.py` mediante la función `update_stock_alerts(db, product)`. Esta función no gestiona transacciones propias (`commit`), delegando el control al router.

### Puntos de Integración
La función es invocada en los siguientes endpoints:
1. **`POST /products`**: Evalúa el stock inicial inmediatamente después de la creación (`db.flush()`) y antes del `db.commit()`.
2. **`PUT /products/{id}`**: Re-evalúa las alertas al modificar `minimum_stock` o el estado del producto.
3. **`DELETE /products/{id}`**: Resuelve alertas activas al cambiar el estado a `inactive`.
4. **`PATCH /movements/{id}/authorize`**: Actualiza las alertas tras mutar las existencias (`current_stock`) de cada producto involucrado.

## 4. Verificación y Estado
La funcionalidad ha sido revisada mediante análisis estático de código y validación de sintaxis.

- **Comprobaciones ejecutadas:**
  - Revisión de la secuencia transaccional en routers.
  - Validación de la lógica de consolidación de duplicados en el servicio.
  - Verificación de sintaxis (Linter).
  - Pruebas funcionales ejecutadas en PostgreSQL 17 (`aroma_inventory`) cubriendo los casos A-H.
- **Pendientes:**
  - Pruebas de concurrencia extrema: la prevención de duplicados depende de la serialización de transacciones y no existe una restricción de unicidad en la base de datos que lo garantice bajo carga simultánea.


## 5. Criterios de Aceptación
- [x] Crear un producto con stock $\le$ mínimo $\rightarrow$ Alerta creada.
- [x] Actualizar `minimum_stock` $\rightarrow$ Alerta creada/resuelta según el nuevo umbral.
- [x] Desactivar producto $\rightarrow$ Alertas resueltas.
- [x] Autorizar movimientos $\rightarrow$ Alertas creadas/resueltas según mutación de stock.
- [x] Existencia de alertas duplicadas $\rightarrow$ Consolidación a una sola alerta activa.
