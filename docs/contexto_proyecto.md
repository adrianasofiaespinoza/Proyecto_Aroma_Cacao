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
| React 19                | Interfaz de usuario                   |
| Vite 8                  | Desarrollo y compilación del frontend |
| Tailwind CSS v4         | Estilos y diseño adaptable            |
| Bootstrap Icons         | Iconografía                           |
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
- Endpoints `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` y `POST /auth/logout`.
- Sustitución de endpoints de prueba inseguros por `/health`.

**Pendiente:**

- Verificar la integración completa entre frontend y backend.
- Revisar la renovación concurrente de refresh tokens.
- Comprobar la correspondencia entre el usuario del token y el registro persistido.
- Verificar la conservación de `remember_me` durante la rotación.
- Confirmar el comportamiento de los tokens de acceso después del cierre de sesión.
- Revisar los permisos y las rutas protegidas.

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
| `EXIT`             | Resta existencias si hay suficiente stock |
| `ADJUSTMENT`       | Establece el stock final indicado         |

Decisiones confirmadas por la usuaria el 2026-11-01:

- Una salida que supera el stock **siempre se rechaza** (no hay autorización de emergencia; se descarta lo que planteaba el README).
- El motivo es **obligatorio** en `EXIT` y `ADJUSTMENT`.
- Se permite un `ADJUSTMENT` con cantidad 0.
- Existe un flujo de rechazo (estado `rejected`).

Cambio de esquema aplicado en la BD local: `database/migrations/001_movement_reject_and_zero_adjustment.sql` (`chk_movement_status` incluye `rejected`; `chk_movement_quantity` pasa a `>= 0`). `database/schema.sql` está actualizado. Si existe una BD en Render, hay que aplicarle la migración.

La creación de una solicitud no modifica el stock. La autorización aplica los cambios y actualiza el estado del movimiento.

La implementación revisada incluye validaciones de productos y lotes, bloqueo pesimista de filas y gestión de alertas dentro del flujo transaccional.

**Pendiente:**

- Probar manualmente en el navegador, con credenciales reales, crear → autorizar y crear → rechazar. Ya están cubiertos por `test_movements_flow.py`.
- Probar la concurrencia real (el bloqueo pesimista está implementado, pero no se ha probado con transacciones simultáneas).
- `EXIT` con lote no descuenta `lot.remaining_quantity`.
- Lotes y máquinas no tienen un campo de estado; no hay nada que validar mientras no exista.

Detalle completo en `docs/flows/movimientos-inventario.md`.

### E2. Usuarios, máquinas y préstamos

**Estado: backend e interfaz implementados y probados (2026-11-01); pendiente de publicar.**

- Usuarios: `GET/POST /users` y `PUT /users/{id}`, solo para `Coordinator`. Incluye protección contra el autobloqueo y revoca los refresh tokens al desactivar. Sin campo "Cargo". Detalle en `docs/flows/usuarios.md`.
- Máquinas: CRUD sin eliminación y repuestos compatibles (`product_machine`). La máquina destino se puede elegir en las salidas. Detalle en `docs/flows/maquinas.md`.
- Préstamos: `GET/POST /loans`, `PATCH /loans/{id}/return` y `GET /workers`. **No modifican `current_stock`**: disponible = stock − prestado. Los registran y devuelven `Operator` y `Coordinator` sin autorización. El trabajador se crea por nombre. Detalle en `docs/flows/prestamos.md`.
- Sin cambios de esquema: se mapearon las tablas existentes (`ProductMachine`, `Worker`, `Loan`).
- Pruebas: `backend/tests/test_users_machines_loans.py` (fixtures compartidos en `tests/conftest.py`). Total local: 59 pruebas aprobadas.
- **Decisión abierta:** ¿un `EXIT` debe validarse contra la cantidad disponible (stock − prestado) en lugar de contra `current_stock`?

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
| Productos, máquinas (escritura) | Sí | No | No |
| Usuarios (listar y escribir) | Sí | No | No |
| Préstamos y devoluciones | Sí | Sí | No |
| Consultas (productos, movimientos, máquinas, préstamos) | Sí | Sí | Sí |

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
- Limitación: la prevención de duplicados bajo concurrencia extrema depende de la serialización de transacciones (no existe restricción `UNIQUE` en la base de datos).
- Corrección posterior (Workshop 6): en el modelo `Alert`, `date_generated` usaba `server_default="CURRENT_TIMESTAMP"` como cadena literal; se cambió a `server_default=func.now()` y se eliminó el parche de `Alert.date_generated.default` en `backend/tests/test_alerts.py`. Las 8 pruebas de alertas pasan localmente y en CI.

El flujo detallado se encuentra documentado en `docs/flows/alertas-stock.md`.

### H. Frontend

**Estado: productos y movimientos integrados con la API y verificados en el navegador (lectura y validaciones); quedan los demás módulos.**

Se han implementado o revisado:

- Inicio de sesión en `frontend/login.html`, con lógica en `frontend/src/login.js`.
- Cliente API centralizado en `frontend/src/services/api.js`.
- Envío automático de Bearer Token y mecanismo de renovación ante respuestas HTTP 401.
- Proxy de Vite para las rutas del backend.
- Control de sesión en `frontend/src/main.js`.
- Consulta de productos en `ProductTable.jsx`, con estados de carga y manejo de errores.
- (2026-11-01) `ProductsPage.jsx` y `ProductFormModal.jsx`: búsqueda, filtros, creación, edición y desactivación según el rol.
- (2026-11-01) `MovementsPage.jsx`: listado con filtros, nueva solicitud, revisión con autorización o rechazo y detalle de solo lectura.
- (2026-11-01) `api.js`: errores `422` legibles, y las peticiones en espera ya no quedan colgadas si falla la renovación del token.
- (2026-11-01) La cabecera de todas las páginas muestra el usuario real (antes mostraba "Carlos Mena" fijo).
- La compilación de producción (`npm run build`) terminó correctamente el 2026-11-01.

La compilación de producción terminó correctamente en una verificación anterior. Debe repetirse después de cambios que puedan afectarla.

**Pendiente:**

- (2026-11-01) Usuarios, máquinas y préstamos integrados (`UsersPage.jsx`, `MachinesPage.jsx`, `LoansPage.jsx`). Escrituras verificadas en el navegador con el backend en modo sandbox (transacción revertida; la BD quedó sin cambios).
- Pendiente: proveedores y dashboard (siguen con datos de ejemplo; faltan endpoints de proveedores).
- Comprobar el inicio de sesión real y la renovación de sesión desde el navegador (requiere credenciales reales).
- `favicon.ico` devuelve `404` (las páginas no enlazan `public/favicon.svg`).

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

> Actualización 2026-11-01: los pasos 1 a 3 están implementados (productos, movimientos, usuarios, máquinas y préstamos). Quedan proveedores y dashboard, y el paso 4 con credenciales reales (inicio de sesión, renovación y prueba manual).

1. **Productos e inventario (paso D):** revisar las validaciones de productos, la protección de `current_stock`, las reglas de stock mínimo y su coherencia con los movimientos. Identificar los casos pendientes y corregir únicamente los problemas confirmados.
2. **Movimientos de inventario:** verificar entradas, salidas, ajustes, solicitudes pendientes, autorización, persistencia, errores y permisos. Mantener las reglas de negocio acordadas y señalar las decisiones que necesiten confirmación.
3. **Integración frontend-backend:** completar y probar las vistas de productos y movimientos utilizando los endpoints existentes. Después continuar con usuarios, máquinas y préstamos, respetando las prioridades y los requisitos originales.
4. **Validación integral:** probar desde el navegador hasta PostgreSQL los flujos implementados, incluidos autenticación, rutas protegidas, permisos por rol, mensajes de error y actualización del inventario.

**Estado actual y restricciones:**
- Las alertas de stock mínimo están implementadas y cuentan con ocho pruebas funcionales reportadas como aprobadas en PostgreSQL 17.
- La concurrencia de las alertas sigue siendo una limitación pendiente.
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