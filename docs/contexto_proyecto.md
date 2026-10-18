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

Archivos principales:

- `backend/app/models/product.py`
- `backend/app/schemas/product.py`
- `backend/app/routers/products.py`

### E. Movimientos de inventario

**Estado: lógica de backend implementada y parcialmente probada con la base de datos local.**

Endpoints revisados:

- `GET /movements`: listado con filtros.
- `GET /movements/{movement_id}`: detalle.
- `POST /movements`: creación de solicitudes pendientes.
- `PATCH /movements/{movement_id}/authorize`: autorización y actualización del inventario.

Reglas de negocio acordadas:

| Tipo de movimiento | Efecto al autorizar                       |
| ------------------ | ----------------------------------------- |
| `ENTRY`            | Suma existencias                          |
| `EXIT`             | Resta existencias si hay suficiente stock |
| `ADJUSTMENT`       | Establece el stock final indicado         |

La creación de una solicitud no modifica el stock. La autorización aplica los cambios y actualiza el estado del movimiento.

La implementación revisada incluye validaciones de productos y lotes, bloqueo pesimista de filas y gestión de alertas dentro del flujo transaccional.

**Pendiente:**

- Verificar el flujo completo desde la interfaz hasta la persistencia.
- Probar errores, permisos y operaciones concurrentes.
- Confirmar que todas las rutas respeten las mismas reglas de inventario.
- Determinar si los ajustes de stock con cantidad cero deben permitirse.
- Revisar la validación del estado de lotes y máquinas.

### F. Roles y permisos

Las reglas acordadas para los movimientos son:

| Rol           | Crear solicitudes | Autorizar | Consultar        |
| ------------- | ----------------- | --------- | ---------------- |
| `Operator`    | Sí                | No        | Si               |
| `Coordinator` | Sí                | Sí        | Sí               |
| `Read-only`   | No                | No        | Sí, solo lectura |

Un `Coordinator` puede autorizar una solicitud creada por él mismo.

**Importante:** `Read-only` debe tener permisos estrictamente de solo lectura. Las restricciones deben aplicarse en el backend, no únicamente ocultando botones en el frontend.

La implementación efectiva de los permisos en todas las rutas todavía debe verificarse.

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

El flujo detallado se encuentra documentado en `docs/flows/alertas-stock.md`.

### H. Frontend

**Estado: integración parcial implementada; quedan flujos por verificar.**

Se han implementado o revisado:

- Inicio de sesión en `frontend/login.html`, con lógica en `frontend/src/login.js`.
- Cliente API centralizado en `frontend/src/services/api.js`.
- Envío automático de Bearer Token y mecanismo de renovación ante respuestas HTTP 401.
- Proxy de Vite para las rutas del backend.
- Control de sesión en `frontend/src/main.js`.
- Consulta de productos en `ProductTable.jsx`, con estados de carga y manejo de errores.

La compilación de producción terminó correctamente en una verificación anterior. Debe repetirse después de cambios que puedan afectarla.

**Pendiente:**

- Integrar y verificar las vistas de movimientos, usuarios, máquinas y préstamos.
- Comprobar el inicio de sesión y las rutas protegidas desde el navegador.
- Verificar la autorización por rol tanto en frontend como en backend.
- Comprobar los estados de carga, los mensajes de error y la renovación de sesión.

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