# Flujo: Importar el inventario desde Excel o CSV

Sprint 5 (tarjeta «Importar el inventario desde Excel o CSV»). Implementado el 2026-11-25.

## Objetivo

Cargar un inventario completo sin escribirlo a mano: productos, stock inicial con sus lotes, máquinas y proveedores.

## Decisiones de la usuaria (2026-11-25)

- Se aceptan **Excel (.xlsx) y CSV**. Se agregó la librería `openpyxl` al backend.
- **El stock inicial se registra como movimiento:** una ENTRADA autorizada con el motivo «Carga inicial (importación)», a nombre del Coordinator que importa. Queda en el historial y genera las alertas normales.
- **Lotes:** van en la hoja de stock, una fila por lote, con su vencimiento. El stock del producto es la suma de sus lotes.
- **Registros que ya existen** (mismo código de producto o de máquina, mismo RUC, o la misma razón social si no hay RUC): no son error. La vista previa los advierte, muestra qué cambiaría y el usuario decide fila por fila si se actualizan. Si no los marca, se dejan como están.

## Quién puede

Solo `Coordinator`. Operator, Read-only y Support reciben `403`. En la interfaz, el botón **Importar** aparece en **Productos** solo para el Coordinador (acción `importar` en `lib/permissions.ts`).

## Pasos en la pantalla (`/productos/importar`)

1. **Descargar la plantilla:** un Excel con la hoja «Instrucciones» (cada columna explicada, con ejemplos) y las hojas «Productos», «Stock inicial», «Máquinas» y «Proveedores», solo con encabezados.
2. **Subir el archivo:** hasta 2 MB y 5000 filas. **Nada se guarda todavía.** La vista previa muestra cada fila como *Nuevo*, *Ya existe* o *Error*, con su mensaje en español.
3. **Decidir** qué registros existentes se actualizan (casilla «Actualizar con los datos del archivo», solo si algo cambia).
4. **Importar:** un diálogo resume lo que pasará. Si el archivo tiene un solo error, el botón está deshabilitado.

Al confirmar, el backend **vuelve a validar el mismo archivo** y lo carga **todo en una transacción**: si algo falla, no se guarda nada.

## Columnas

| Hoja | Columnas (* obligatorias) |
|---|---|
| Productos | Código*, Nombre*, Categoría*, Unidad*, Marca, Modelo, Número de parte, Stock mínimo, Stock máximo, Ubicación, Usa lotes |
| Stock inicial | Código*, Cantidad*, Lote, Vencimiento |
| Máquinas | Código*, Nombre*, Ubicación |
| Proveedores | Razón social*, RUC, Contacto, Teléfono, Dirección, Correo |

Los encabezados no distinguen mayúsculas ni tildes. Las columnas desconocidas se ignoran y la vista previa las lista. Las hojas con otro nombre (como «Instrucciones») se ignoran.

**CSV:** un archivo por tipo de dato, con los mismos encabezados. Se detecta el tipo por las columnas y el separador (`,` `;` o tabulador). Acepta UTF-8 y Latin-1 (lo que guarda Excel en Windows).

## Reglas

- **Mismas validaciones que la pantalla:** longitudes, números con hasta 2 decimales y no negativos, máximo no menor que el mínimo, RUC solo con dígitos y correo válido.
- **Números:** se aceptan `3,5` y `3.5`.
- **Fechas:** `AAAA-MM-DD`, `DD/MM/AAAA` o fechas de Excel.
- **Usa lotes:** Sí o No (vacío = No).
- **Categoría:** si no existe, **se crea** (la vista previa lo avisa, por si es un error de escritura).
- **Unidad:** debe existir. Se busca por nombre o abreviatura.
- **Códigos repetidos dentro del archivo:** error en la segunda fila.
- **Stock inicial:**
  - Solo para **productos nuevos de la misma importación**. El stock de un producto que ya existe se corrige con un ajuste, no importando.
  - La cantidad debe ser mayor que 0.
  - **Con lotes:** el número de lote es obligatorio y no puede repetirse para el mismo producto. Un lote vencido no se puede cargar (una entrada con lote vencido está prohibida).
  - **Sin lotes:** Lote y Vencimiento deben quedar vacíos, y cada producto lleva una sola fila de stock.
- **Producto existente desactivado:** error (hay que reactivarlo antes).
- **Producto existente:** «Usa lotes» solo puede cambiar si su stock es 0.
- **Módulos desactivados:** si Máquinas o Proveedores está desactivado en Configuración, su hoja da error.
- **Alertas:** se aplican igual que al crear un producto a mano y al autorizar una entrada.

## Implementación

- **Backend:**
  - `backend/app/services/importer.py`: lectura, validación, carga y plantilla.
  - `backend/app/routers/imports.py`:
    - `GET /imports/template`
    - `POST /imports/preview`
    - `POST /imports/confirm`
  - El archivo viaja como base64 en JSON, igual que el logo, así que no hace falta `python-multipart`.
  - Los mensajes por fila están en español porque son un informe para quien carga el archivo. Los errores del archivo responden `400` con `detail.code`:
    - `import_file`: no se puede leer.
    - `import_has_errors`: la confirmación encontró errores e incluye la vista previa.
- **Frontend:**
  - `frontend/src/pages/products/ImportPage.tsx`.
  - Las funciones de `api/endpoints.ts` leen los errores propios del importador.
  - `useConfirmImport` recarga productos, lotes, alertas, movimientos, categorías, máquinas y proveedores.
  - `/imports` se agregó al proxy de `vite.config.ts` y a `vercel.json`.

## Pruebas

- **`backend/tests/test_importer.py` (18 pruebas, transacción revertida):**
  - Plantilla y permisos.
  - Carga completa con lotes, movimiento autorizado, categoría nueva, máquina y proveedor.
  - La vista previa no guarda nada.
  - Errores por fila que bloquean todo.
  - Stock de un producto existente.
  - Actualizar o dejar un registro existente.
  - CSV con `;`, coma decimal y Latin-1.
  - Módulo desactivado.
  - Conversión de números.
- **`frontend/src/pages/products/ImportPage.test.tsx` (4 pruebas):**
  - Los errores bloquean.
  - Lo existente solo se actualiza si se marca.
  - Archivo ilegible.
  - Formato no admitido.
- **En el navegador (2026-11-25), Chromium contra `aroma_test`, a 1366 y 390 px, sin desplazamiento horizontal:**
  - Descargar la plantilla.
  - Archivo con errores: el botón de importar queda deshabilitado.
  - Archivo correcto con un producto existente actualizado, y el resultado comprobado en la BD:
    - Stock de 12 y de 5 en dos lotes.
    - Movimiento ENTRY autorizado «Carga inicial (importación)».
    - El producto existente cambió sus datos, pero no su stock.
  - Al volver a subir el mismo archivo, el stock de los productos ya creados aparece como error.
