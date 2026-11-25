# Flujo: Exportar a Excel o CSV

Sprint 5, pedido por la usuaria el 2026-11-25.

## Decisiones de la usuaria (2026-11-25)

- **Qué se exporta:** el inventario completo y el historial de movimientos.
- **Quién:** todos los roles (Coordinator, Operator, Read-only y Support). Ya ven estos datos en pantalla, así que exportarlos no les da más acceso.
- **Dónde:** una sola pantalla, **Exportar** (`/exportar`). Se abre desde el menú de la persona (su nombre, arriba a la derecha) y desde «Más» en el celular. No va en el menú lateral, para no recargarlo (decisión de la usuaria, 2026-11-25).

## Inventario completo

- **Excel:** un archivo con la hoja «Exportación» (empresa, quién exportó, cuándo y notas) y las hojas «Productos», «Stock inicial», «Máquinas» y «Proveedores».
  - **Mismo formato que la plantilla de importación:** sirve de respaldo y se puede importar en otra instalación.
  - Productos lleva una columna extra, **Estado** (Activo/Inactivo). Al importar se ignora y los productos se crean activos.
  - «Stock inicial» tiene el **stock actual**: una fila por producto sin lotes con stock mayor que 0, y una fila por lote con cantidad en los productos con lotes.
  - Al importar en otra instalación, los lotes vencidos se rechazan (no se puede cargar una entrada con un lote vencido).
- **CSV:** un tipo de dato por archivo. La pantalla pide cuál: productos, stock, máquinas o proveedores.
- **Módulos desactivados:** su hoja no se incluye, y su CSV responde `403`.

## Historial de movimientos

- **Una fila por producto de cada movimiento:** N.º movimiento, Fecha, Tipo, Estado, Código, Producto, Cantidad, Unidad, Lote, Máquina, Orden de trabajo, Motivo, Solicitó y Revisó.
- **Filtros:** rango de fechas (por defecto, desde el primer día del mes hasta hoy), tipo y estado. Si «Desde» o «Hasta» quedan vacíos, ese extremo no tiene límite.
- **Zona horaria:** las fechas se guardan en UTC. El navegador envía su zona horaria (`tz`, por ejemplo `America/Guayaquil`) y el archivo muestra la misma hora que la pantalla. El rango de fechas también se cuenta en esa zona.

## Formato de los archivos

- **Excel:** las fechas son fechas reales de Excel, con el formato de fecha de la empresa (Configuración), y los números son números.
- **CSV:** UTF-8 con BOM (Excel muestra bien las tildes), separado por comas, decimales con punto y fechas `AAAA-MM-DD HH:MM`.
- **Seguridad (inyección CSV):** un texto escrito por un usuario que empieza con `=`, `+`, `-` o `@` nunca se convierte en fórmula. En Excel se guarda como texto y en CSV se le antepone `'`.

## Implementación

- **Backend:**
  - `backend/app/services/exporter.py`: tablas y escritura de Excel y CSV. Reutiliza las columnas del importador.
  - `backend/app/routers/exports.py`:
    - `GET /exports/inventory?format=xlsx|csv&kind=…&tz=…`
    - `GET /exports/movements?format=…&date_from=…&date_to=…&type_filter=…&status_filter=…&tz=…`
- **Frontend:**
  - `frontend/src/pages/ExportPage.tsx`.
  - `downloadFile()` en `api/endpoints.ts` descarga con la sesión y toma el nombre del archivo del servidor. La plantilla de importación también la usa.
  - `/exports` se agregó al proxy de `vite.config.ts` y a `vercel.json`.

## Pruebas

- **`backend/tests/test_exporter.py` (10 pruebas):**
  - Hojas y columnas del inventario, con lotes.
  - El archivo exportado se vuelve a importar y sus productos aparecen como «Ya existe» sin cambios.
  - CSV por tipo y módulos desactivados.
  - Textos con forma de fórmula.
  - Todos los roles pueden exportar.
  - Movimientos en hora local y filtros por zona horaria.
  - Parámetros no válidos.
- **`frontend/src/pages/ExportPage.test.tsx` (3 pruebas):**
  - Inventario en Excel.
  - CSV sin los módulos desactivados.
  - Filtros y rango de fechas al revés.
- **En el navegador (2026-11-25), Chromium contra `aroma_test`, como Operator, a 1366 y 390 px, sin desplazamiento horizontal:**
  - Se descargaron el inventario en Excel y los movimientos en CSV.
  - Se revisó el contenido: hojas, lotes con vencimiento y horas de Ecuador.
