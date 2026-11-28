# Contexto del proyecto: Aroma Cacao

## 1. Objetivo del proyecto

Desarrollar un sistema web de gestión de inventario para Aroma Cacao, con una arquitectura mantenible, reglas de negocio claras y capacidad de adaptación a otras empresas.

- **Repositorio:** [https://github.com/adrianasofiaespinoza/Proyecto_Aroma_Cacao](https://github.com/adrianasofiaespinoza/Proyecto_Aroma_Cacao)
- **Ruta local:** `~/Documents/Proyecto_aroma_cacao`
- **Sistema operativo:** CachyOS Linux.
- **Terminal:** Fish.
- **Backend:** `backend/`
- **Frontend:** `frontend/`
- **Base de datos:** `database/`

El trabajo se realiza y prueba localmente. No ejecutar `git push` ni publicar cambios sin autorización expresa.

## 2. Stack tecnológico

| Tecnología              | Uso                                   |
| ----------------------- | ------------------------------------- |
| React 19 + TypeScript   | Interfaz de usuario                   |
| React Router 7          | Rutas de la aplicación (una sola página) |
| TanStack Query 5        | Datos del servidor en el frontend     |
| Vite 8                  | Desarrollo y compilación del frontend |
| Tailwind CSS v4         | Estilos y diseño adaptable            |
| Bootstrap Icons         | Iconografía (SVG en línea)            |
| Vitest                  | Pruebas automatizadas del frontend    |
| Python y FastAPI        | Backend y API REST                    |
| PostgreSQL 17 en Docker | Persistencia de datos                 |
| SQLAlchemy              | ORM y acceso a datos                  |
| Pydantic                | Validación de datos                   |
| `python-jose`           | Autenticación mediante JWT            |
| `pwdlib` con Argon2id   | Hashing de contraseñas                |
| pytest                  | Pruebas automatizadas del backend     |
| Ruff 0.9.2              | Linting y análisis estático           |
| GitHub Actions          | Integración continua (CI)             |
| Render                  | Despliegue público de la API          |

- **Contenedor:** aroma-postgres
- **Usuario PostgreSQL:** aroma_user
- **Base de datos:** aroma_inventory

## 3. Estado actual del sistema

### A. Base de datos

**Estado: implementada y verificada localmente.**

PostgreSQL está configurado mediante Docker. La base de datos, las tablas principales y los datos iniciales ya fueron verificados.

No repetir la configuración ni las verificaciones iniciales salvo que aparezca un problema concreto.

### B. Autenticación y seguridad

**Estado: implementación revisada; quedan pendientes algunas verificaciones de integración y casos límite.**

Se han revisado los siguientes aspectos:

- Registro e inicio de sesión mediante correo electrónico y contraseña.
- Hashing de contraseñas con Argon2id.
- JWT con expiración configurable y validación de tokens.
- Refresh tokens almacenados mediante hash, con rotación y revocación.
- Validación de `JWT_SECRET` y configuración de CORS.
- Manejo de conflictos durante el registro y de tokens inválidos.
- Endpoints `POST /auth/login`, `POST /auth/refresh` y `POST /auth/logout` (el registro público `POST /auth/register` se cerró en el Sprint 2).
- Sustitución de endpoints de prueba inseguros por `/health`.

**Verificado con credenciales reales (2026-11-03):** inicio de sesión desde `login.html` con la cuenta `Coordinator` y "Recordarme" (refresh token con vencimiento a 30 días), y cierre de sesión (el refresh token queda revocado en `refresh_tokens`). La usuaria lo confirmó en el navegador y se comprobó en la BD.

Los permisos y las rutas protegidas se verificaron con pruebas automáticas en todos los módulos (ver sección F).

**Resuelto en el Sprint 2 (2026-11-24, ver sección E5):** renovación concurrente de refresh tokens, conservación de `remember_me` al rotar y token de acceso invalidado al cerrar sesión.

**Pendiente:**

- Comprobar la correspondencia entre el usuario del token y el registro persistido.

No se identificó un endpoint de recuperación de contraseña en el archivo de autenticación revisado.

### C. Usuarios y restablecimiento de contraseñas

**Estado: herramienta administrativa local existente.**

Se conserva `backend/app/reset_password.py` para futuros restablecimientos de contraseña.

- No eliminar el archivo automáticamente.
- No convertirlo en un endpoint de la API.
- Mantener su uso restringido al entorno local y a personas autorizadas.
- No guardar ni documentar contraseñas, tokens o secretos.
- Antes de utilizarlo, comprobar que la cuenta y la base de datos de destino sean las correctas.

**Comando de ejecución**, desde la raíz del proyecto, usando Fish:

```fish
cd ~/Documents/Proyecto_aroma_cacao/backend
set -x PYTHONPATH .
python app/reset_password.py
```

El procedimiento anterior de restablecimiento funcionó según lo confirmado por el usuario. No es necesario repetirlo ni modificar cuentas si no existe un problema concreto.

### D. Productos e inventario

**Estado: implementado y verificado.**

- Los esquemas de productos incorporan validaciones numéricas.
- `current_stock` no se modifica directamente mediante `ProductUpdate`.
- Los cambios de existencias deben realizarse mediante movimientos de inventario para conservar la trazabilidad.
- (2026-11-01) Los esquemas validan longitudes y rangos según las columnas de la BD: los datos fuera de rango devuelven `422` en lugar de `500`. Se agregaron `GET /categories` y `GET /units` (`backend/app/routers/catalogs.py`).
- Flujo documentado en `docs/flows/productos.md`.

Archivos principales:

- `backend/app/models/product.py`
- `backend/app/schemas/product.py`
- `backend/app/routers/products.py`

### E. Movimientos de inventario

**Estado: backend implementado y probado (47 pruebas locales); interfaz integrada; falta la prueba manual de escritura desde el navegador.**

**AC-53 (2026-11-12, implementación local pendiente de PR):** `POST /movements` rechaza con `400` los ajustes que repiten la combinación de producto y lote, incluidos productos sin lote. Acepta el mismo producto en lotes distintos y no limita las líneas repetidas en entradas o salidas. Once pruebas nuevas en `test_adjustment_duplicates.py`; suite local completa: **90 aprobadas**, Ruff sin errores. No requiere migración. Emma verificó manualmente el rechazo en `/docs` como Coordinator y confirmó en la web que el stock del producto y el lote siguen en 10 y no se creó una solicitud nueva. El frontend actual solo crea un detalle por solicitud (AC-52 pendiente).

Endpoints revisados:

- `GET /movements`: listado con filtros.
- `GET /movements/{movement_id}`: detalle.
- `POST /movements`: creación de solicitudes pendientes.
- `PATCH /movements/{movement_id}/authorize`: autorización y actualización del inventario.
- `PATCH /movements/{movement_id}/reject`: rechazo (`pending → rejected`), sin efecto en el stock. Agregado el 2026-11-01.

Reglas de negocio acordadas:

| Tipo de movimiento | Efecto al autorizar                       |
| ------------------ | ----------------------------------------- |
| `ENTRY`            | Suma existencias                          |
| `EXIT`             | Resta existencias si hay suficiente disponible (stock − prestado) |
| `ADJUSTMENT`       | Establece el stock en lo contado en bodega + lo prestado |

Decisiones confirmadas por la usuaria el 2026-11-01:

- Una salida que supera el stock **siempre se rechaza** (no hay autorización de emergencia; se descarta lo que planteaba el README).
- El motivo es **obligatorio** en `EXIT` y `ADJUSTMENT`.
- Se permite un `ADJUSTMENT` con cantidad 0.
- Existe un flujo de rechazo (estado `rejected`).

Cambio de esquema aplicado en la BD local: `database/migrations/001_movement_reject_and_zero_adjustment.sql` (`chk_movement_status` incluye `rejected`; `chk_movement_quantity` pasa a `>= 0`). `database/schema.sql` está actualizado. Si existe una BD en Render, hay que aplicarle la migración.

La creación de una solicitud no modifica el stock. La autorización aplica los cambios y actualiza el estado del movimiento.

La implementación revisada incluye validaciones de productos y lotes, bloqueo pesimista de filas y gestión de alertas dentro del flujo transaccional.

**Pendiente:**

- Prueba manual con datos reales de crear → autorizar y crear → rechazar: cubierta por `test_movements_flow.py` y por el navegador en modo sandbox, pero no ejecutada con datos persistentes.
- `EXIT` con lote no descuenta `lot.remaining_quantity`.
- Lotes y máquinas no tienen un campo de estado; no hay nada que validar mientras no exista.

Detalle completo en `docs/flows/movimientos-inventario.md`.

### E2. Usuarios, máquinas y préstamos

**Estado: implementado, probado y publicado en `main` (PR #3, 2026-11-03).**

- Usuarios: `GET/POST /users` y `PUT /users/{id}`, solo para `Coordinator`. Incluye protección contra el autobloqueo y revoca los refresh tokens al desactivar. Sin campo "Cargo". Detalle en `docs/flows/usuarios.md`.
- Máquinas: CRUD sin eliminación y repuestos compatibles (`product_machine`). La máquina destino se puede elegir en las salidas. Detalle en `docs/flows/maquinas.md`.
- Préstamos: `GET/POST /loans`, `PATCH /loans/{id}/return` y `GET /workers`. **No modifican `current_stock`**: disponible = stock − prestado. Los registran y devuelven `Operator` y `Coordinator` sin autorización. El trabajador se crea por nombre. Detalle en `docs/flows/prestamos.md`.
- Sin cambios de esquema: se mapearon las tablas existentes (`ProductMachine`, `Worker`, `Loan`).
- Pruebas: `backend/tests/test_users_machines_loans.py` (fixtures compartidos en `tests/conftest.py`). Total local: 59 pruebas aprobadas.
- **Decisión (2026-11-01):** un `EXIT` se valida contra lo disponible (stock − prestado), no contra `current_stock` (`backend/app/services/stock.py`).
- **Decisión (2026-11-03):** en un `ADJUSTMENT` se registra solo lo contado en bodega; al autorizarlo, `stock = contado + prestado`.

### E3. Proveedores y dashboard

**Estado: implementado, probado y publicado en `main` (PR #5, 2026-11-03).**

- Proveedores: `GET/POST /suppliers`, `PUT /suppliers/{id}` (sin eliminación) y productos por proveedor con precio de referencia (`POST/PATCH/DELETE /suppliers/{id}/products...`). Escritura solo para `Coordinator`. Detalle en `docs/flows/proveedores.md`.
- Dashboard con datos reales: productos activos, stock bajo (alertas activas), movimientos pendientes y herramientas prestadas, más la tabla de alertas y la lista de pendientes. La campana de la cabecera refleja las alertas activas. Se quitó el buscador decorativo de la cabecera del dashboard.
- Sin cambios de esquema (se mapearon `supplier` y `product_supplier`). Pruebas en `backend/tests/test_suppliers.py`. Total local: 64 pruebas aprobadas.
- Nota de publicación: la PR #4 se mergeó por error en `feature/users-machines-loans` (antes de que GitHub cambiara su base a `main`); su contenido llegó a `main` con la PR #5. Conviene evitar PRs apiladas.
- `test_inventory_limits.py` ya no escribe en la BD real (transacción revertida).

### E4. Lotes y vencimientos

**Estado: implementado y probado (2026-11-05); pendiente de publicar.**

- `product.requires_lot` (migración 002, aplicada en la BD local), endpoints `/lots` y `/products/{id}/lots`, movimientos que actualizan el lote, salidas y entradas de lotes vencidos bloqueadas y aviso a 30 días en el dashboard. Los productos con lotes no se prestan. Detalle en `docs/flows/lotes.md`.
- Pruebas en `backend/tests/test_lots.py`. Total local: 74 pruebas aprobadas.
- **Antes de desplegar:** si existe BD en Render, aplicar las migraciones 001 y 002 antes del merge; sin la 002, los endpoints de productos fallarán.

### E5. Sprint 2: Seguridad y Alembic

**Estado (2026-11-25): en `main` (PR #13) y desplegado en Render.**

- **Límite de intentos de login:** 5 fallos por correo en 15 minutos → bloqueo de 15 minutos con `429`; contador en la tabla `login_attempt` (`services/login_limit.py`). Decisión de la usuaria: 5/15 y en la BD.
- **Logout invalida el token de acceso:** tabla `revoked_access_token` (por `jti`), comprobada en `get_current_user`.
- **Renovación concurrente:** reproducida (dos `200` con el mismo refresh token) y corregida con `with_for_update()`; el frontend ya no cierra la sesión si otra pestaña renovó primero.
- **Recordarme:** pruebas de dos rotaciones con y sin la opción; pasaron sin cambios.
- **Registro público cerrado:** se quitó `POST /auth/register`. El primer Coordinator se crea con `backend/app/create_coordinator.py`.
- **Cambio de contraseña propio:** `POST /users/me/password` y sección «Cambiar contraseña» al final de Configuración para Coordinator y soporte; pantalla `/cuenta` para Operator y Read-only. Cierra las demás sesiones (decisión de la usuaria).
- **Al menos un Coordinator activo:** bloqueo de filas en `update_user`.
- **Alembic:** `backend/alembic/` con la revisión `0001` (copia congelada de `schema.sql`, que incluye la 001 y la 002), `0002` (`login_attempt`) y `0003` (`revoked_access_token`). Comprobado: una BD nueva queda igual a `schema.sql`; una existente se marca con `alembic stamp 0001` y sube a `0003`; `downgrade` y nuevo `upgrade` funcionan. `schema.sql` y `database/migrations/` se conservan como referencia (decisión de la usuaria).
- **Pruebas:** backend 97 aprobadas (+18), más `test_refresh_concurrency.py` (opcional, `RUN_CONCURRENCY_TESTS=1`, solo en una BD de pruebas); frontend 31 (+6). Probado en el navegador contra `aroma_test`: bloqueo del login, cambio de contraseña y token rechazado tras el logout.

**Antes de desplegar (obligatorio):** el login usa la tabla `login_attempt`, así que sin las migraciones el login falla con `500`. En cada BD existente (local y Render), una sola vez: `alembic stamp 0001` y luego `alembic upgrade head`. Conviene que el comando de inicio de Render ejecute `alembic upgrade head` antes de `uvicorn`.

### E6. Sprint 3: Configuración por empresa

**Estado (2026-11-25): en `main` (PR #14) y desplegado en Render. Probado contra `aroma_test` y en el navegador con Playwright. Las revisiones `0004`, `0005` y `0006` están aplicadas en la BD local y en la de Render, las dos configuradas como Aroma Cacao (USD, paleta verde y amarilla).**

- **Configuración de la empresa:** tabla `company_settings` de una sola fila (revisión `0004`), endpoints `/settings`, `/settings/public` y `/settings/logo`, y pantalla `/configuracion`.
- **Rol Soporte (revisión `0005`):** la marca, la moneda y los módulos solo los cambia el equipo de desarrollo, con su cuenta `Support`. La empresa no ve esas cuentas en Usuarios ni puede asignar el rol. El Coordinator solo cambia la autoaprobación (`/settings/rules`). Decisión de la usuaria del 2026-11-25. Detalle en `docs/flows/configuracion-empresa.md`.
- **Logo:** se sube como archivo y se guarda en la BD, hasta 200 KB (decisión de la usuaria). Sirve también de favicon (`/favicon.ico` en la API).
- **Colores:** el equipo de desarrollo elige el principal y el de acento; el resto del tema se calcula, también los fondos del tema oscuro, y se rechaza un contraste insuficiente (decisión de la usuaria).
- **Pestaña y etiqueta fiscal:** el título es «Sistema de mantenimiento · Aroma Cacao» y Proveedores usa la etiqueta fiscal configurada (RUC, NIT…).
- **Módulos:** Préstamos, Máquinas y Proveedores. Desactivado → `403` (decisión de la usuaria), oculto en el menú, datos conservados. No se puede desactivar Préstamos con herramientas prestadas.
- **Autoaprobación del Coordinator:** opcional y desactivada por defecto. Reutiliza `apply_authorization`. Si falla una validación, queda pendiente con el motivo.
- **Sin el nombre de Aroma Cacao en el código:** API «Bodega Inventory API», `/public/info` con el nombre configurado, `index.html` genérico, claves de sesión `bodega_*` (las `aroma_*` se migran sin cerrar sesión). Se borró `frontend/src/styles/tenants/`.
- **Contraseña propia (revisión `0006`, decisión de la usuaria del 2026-11-25):** cambio obligatorio de la contraseña inicial al primer ingreso y enlace de un solo uso, generado por el Coordinator, para recuperar una contraseña olvidada. El Coordinator nunca conoce la contraseña final de nadie.
- **Moneda y fecha:** `lib/format.ts` usa la configuración. Se quitó `es-EC` fijo y `USD` en Proveedores.
- **Instalación:** `backend/app/install.py` (migraciones, catálogos, nombre, primer Coordinator y cuenta de soporte), idempotente. Las cuentas de soporte también se crean con `app/create_support.py`; los scripts validan el correo como el login.
- **Pruebas:** backend 145 aprobadas (+48); frontend 51 (+20); build correcto. Flujos comprobados en el navegador con Playwright: configuración, módulos, autoaprobación, vistas de Coordinator y Soporte, primer ingreso y enlace de restablecimiento.

**Decidido (2026-11-27):** soporte es un rol aparte con su propio panel técnico y no ve la bodega (variante de la opción a: además administra usuarios). Ver E8.

**Despliegue en Render (2026-11-25):** el despliegue automático no se lanzaba desde la PR #11 (las PR #12, #13 y #14 no se desplegaron solas). Se desplegó a mano y se revisó la configuración de Auto-Deploy. Si vuelve a pasar, revisar en Render *Settings → Build & Deploy* que Auto-Deploy esté activo y que la rama sea `main`.

**Antes de usar Configuración:** cada integrante del equipo crea su cuenta de soporte con `python app/create_support.py`, en la BD local y en la de Render. Las rutas `/settings` ya están en `vite.config.ts` y `vercel.json`.

### E7. Sprint 4: Infraestructura y despliegue

**Estado (2026-11-25): mergeado en `main` (PR #16).** Los secretos de las copias están configurados y la primera copia manual terminó bien. La elección del hosting está pendiente del equipo, y de ella dependen la BD de producción y publicar el frontend.

- **CORS por variable de entorno:** `CORS_ORIGINS`, separada por comas, con los orígenes locales por defecto. Rechaza `*` y dominios sin `https://`.
- **Registros:** `backend/app/logging_config.py`. Los errores no controlados se registran con su ruta y su traza, y el cliente recibe un `500` genérico. Un filtro tapa contraseñas, tokens y credenciales de URL, también en uvicorn y en las trazas.
- **`/health` comprueba la BD** (decisión de la usuaria): `503` si no responde en 2 segundos. Monitor externo: UptimeRobot gratis (decisión de la usuaria). Ver `docs/operacion/monitoreo.md`.
- **CI:** el mismo trabajo `validate` ahora levanta PostgreSQL 17, crea las tablas con `alembic upgrade head`, ejecuta todo `pytest` y corre las pruebas y el build del frontend (Node 22). No hubo que cambiar la protección de `main`.
- **Copias de seguridad** (decisión de la usuaria: diaria, 30 días): flujo `.github/workflows/backup.yml` con `ops/backup/backup.sh`. El repositorio es público, así que las copias se guardan **cifradas con AES-256**. La restauración (`ops/backup/restore.sh`, solo en una BD vacía) se probó con éxito. Falta configurar los secretos. Ver `docs/operacion/copias-de-seguridad.md`.
- **Guía de instalación:** `docs/instalacion.md`. El instalador se probó desde cero dos veces.
- **El primer Coordinator creado por consola** también debe elegir su propia contraseña al entrar.
- **Hosting:** comparación con precios oficiales en `docs/decisions/002-hosting.md` (propuesta; decide el equipo). **Vercel Hobby no se puede usar con clientes que pagan.**
- **Limpieza:** se borró `docs/contexto_proyecto.md.bak` (aprobado por la usuaria). Los demás archivos de la lista y las ramas viejas ya no existían.
- **Pruebas:** backend 173 aprobadas, también en una BD creada solo con Alembic como en el CI; frontend 51.

### E8. Sprint 5: Datos, pruebas y salida a producción

**Estado (2026-11-25): en curso, en la rama `feature/sprint-5`, sin commit.** Los datos actuales de la BD local se conservan para las presentaciones: la tarea «Limpiar los datos de prueba» queda para cuando lleguen los datos reales (decisión de la usuaria).

- **Índice único de alertas activas:** migración 0007, aplicada en la BD local y en `aroma_test` (copia previa en `~/aroma-cacao-respaldos/`). Ver `docs/flows/alertas-stock.md`.
- **Pruebas de concurrencia:** `test_stock_concurrency.py`, seis casos que fallan sin los bloqueos o sin el índice y pasan con el código actual. En el CI corren siempre. Ver `docs/flows/movimientos-inventario.md`, «Operaciones simultáneas».
- **Importador de inventario** (decisiones de la usuaria): Excel y CSV; el stock inicial se registra como una entrada autorizada «Carga inicial»; los lotes van en la hoja de stock, una fila por lote; si un producto, máquina o proveedor ya existe, la vista previa lo advierte y el usuario decide si actualizarlo o dejarlo como está. Pantalla `/productos/importar` (solo Coordinador), probada en el navegador contra `aroma_test`. Nueva dependencia: `openpyxl`. Ver `docs/flows/importar-inventario.md`.
- **Exportar a Excel o CSV** (pedido y decisiones de la usuaria): el inventario completo (mismo formato que la plantilla de importación) y el historial de movimientos con filtros, desde una sola pantalla `/exportar`, para todos los roles. Ver `docs/flows/exportar.md`.
- **Guía de uso por rol:** `docs/guia-uso.md`, para el personal y en lenguaje sencillo. Cada paso se comprobó en el navegador contra `aroma_test` con los tres roles (2026-11-25).
- **Pruebas:** backend 202 aprobadas (más 7 que solo corren con `RUN_CONCURRENCY_TESTS=1`; en el CI corren todas: 209); frontend 58.

**Ajustes pedidos por el profesor (2026-11-27), rama `feature/sprint-5-ajustes`.** La PR #18 ya está mergeada.
- **Contraseñas sin depender del coordinador:** cada persona recibe un **código de recuperación** de un solo uso y recupera su contraseña sola desde el login. El coordinador conserva **Resetear contraseña** como respaldo, que entrega a la vez una contraseña temporal de un solo ingreso y un enlace. Migración `0008` (aplicada en la BD local, con copia previa `~/aroma-cacao-respaldos/aroma_inventory_antes_0008.sql`, y en `aroma_test`). Ver `docs/flows/usuarios.md`.
- **Soporte como rol aparte con su propia interfaz:** su panel técnico, más Usuarios y Configuración. No ve la bodega (el backend responde `403`). Ver `docs/flows/configuracion-empresa.md`.
- **Ayuda contextual:** ícono (i) junto a los campos difíciles. Al pulsarlo explica el campo, y funciona igual en el celular. Está en el componente `Field` (prop `info`) y en `InfoTip`.
- **Pruebas:** backend 225 (más las de concurrencia); frontend 63. Se comprobó en el navegador contra `aroma_test`, a 1366 y 390 px: soporte, el reseteo del coordinador, el primer ingreso con código, la recuperación desde el login, el código ya usado (rechazado) y la ayuda (i).

### F. Roles y permisos

Las reglas acordadas para los movimientos son:

| Rol           | Crear solicitudes | Autorizar | Consultar        |
| ------------- | ----------------- | --------- | ---------------- |
| `Operator`    | Sí                | No        | Si               |
| `Coordinator` | Sí                | Sí        | Sí               |
| `Read-only`   | No                | No        | Sí, solo lectura |

Un `Coordinator` puede autorizar una solicitud creada por él mismo.

**Importante:** `Read-only` debe tener permisos estrictamente de solo lectura. Las restricciones deben aplicarse en el backend, no únicamente ocultando botones en el frontend.

Verificado el 2026-11-01 en productos, movimientos, catálogos, usuarios, máquinas y préstamos (`test_movements_flow.py`, `test_users_machines_loans.py`): `Read-only` recibe `403` en todas las operaciones de escritura.

| Módulo | Coordinator | Operator | Read-only |
|---|---|---|---|
| Productos, máquinas, proveedores (escritura) | Sí | No | No |
| Usuarios (listar y escribir) | Sí | No | No |
| Préstamos y devoluciones | Sí | Sí | No |
| Consultas (productos, movimientos, máquinas, préstamos, proveedores, dashboard) | Sí | Sí | Sí |

**`Support` (Sprint 3; rol aparte desde el 2026-11-27):** la cuenta del equipo de desarrollo, con su propio **panel técnico**. Cambia la configuración de la instalación (marca, moneda, módulos) y administra usuarios (crear, editar, desactivar, resetear contraseñas). **No ve los datos de la bodega** (`403`). Tampoco crea, autoriza ni presta. La empresa no la ve en Usuarios ni puede asignar ese rol. Ver `docs/flows/configuracion-empresa.md`.

### G. Alertas de stock mínimo

**Estado: implementada y verificada.**

Se ha centralizado la lógica de gestión de alertas en un servicio dedicado (`backend/app/services/alerts.py`), asegurando que las reglas de negocio se apliquen consistentemente en todo el sistema.

**Reglas de negocio implementadas:**
- **Disparo:** Se crea una única alerta `active` cuando un producto activo tiene `current_stock <= minimum_stock`.
- **Consolidación:** Si existen múltiples alertas activas, se conserva la más reciente y las demás se marcan como `resolved`.
- **Resolución:** Todas las alertas activas se marcan como `resolved` si el stock supera el mínimo o si el producto es desactivado.
- **Trazabilidad:** Se conserva el historial de alertas mediante el cambio de estado.

**Integración:**
La lógica está integrada transaccionalmente en:
- `POST /products`: Evaluación del stock inicial al crear el producto.
- `PUT /products/{id}`: Sincronización de alertas al modificar el `minimum_stock`.
- `DELETE /products/{id}`: Resolución de alertas al desactivar el producto.
- `PATCH /movements/{id}/authorize`: Actualización de alertas tras mutar el stock.

**Verificación:**
- Ocho casos funcionales (A-H) aprobados en PostgreSQL 17 (`aroma_inventory`), incluyendo la validación de rollback transaccional.
- Desde la migración 0007 (Sprint 5), un índice único parcial impide dos alertas activas del mismo producto, también con transacciones simultáneas.
- Corrección posterior (Workshop 6): en el modelo `Alert`, `date_generated` usaba `server_default="CURRENT_TIMESTAMP"` como cadena literal; se cambió a `server_default=func.now()` y se eliminó el parche de `Alert.date_generated.default` en `backend/tests/test_alerts.py`. Las 8 pruebas de alertas pasan localmente y en CI.

El flujo detallado se encuentra documentado en `docs/flows/alertas-stock.md`.

### H. Frontend

**Estado (2026-11-10): frontend reescrito con el diseño «Bodega»; compila, pasa 25 pruebas y se revisó en el navegador a 1280 y 390 con datos reales (solo lectura). Pendiente de publicar y de probar las escrituras desde el navegador.**

El frontend anterior (páginas HTML sueltas con JSX) se reemplazó por una aplicación de una sola página en React 19 + TypeScript, con React Router y TanStack Query, construida a partir del kit de diseño de Claude Design (`docs/design/bodega-kit/`). Detalle en `docs/architecture/frontend.md`.

- Rama `feature/frontend-bodega`, creada desde `feature/lots-expiration` porque necesita los lotes. Al unirla, la PR #8 debe ir primero.
- 30 componentes propios (`frontend/src/components/ui/`), sin librerías de componentes. Dos temas (claro y oscuro) y marca por empresa calculada desde la configuración (`src/lib/company.ts`).
- 16 pantallas: inicio, productos (lista, formulario, lotes), movimientos (lista, nueva, revisión/detalle), préstamos, máquinas (lista y detalle), proveedores (lista y detalle), usuarios, «Más» para móvil y `/dev/componentes` en desarrollo.
- Permisos con `RoleGate`/`can()`: lo que el rol no puede hacer no se muestra. Pendiente siempre lleva borde discontinuo y «No aplicado al stock»; autorizar y rechazar confirman con cifras.
- Errores del backend traducidos en `src/lib/errors.ts` (por ejemplo, «La salida supera lo disponible» con código `STOCK_INSUFICIENTE · 400`).
- Pruebas (Vitest): `can()`, Solo lectura sin botones de escritura, Pendiente dice «No aplicado al stock», motivo obligatorio en salidas y ajustes, salida bloqueada por encima de lo disponible y mapa de errores. `npm run build` correcto el 2026-11-10.
- Sin cambios en el backend ni en la base de datos. `vite.config.ts` conserva el proxy; `npm run dev` abre `/login`.

**Pendiente:**

- Probar las escrituras desde el navegador (crear, autorizar, rechazar, prestar, devolver, editar) con el backend real; hasta ahora solo lectura y pruebas unitarias.
- Rechazo con motivo: el diseño lo pide y el backend no lo guarda (`PATCH /movements/{id}/reject` sin cuerpo). Requiere un campo nuevo en `movement`.
- Varios productos por solicitud desde la pantalla (Sprint 1); el detalle ya los muestra.
- Reactivar producto depende de la PR #9 (AC-7).
- Renovación automática del token de acceso observada en uso real.
- El frontend sigue fuera del CI y sin publicar (Sprint 4).

### I. Pruebas automatizadas, CI/CD y despliegue (Workshop 6)

**Estado: implementado, verificado en GitHub Actions y desplegado en Render (solo backend).**

Realizado en la rama `feature/health-endpoint`, integrada en `main` mediante el PR #1 ([enlace](https://github.com/adrianasofiaespinoza/Proyecto_Aroma_Cacao/pull/1)).

**Endpoint de salud:**

- `GET /health` en `backend/app/main.py`, devuelve `{"status": "ok"}`. No depende de la base de datos ni de la autenticación.
- Prueba en `backend/tests/test_health.py`.

**Integración continua** (`.github/workflows/ci.yml`, job `validate`):

- Se ejecuta en pull requests hacia `main` y en pushes a `main`.
- Ubuntu, Python 3.12 con caché de pip, `working-directory: backend`.
- Pasos: instalar `requirements.txt`, instalar `ruff==0.9.2 pytest httpx`, `ruff check .` y `pytest -v tests/test_health.py tests/test_alerts.py` (9 pruebas).
- `DATABASE_URL` y `JWT_SECRET` se definen en el workflow con valores ficticios, solo para CI, porque la aplicación falla al importar si no existen. No se publicaron credenciales reales.
- `backend/ruff.toml`: conjunto mínimo de reglas (`E9`, `F63`, `F7`, `F82`).
- `backend/pytest.ini`: `pythonpath = .` para importar el paquete `app`.

**Verificación realizada:**

- Primer CI en verde (run #6), tras corregir los fallos iniciales de configuración (Ruff sin configurar, `ModuleNotFoundError: app`, variables de entorno faltantes y el `server_default` del modelo `Alert`).
- Fallo intencional de lint (`F821`, run #7) y de prueba (`AssertionError`, run #9), ambos detectados por CI y revertidos (runs #8 y #10 en verde).
- Tras el merge, CI en `main` aprobado (run #11, commit `50df7a9`).

**Protección de la rama `main`:**

- Requiere pull request antes del merge (con una aprobación), el check `validate` en verde y la rama actualizada.
- El repositorio tiene una sola cuenta propietaria, por lo que el PR #1 fue integrado por la propietaria sin un segundo revisor.

**Despliegue en Render** (plan gratuito):

- URL pública: [https://aroma-cacao.onrender.com](https://aroma-cacao.onrender.com) (`/health` responde `{"status":"ok"}`).
- Rama `main`, directorio raíz `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, `PYTHON_VERSION=3.12.8`.
- `JWT_SECRET` y `DATABASE_URL` configurados como variables de entorno en Render, no en el repositorio.
- Auto-Deploy: "After CI Checks Pass".
- El primer despliegue falló porque `JWT_SECRET` tenía menos de 32 caracteres; se corrigió generando un secreto nuevo en Render, sin cambios de código. Un despliegue manual del mismo commit quedó en estado Live.

**Limitaciones y pendientes:**

- `test_inventory_limits.py` no se ejecuta en CI porque requiere PostgreSQL; se podría agregar un servicio PostgreSQL al workflow.
- Ruff usa un conjunto mínimo de reglas; el código existente tiene otros hallazgos (por ejemplo, `E402` y `F401`) sin corregir.
- Pendiente de confirmar: en el informe no se confirmó si se aprovisionó PostgreSQL en Render. Si no existe, solo están garantizados el arranque y `/health`, y los endpoints que dependen de la base de datos no funcionarán en el despliegue público.
- El plan gratuito de Render suspende la instancia por inactividad; la primera solicitud puede tardar cerca de un minuto.
- El frontend no está cubierto por el pipeline de CI.
- Desarrollo local con Python 3.14; CI y Render usan Python 3.12.

**Implicaciones para el trabajo:** los cambios a `main` deben pasar por pull request con el check `validate` en verde. Antes de publicar, ejecutar localmente `ruff check .` y las pruebas incluidas en CI desde `backend/`. Todo merge a `main` se despliega automáticamente en Render tras pasar CI.

## 4. Reglas de trabajo y continuidad

Estas reglas son obligatorias para cualquier IA que continúe el proyecto.

1. **No comenzar desde cero.** Usar este contexto como punto de partida y consultar únicamente los archivos necesarios para la tarea actual.
2. **No repetir verificaciones iniciales** que ya están confirmadas, salvo que exista un problema, un cambio relevante o una duda concreta.
3. **Conservar los cambios locales.** Antes de intervenir, revisar `git status -sb` y los diffs pertinentes. No sobrescribir, descartar ni restaurar cambios locales sin autorización.
4. **Ciclo de implementación y publicación:** seguir este proceso para cada implementación o bloque coherente del sistema:
   1. Implementar la funcionalidad acordada.
   2. Verificar su comportamiento y ejecutar las pruebas pertinentes.
   3. Documentar el flujo y actualizar el estado real del proyecto.
   4. Revisar Git para identificar los archivos que corresponden a esa implementación y evitar incluir cambios ajenos.
   5. Preparar un commit con un mensaje descriptivo, revisando previamente los cambios que contendrá.
   6. Explicar qué archivos y cambios se publicarán, verificar que no se incluyan secretos ni cambios ajenos al bloque y solicitar autorización expresa antes de ejecutar `git push`.
   **Regla de publicación:** el ciclo incluye preparar el avance para publicarlo en GitHub, pero `git push` solo se ejecutará después de revisar su contenido y recibir la autorización expresa del usuario. Nunca publicar automáticamente ni incluir cambios locales pendientes que no correspondan a la implementación acordada.
5. **No confundir estados.** Diferenciar código implementado, comportamiento probado y aspectos pendientes de verificar.
6. **Proteger los datos.** No ejecutar operaciones destructivas sobre archivos o PostgreSQL ni cambiar el esquema sin analizar el impacto y obtener autorización cuando corresponda.
7. **Proponer antes de modificar.** Explicar el problema, la solución propuesta y su justificación antes de realizar cambios importantes.
8. **Trabajar con Fish.** Proporcionar comandos compatibles con CachyOS y la terminal Fish.
9. **Actualizar el contexto.** Al finalizar cada bloque importante, resumir los cambios, pruebas, resultados y tareas pendientes, sin convertir el contexto en un historial completo de Git.
10. **Consultar el repositorio para el historial.** No duplicar en este documento listas extensas de commits o archivos publicados. El repositorio y Git permiten consultar esa información.

## 5. Visión: sistema configurable para distintas empresas

Aroma Cacao es la primera empresa donde se desarrolla y valida el sistema. El objetivo es construir una solución reutilizable, adaptable y mantenible, evitando acoplarla innecesariamente a los nombres, catálogos, procesos o reglas particulares de una sola empresa.

La configurabilidad es un objetivo de diseño, no una afirmación de que todas esas opciones ya estén implementadas.

Se deben evaluar progresivamente opciones como:

- Identidad visual y datos generales de la empresa.
- Categorías, unidades de medida y otros catálogos.
- Umbrales de stock y reglas de alertas.
- Roles y permisos, sin debilitar los controles de seguridad.
- Flujos de aprobación y funciones habilitadas.
- Preferencias de presentación y campos específicos, cuando exista una necesidad real.

No convertir cada regla en una opción configurable sin justificación. Primero hay que entender el negocio, distinguir las reglas comunes de las variables y elegir la solución mínima mantenible.

**Decisión tomada el 2026-11-03:** una instalación por empresa, con configuración por empresa (nombre, marca, moneda, catálogos editables, módulos activables) y un script de instalación. No se usa `company_id`. Detalle en `docs/decisions/001-una-instalacion-por-empresa.md`. El plan hasta producción está en `docs/plan/` (backlog para Jira y guía).

**No asumir que existe una arquitectura multiempresa.** Antes de incorporar `company_id`, tablas nuevas o filtros multi-tenant, decidir si el sistema tendrá instalaciones independientes por empresa o varias empresas aisladas dentro de una misma instalación. Cualquier decisión debe documentarse y considerar el aislamiento de datos, los permisos, las migraciones y las pruebas.

## 6. Documentación obligatoria de los flujos

Los flujos importantes deben documentarse antes o durante su implementación y actualizarse cuando cambie el comportamiento.

Cada documento debe describir, según corresponda:

- Objetivo, alcance y actores.
- Permisos y precondiciones.
- Flujo principal, estados y transiciones.
- Validaciones, errores y alternativas.
- Reglas de negocio y datos afectados.
- Endpoints, solicitudes, respuestas y códigos HTTP.
- Comportamiento de la interfaz.
- Seguridad, trazabilidad y efectos sobre el inventario.
- Opciones configurables y reglas fijas.
- Pruebas y criterios de aceptación.

Flujos prioritarios:

- Autenticación, renovación y revocación de tokens.
- Gestión de usuarios, roles y permisos.
- Creación, edición y desactivación de productos.
- Entradas, salidas, ajustes y autorización de movimientos.
- Alertas de stock mínimo.
- Préstamos y devoluciones.
- Proveedores y relaciones con productos.
- Configuración de una empresa y sus catálogos.

Antes de crear archivos, revisar la documentación existente. Usar `docs/flows/` para los flujos, `docs/architecture/` para la arquitectura, `docs/configuration.md` para la configuración y `docs/decisions/` para las decisiones técnicas, siempre que esa estructura encaje con los archivos ya existentes.

No documentar como implementado algo que solo está propuesto. Distinguir comportamiento observado, regla acordada, prueba ejecutada y mejora pendiente.

## 7. Prioridad inmediata

**Prioridad actual: avanzar con la integración funcional del frontend y el backend.**

El plan de trabajo se establece en el siguiente orden:

> Actualización 2026-11-01: los pasos 1 a 3 están implementados en todas las vistas (productos, movimientos, usuarios, máquinas, préstamos, proveedores y dashboard). Del paso 4, con credenciales reales se verificaron el inicio de sesión, "Recordarme" y el cierre de sesión (2026-11-03); los flujos de escritura están verificados con pruebas automáticas y en el navegador en modo sandbox. Todo está publicado en `main` (PRs #2, #3 y #5).

1. **Productos e inventario (paso D):** revisar las validaciones de productos, la protección de `current_stock`, las reglas de stock mínimo y su coherencia con los movimientos. Identificar los casos pendientes y corregir únicamente los problemas confirmados.
2. **Movimientos de inventario:** verificar entradas, salidas, ajustes, solicitudes pendientes, autorización, persistencia, errores y permisos. Mantener las reglas de negocio acordadas y señalar las decisiones que necesiten confirmación.
3. **Integración frontend-backend:** completar y probar las vistas de productos y movimientos utilizando los endpoints existentes. Después continuar con usuarios, máquinas y préstamos, respetando las prioridades y los requisitos originales.
4. **Validación integral:** probar desde el navegador hasta PostgreSQL los flujos implementados, incluidos autenticación, rutas protegidas, permisos por rol, mensajes de error y actualización del inventario.

**Estado actual y restricciones:**
- Las alertas de stock mínimo están implementadas y cuentan con ocho pruebas funcionales reportadas como aprobadas en PostgreSQL 17.
- La integración del frontend y backend es parcial y todavía necesita pruebas funcionales.
- La autenticación tiene verificaciones de integración y casos límite pendientes, pero no constituye una razón para iniciar ahora una auditoría independiente.
- No se debe repetir la configuración inicial de PostgreSQL ni las verificaciones ya confirmadas, salvo que aparezca un problema concreto.
- El pipeline de CI (GitHub Actions) y el despliegue en Render del Workshop 6 ya están implementados y verificados. Mantenerlos funcionando, pero no ampliarlos salvo que se solicite.
- El objetivo sigue siendo completar el sistema de inventario de Aroma Cacao; no ampliar el alcance hacia DevOps, multiempresa ni nuevas funcionalidades no solicitadas.

## 8. Criterio para dar por terminado un bloque

Para cada funcionalidad importante:

1. Revisar el comportamiento actual.
2. Confirmar las reglas de negocio.
3. Proponer e implementar cambios acotados tras la autorización correspondiente.
4. Ejecutar pruebas pertinentes y documentar sus resultados reales.
5. Actualizar el documento del flujo.
6. Revisar los cambios locales y su estado en Git.
7. Preparar un commit únicamente con autorización.
8. Solicitar autorización expresa antes de publicar en GitHub.
