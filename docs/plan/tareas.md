# Descripción de las tareas

Para: **Adriana, Tamya y Emma**, y para la herramienta de IA que usen. Describe cada tarjeta pendiente de Jira. El nombre de cada tarea coincide con el de su tarjeta; el reparto está en `docs/plan/asignacion.md`.

Estas descripciones se escribieron al preparar el plan. Los números de línea y los detalles del código pueden cambiar: compruébalos antes de confiar en ellos.

**Por confirmar** marca una propuesta que aún nadie ha decidido. Confírmala con el equipo antes de programarla.

## Todas las tareas están listas cuando

- Tienen pruebas automáticas en verde: `ruff check .` y `pytest` en `backend/`.
- `npm run build` funciona, si se tocó el frontend.
- Se probaron en el navegador con los roles afectados, si tienen pantalla.
- El flujo está documentado en `docs/flows/` o en el documento que indique la tarea.
- La PR está revisada, con el CI en verde y mergeada a `main`.

Los permisos siempre se aplican en el backend. Cualquier cambio en la base de datos lleva una migración acordada con el equipo: en `database/migrations/` hasta que exista Alembic y con Alembic después.

## Ya hechas, pendientes de merge

Rama `feature/lots-expiration`: registrar lotes con fecha de vencimiento, las entradas y salidas con lote actualizan la cantidad del lote, seleccionar lote al registrar movimientos y aviso de lotes próximos a vencer. Sus reglas están en `docs/flows/lotes.md`.

---

## Sprint 1: Funcionalidad completa

### Crear y editar categorías y unidades de medida
**Responsable:** Tamya

- **Objetivo:** el Coordinator amplía los catálogos sin tocar la base de datos.
- **Hoy:** `backend/app/routers/catalogs.py` solo permite listarlos.
- **Hacer:** agregar `POST` y `PUT` para `/categories` y `/units`, las funciones en `frontend/src/services/api.js` y una pantalla para gestionarlos.
- **Reglas:** solo Coordinator. Nombre de categoría de hasta 50 caracteres y único; unidad de hasta 30 y única; abreviatura de hasta 10. Un nombre repetido devuelve `409`. No se borra nada, porque los productos dependen de ellos.
- **Por confirmar:** dónde va la pantalla. Propuesta: dentro de Productos.

### Reactivar productos desactivados
**Responsable:** Tamya

- **Objetivo:** recuperar un producto desactivado sin crearlo de nuevo.
- **Hoy:** `DELETE /products/{id}` lo deja en `inactive` y nada permite revertirlo; `ProductUpdate` no tiene campo `status`.
- **Hacer:** agregar `PATCH /products/{id}/reactivate` y un botón en `ProductTable.jsx` para los productos inactivos.
- **Reglas:** solo Coordinator. Llama a `update_stock_alerts`, porque al volver a estar activo puede quedar bajo el mínimo. Devuelve `404` si no existe y `400` si ya está activo.

### Movimientos con varios productos desde la pantalla
**Responsable:** Emma

- **Depende de:** que lotes esté en `main`, porque toca los mismos archivos.
- **Objetivo:** registrar varios productos en una sola solicitud.
- **Hoy:** el backend acepta una lista en `details`, pero el formulario de `MovementsPage.jsx` envía una sola línea.
- **Hacer:** permitir agregar y quitar líneas en el formulario. Cada línea tiene producto, cantidad y lote si el producto lo requiere.
- **Reglas:** mantén las validaciones y avisos actuales en cada línea. Comprueba que la autorización aplique todas las líneas o ninguna, y agrega una prueba de eso.

### Rechazar ajustes con el mismo producto repetido
**Responsable:** Emma

- **Objetivo:** evitar que un conteo pise a otro dentro de la misma solicitud.
- **Hoy:** nada lo impide; el bucle de validación está en `create_movement`, en `backend/app/routers/movements.py`.
- **Hacer:** en un `ADJUSTMENT`, responder `400` si se repite la combinación de producto y lote.
- **Reglas:** el mismo producto en dos lotes distintos es válido. No cambia nada para `ENTRY` ni `EXIT`.

---

## Sprint 2: Seguridad

### Limitar los intentos de inicio de sesión
**Responsable:** Adriana

- **Objetivo:** dificultar que se adivinen contraseñas por fuerza bruta.
- **Hoy:** `POST /auth/login` no tiene límite.
- **Hacer:** bloquear temporalmente tras varios fallos, con respuesta `429`, y mostrar el mensaje en el login.
- **Reglas:** los mensajes no revelan si el correo existe. Nunca se registran contraseñas. Un inicio de sesión correcto reinicia el contador.
- **Por confirmar:** 5 fallos por correo y 15 minutos de bloqueo. Dónde guardar el contador: en memoria se pierde al reiniciar y no se comparte entre procesos, así que se propone la BD.

### Migraciones versionadas con Alembic
**Responsable:** Adriana (empieza en el Sprint 2 y termina en el 3)

- **Objetivo:** actualizar todas las instalaciones de la misma manera.
- **Hoy:** hay migraciones SQL manuales en `database/migrations/` (001 y 002) y `database/schema.sql`. Alembic no está instalado.
- **Hacer:** agregar Alembic a `backend/requirements.txt`, conectarlo con los modelos y crear una migración inicial equivalente a `schema.sql`, que ya incluye la 001 y la 002.
- **Reglas:** una BD existente se marca con `alembic stamp` y no se recrea. Compruébalo en una BD temporal: una BD nueva debe quedar igual a `schema.sql`. Actualiza la guía del equipo.
- **Por confirmar:** si `schema.sql` se conserva como referencia o se retira.

### Invalidar el token de acceso al cerrar sesión
**Responsable:** Tamya

- **Objetivo:** que un token deje de servir justo al cerrar sesión.
- **Hoy:** el logout solo revoca el refresh token; el de acceso sirve hasta que vence, 15 minutos por defecto. Ya lleva un `jti`.
- **Hacer:** guardar los `jti` revocados, rechazarlos en `get_current_user` (`backend/app/security/auth.py`) y hacer que el logout reciba el token de acceso.
- **Reglas:** usar el token después del logout devuelve `401`. Los registros vencidos se pueden limpiar. Requiere una tabla nueva, así que lleva migración.

### Revisar la renovación concurrente de refresh tokens
**Responsable:** Tamya

- **Objetivo:** que dos renovaciones simultáneas no dejen dos sesiones válidas ni expulsen a la persona sin motivo.
- **Hoy:** `POST /auth/refresh` lee el token sin bloquear la fila, así que dos peticiones pueden usarlo a la vez. `api.js` evita renovar dos veces con `isRefreshing`, pero solo dentro de cada pestaña.
- **Hacer:** primero reproducirlo y explicar el resultado. Después, bloquear la fila con `with_for_update()`.
- **Reglas:** el segundo intento recibe `401`. Comprueba qué ve la persona con dos pestañas abiertas, porque esa respuesta hace que `api.js` cierre la sesión.

### Prueba de que Recordarme se conserva al rotar tokens
**Responsable:** Tamya

- **Objetivo:** asegurar que "Recordarme" no se pierde al renovar.
- **Hoy:** `POST /auth/refresh` lo deduce de la duración del token anterior, comparando `expires_at` y `created_at`. No hay ninguna prueba específica.
- **Hacer:** agregar pruebas con y sin Recordarme, con al menos dos renovaciones seguidas, que comprueben la nueva fecha de vencimiento.
- **Reglas:** es una tarea de pruebas. Si falla, explica el error antes de cambiar el código.

### Cerrar el registro público
**Responsable:** Emma

- **Objetivo:** que nadie cree una cuenta sin un Coordinator.
- **Hoy:** cualquiera puede usar `POST /auth/register`. El frontend no lo usa, y los usuarios se crean con `POST /users`.
- **Hacer:** quitar el endpoint y actualizar `docs/authentication.md`, las pruebas y la sección 2.5 de `docs/plan/guia-trabajo-equipo.md`, que lo usa para crear el primer usuario local.
- **Reglas:** la guía debe seguir explicando cómo crear el primer Coordinator local, sin escribir contraseñas en ella. No cambies `backend/app/reset_password.py`. Avisa al equipo cuando entre, porque cambia cómo se prepara una computadora nueva.

### Cambio de contraseña por el propio usuario
**Responsable:** Emma

- **Objetivo:** que cada persona cambie su contraseña sin ayuda.
- **Hoy:** solo existe `backend/app/reset_password.py`, para uso administrativo.
- **Hacer:** agregar un endpoint para el usuario autenticado y un formulario en el frontend.
- **Reglas:** pide la contraseña actual (si es incorrecta, `400`) y una nueva de al menos 8 caracteres. Funciona para todos los roles.
- **Por confirmar:** revocar las otras sesiones del usuario al cambiarla. Propuesta: sí.

### Garantizar que siempre exista al menos un Coordinator activo
**Responsable:** Emma

- **Objetivo:** que el sistema nunca se quede sin administrador.
- **Hoy:** `update_user` (`backend/app/routers/users.py`) solo impide quitarse el rol o desactivarse a uno mismo. Dos Coordinators pueden hacérselo el uno al otro al mismo tiempo.
- **Hacer:** antes de guardar, bloquear las filas de los Coordinators activos y responder `400` si no quedaría ninguno.
- **Reglas:** conserva la regla actual y agrega una prueba del nuevo caso.

---

## Sprint 3: Configuración por empresa

Lee antes `docs/decisions/001-una-instalacion-por-empresa.md`: cada empresa tiene su propia instalación, y no se agrega `company_id`.

### Script de instalación para una empresa nueva
**Responsable:** Adriana

- **Depende de:** Alembic y la configuración de la empresa.
- **Objetivo:** dejar lista una instalación nueva con un solo comando.
- **Hacer:** un script que aplique las migraciones, cree el primer Coordinator, los catálogos básicos y la configuración inicial.
- **Reglas:** la contraseña se pide por teclado; no va en argumentos ni en archivos. Ejecutarlo dos veces no duplica nada ni cambia una contraseña.

### Configuración de la empresa en la BD y su endpoint
**Responsable:** Tamya

- **Depende de:** Alembic.
- **Objetivo:** guardar los datos propios de cada empresa.
- **Hacer:** una tabla de una sola fila con nombre, subtítulo, logo, colores, moneda, formato de fecha e identificación fiscal. Un `GET` y un `PUT` solo para Coordinator.
- **Reglas:** la pantalla de login necesita nombre y logo antes de iniciar sesión, así que esos datos van en un `GET` público. La identificación fiscal no va en el público.
- **Por confirmar:** si el logo se sube como archivo o se guarda como URL. Propuesta: URL al principio.

### Pantalla de configuración de la empresa
**Responsable:** Tamya

- **Depende de:** Configuración de la empresa en la BD y su endpoint.
- **Objetivo:** que el Coordinator cambie esos datos sin ayuda técnica.
- **Hacer:** una página nueva, con su HTML, su entrada en `frontend/vite.config.js`, su ruta en el proxy y su enlace en el menú.
- **Reglas:** solo Coordinator. Valida los colores y que la moneda y el formato de fecha sean de una lista.

### Activar o desactivar módulos por empresa
**Responsable:** Tamya

- **Depende de:** Configuración de la empresa en la BD y su endpoint.
- **Objetivo:** ofrecer a cada empresa solo lo que usa.
- **Hacer:** opciones para préstamos, máquinas y proveedores. El menú oculta el módulo y el backend rechaza sus endpoints.
- **Reglas:** desactivar un módulo no borra sus datos. Comprueba que el resto del sistema funcione sin él, como el dashboard y los movimientos.
- **Por confirmar:** el código de respuesta de un módulo desactivado. Propuesta: `403`.

### Quitar el nombre Aroma Cacao fijo del código
**Responsable:** Emma

- **Depende de:** Configuración de la empresa en la BD y su endpoint.
- **Objetivo:** que el sistema muestre el nombre de la empresa instalada.
- **Hoy:** está fijo en los títulos y menús de las 9 páginas HTML, en `backend/app/main.py`, en `/public/info` (`backend/app/routers/public.py`) y en el ejemplo de correo de `frontend/login.html`.
- **Hacer:** leerlo de la configuración, con un nombre genérico si falta. La API puede usar un título genérico.
- **Por confirmar:** si se renombran las claves `aroma_*` de `frontend/src/services/api.js`. Hacerlo cierra las sesiones abiertas una vez.

### Moneda y formato de fecha según la configuración
**Responsable:** Emma

- **Depende de:** Configuración de la empresa en la BD y su endpoint.
- **Objetivo:** adaptar el sistema a empresas de otros países.
- **Hoy:** `es-EC` está fijo en `DashboardPage.jsx`, `LoansPage.jsx`, `MovementsPage.jsx` y `lotUtils.js`. Los precios de referencia de proveedores también deben usar la moneda configurada.
- **Hacer:** una sola función de formato para todo el frontend, y usarla en todas esas pantallas.

### Autoaprobación configurable de solicitudes del Coordinator
**Responsable:** Emma

- **Depende de:** Configuración de la empresa en la BD y su endpoint.
- **Objetivo:** que en una empresa pequeña el Coordinator no tenga que aprobar sus propias solicitudes.
- **Hacer:** una opción, desactivada por defecto. Si está activa, la solicitud de un Coordinator se autoriza al crearla.
- **Reglas:** reutiliza la lógica de `authorize_movement`, con las mismas validaciones y actualización de stock, lotes y alertas. Queda en el historial quién la solicitó y quién la autorizó. Si no pasa una validación, no se autoriza. Lee antes `docs/flows/movimientos-inventario.md`.

### favicon.ico devuelve 404
**Responsable:** Emma

- **Depende de:** Configuración de la empresa en la BD y su endpoint.
- **Objetivo:** que la pestaña del navegador muestre el logo y no haya un 404.
- **Hoy:** las páginas HTML no declaran ningún icono.
- **Hacer:** declarar uno, con el logo configurado y uno genérico si falta.

---

## Sprint 4: Infraestructura y despliegue

### BD de producción con migraciones aplicadas
**Responsable:** Adriana. **Parte manual:** usar las credenciales reales.

- **Depende de:** Alembic y Elegir el hosting de producción.
- **Objetivo:** tener una BD estable y actualizada para producción.
- **Hacer:** crearla, sacar una copia si ya tiene datos y aplicar las migraciones.
- **Reglas:** las credenciales no se pasan a la IA ni se escriben en el repositorio. La IA puede preparar los pasos.

### Copias de seguridad automáticas de la BD
**Responsable:** Adriana

- **Depende de:** Elegir el hosting de producción.
- **Objetivo:** poder recuperar los datos si algo falla.
- **Hacer:** programar `pg_dump` o usar el servicio del hosting. Hacer una prueba real de restauración en una BD aparte y documentar los pasos.
- **Reglas:** las copias se guardan fuera del servidor de la BD y tienen acceso restringido.
- **Por confirmar:** copia diaria, guardada 30 días.

### Guía de instalación para una empresa nueva
**Responsable:** Adriana

- **Depende de:** el script de instalación y el despliegue.
- **Objetivo:** que alguien instale el sistema sin ayuda de quien lo programó.
- **Hacer:** `docs/instalacion.md`, con requisitos, variables de entorno, script, configuración de la empresa, copias y actualizaciones.
- **Reglas:** sin secretos reales. Pruébala desde cero en una computadora o BD limpia.

### Registros de errores y monitoreo de /health
**Responsable:** Tamya

- **Objetivo:** enterarse de una falla antes de que la reporte alguien.
- **Hoy:** el backend no tiene `logging` configurado, y `/health` responde `ok` sin comprobar la BD.
- **Hacer:** configurar los registros, incluir los errores no controlados y activar un monitor externo sobre `/health`.
- **Reglas:** nunca se registran contraseñas, tokens ni `DATABASE_URL`.
- **Por confirmar:** si `/health` comprueba también la BD, quién recibe los avisos y qué servicio se usa.

### Agregar al CI el build del frontend y las pruebas sin BD
**Responsable:** Tamya

- **Objetivo:** detectar antes del merge que el frontend no compila.
- **Hoy:** `.github/workflows/ci.yml` ejecuta Ruff, `test_health.py` y `test_alerts.py`.
- **Hacer:** agregar `test_schema_validation.py` y un paso o trabajo con `npm ci` y `npm run build`.
- **Reglas:** el trabajo `validate` debe conservar su nombre, porque es el que exige la protección de `main`. Si agregas otro trabajo, avisa a Adriana para que también lo exija.

### PostgreSQL en el CI para las pruebas de integración
**Responsable:** Tamya

- **Objetivo:** que el CI ejecute todas las pruebas, y no solo las que no usan BD.
- **Hacer:** agregar un servicio de PostgreSQL al CI, crear las tablas y ejecutar todo `pytest`.
- **Reglas:** usa credenciales de prueba, nunca reales. Las tablas se crean igual que en una instalación: con Alembic si ya está en `main`.

### Limpiar archivos residuales y ramas ya mergeadas
**Responsable:** Tamya

- **Objetivo:** dejar el repositorio sin restos antes de publicar.
- **Candidatos:** `docs/contexto_proyecto.md.bak`, `frontend/react-test.html`, `frontend/src/react-test.jsx`, `frontend/src/counter.js`, `frontend/src/main.js`, y las ramas remotas `feature/health-endpoint` y `feature/users-machines-loans`.
- **Hacer:** comprobar que nada use cada archivo y que cada rama esté mergeada, presentar la lista al equipo y borrar solo lo aprobado.
- **Reglas:** nada se borra sin aprobación. `backend/app/reset_password.py` se queda.

### Elegir el hosting de producción
**Responsable:** Emma. **Parte manual:** decidir y crear la cuenta.

- **Objetivo:** elegir dónde corre el sistema.
- **Hoy:** el backend está en el plan gratuito de Render, que se suspende, y su BD caduca.
- **Hacer:** comparar opciones por costo mensual, BD, copias de seguridad, HTTPS y dominio. Registrar la decisión en `docs/decisions/002-hosting.md`.
- **Reglas:** la IA solo compara opciones, con precios comprobados en las páginas oficiales. La decisión es del equipo.

### Publicar el frontend junto con la API
**Responsable:** Emma

- **Depende de:** Elegir el hosting de producción.
- **Objetivo:** que el sistema funcione en internet, y no solo en local.
- **Hoy:** `api.js` usa rutas relativas y funciona gracias al proxy de Vite, que solo existe en desarrollo.
- **Hacer:** publicar `npm run build` y conectar el frontend con la API, en el mismo dominio o con una URL configurable.
- **Reglas:** comprueba todas las páginas en la URL publicada: login, renovación de sesión y navegación.

### Orígenes de CORS por variable de entorno
**Responsable:** Emma

- **Objetivo:** permitir el dominio de cada instalación sin cambiar el código.
- **Hoy:** la lista está fija a localhost en `backend/app/main.py`.
- **Hacer:** leer una variable como `CORS_ORIGINS`, separada por comas, con los orígenes locales por defecto. Agregarla a `backend/.env.example`.
- **Reglas:** nunca `*`, porque `allow_credentials` está activo.

---

## Sprint 5: Datos, pruebas y salida a producción

### Limpiar los datos de prueba de la BD
**Responsable:** Adriana. **Parte manual:** revisar, aprobar y ejecutar.

- **Objetivo:** empezar producción sin datos inventados.
- **Hacer:** un script en una transacción que primero liste lo que borraría. Sacar una copia antes.
- **Reglas:** nada se borra sin revisar la lista. Hay datos con claves foráneas, como movimientos y alertas, así que comprueba el orden y lo que arrastra cada borrado.

### Cargar los datos reales de Aroma Cacao
**Responsable:** Adriana. **Parte manual:** obtener los datos y ejecutar la carga.

- **Depende de:** Importar el inventario desde Excel o CSV, y Limpiar los datos de prueba de la BD.
- **Objetivo:** tener el inventario real en el sistema.
- **Hacer:** cargar los datos con el importador y cotejar los totales con el archivo de origen.
- **Reglas:** los datos reales no se suben al repositorio ni se pegan en la IA sin permiso de la empresa. Para trabajar con la IA, usa filas inventadas con el mismo formato.

### Salida a producción
**Responsable:** Adriana. **Parte manual:** toda la publicación.

- **Depende de:** todo lo anterior.
- **Objetivo:** que la empresa use el sistema a diario.
- **Hacer:** una lista de verificación con copias, monitoreo, credenciales cambiadas y usuarios creados; publicar; hacer seguimiento durante la primera semana.
- **Reglas:** ten un plan para volver atrás antes de publicar. La IA puede preparar la lista.

### Importar el inventario desde Excel o CSV
**Responsable:** Tamya

- **Objetivo:** cargar un inventario sin escribirlo a mano.
- **Hacer:** subir un archivo de productos, stock inicial, máquinas y proveedores; ver una vista previa con los errores por fila; confirmar la carga. Incluir una plantilla descargable.
- **Reglas:** solo Coordinator. No se guarda nada hasta confirmar, y se carga todo o nada. Aplica las mismas validaciones que la pantalla, incluida la de que un producto con lotes empieza con stock 0. Limita el tamaño del archivo.
- **Por confirmar:** si el stock inicial se registra como movimiento, para que quede en el historial (propuesta: sí), y cómo se cargan los lotes.

### Pruebas de concurrencia de autorizaciones y préstamos
**Responsable:** Emma

- **Objetivo:** comprobar que dos operaciones simultáneas no dejen el stock mal.
- **Hoy:** los bloqueos existen en `movements.py` y `loans.py` (`with_for_update()`), pero no se prueban en paralelo.
- **Hacer:** pruebas con hilos y sesiones separadas: dos salidas que juntas superan el stock, dos autorizaciones de la misma solicitud, y préstamos y salidas a la vez.
- **Reglas:** la fixture `session` usa una sola transacción que se revierte, así que no sirve para esto. Usa una BD de prueba aparte, nunca la de desarrollo. Si aparece un error, explícalo antes de corregirlo.

### Índice único para evitar alertas activas duplicadas
**Responsable:** Emma

- **Depende de:** Alembic.
- **Objetivo:** que la BD impida dos alertas activas del mismo producto.
- **Hoy:** `backend/app/services/alerts.py` consolida los duplicados por código, pero dos procesos simultáneos pueden crearlos.
- **Hacer:** una migración que resuelva los duplicados existentes y cree un índice único parcial sobre `alert(product_id)` con `status = 'active'`. Controlar el `IntegrityError` en `update_stock_alerts`.

### Guía de uso por rol
**Responsable:** Emma

- **Objetivo:** que el personal use el sistema sin capacitación técnica.
- **Hacer:** `docs/guia-uso.md`, con las tareas diarias de Coordinator, Operator y Read-only, en lenguaje sencillo.
- **Reglas:** cada paso se comprueba en el sistema, sin inventar pantallas. Se usa la versión ya configurable, sin mencionar datos internos.

### Prueba de aceptación con el personal por rol
**Responsables:** Adriana, Tamya y Emma, cada una con un rol. **Parte manual:** toda la prueba.

- **Depende de:** Cargar los datos reales de Aroma Cacao.
- **Objetivo:** confirmar que el personal puede hacer su trabajo con el sistema.
- **Hacer:** preparar una lista de tareas por rol, observar al personal hacerlas con datos reales y crear una tarjeta `Bug` por cada problema. Corregir los graves antes de la salida a producción.
- **Reglas:** la IA puede preparar la lista. Quien evalúa es el personal.
