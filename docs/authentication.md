

## 1. Descripción general del proyecto

El proyecto consiste en el desarrollo de una API REST para la gestión del inventario de mantenimiento de **Aroma Cacao S.A.**

La API permite administrar productos, usuarios y movimientos de inventario, incorporando autenticación mediante JWT, control de acceso por roles, actualización de existencias, trazabilidad de movimientos y generación de alertas de stock mínimo.

La API fue desarrollada utilizando:

- Python
    
- FastAPI
    
- SQLAlchemy
    
- PostgreSQL
    
- Pydantic
    
- JWT
    
- Argon2 para el almacenamiento seguro de contraseñas
    
- Swagger UI / OpenAPI
    
- Postman para pruebas de los endpoints
    

---

# 2. Requisitos implementados

## 1. Public endpoints sin autenticación

Se implementaron endpoints públicos que pueden ser consultados sin iniciar sesión:

```http
GET /public/info
GET /public/products
```

Estos endpoints permiten consultar información pública sin proporcionar un token JWT.

---

## 2. Registro de usuarios (registro público cerrado)

El registro público (`POST /auth/register`) **se cerró en el Sprint 2**: nadie puede crear una cuenta sin un `Coordinator`. El endpoint ya no existe (responde `404`).

- Los usuarios los crea un `Coordinator` desde la pantalla **Usuarios** (`POST /users`), con su rol y una contraseña inicial.
- El **primer Coordinator** de una base nueva se crea en la consola con `backend/app/create_coordinator.py`, que pide los datos y la contraseña sin mostrarla (ver `docs/plan/guia-trabajo-equipo.md`, sección 2.5).

Las contraseñas no se almacenan directamente en la base de datos. Se utiliza **Argon2** para realizar el hash de las contraseñas.

Se definieron roles para controlar el acceso:

- `Coordinator`
    
- `Operator`
    
- `Read-only`
    

---

## 3. Login

Se implementó:

```http
POST /auth/login
```

El usuario proporciona sus credenciales y, si son correctas, la API genera los tokens necesarios para acceder a los endpoints protegidos.

La autenticación permite posteriormente identificar al usuario que realiza las operaciones dentro del sistema.

### Límite de intentos (Sprint 2)

Para dificultar que se adivinen contraseñas por fuerza bruta (`backend/app/services/login_limit.py`, tabla `login_attempt`):

- Tras **5 fallos** con el mismo correo dentro de **15 minutos**, ese correo queda bloqueado **15 minutos**. El login responde `429` con la cabecera `Retry-After` (segundos que faltan), aunque la contraseña sea correcta.
- Se cuenta por correo **aunque la cuenta no exista**, y el mensaje es el mismo en los dos casos: la respuesta no revela qué correos están registrados.
- Un inicio de sesión correcto borra el contador.
- Nunca se guarda la contraseña intentada: solo el correo, el número de fallos y las fechas.
- El contador está en la BD (no en memoria), así que sobrevive a los reinicios y vale aunque haya varios procesos. La fila se bloquea con `SELECT ... FOR UPDATE`, así dos intentos simultáneos cuentan los dos.
- Configurable con las variables de entorno `LOGIN_MAX_ATTEMPTS` (5) y `LOGIN_LOCK_MINUTES` (15).
- El frontend muestra «Demasiados intentos fallidos» con los minutos de espera.


---

# 4. JWT Access Tokens

La API utiliza **JSON Web Tokens (JWT)** para proteger los endpoints que requieren autenticación.

Después del login se obtiene un access token que se envía mediante:

```http
Authorization: Bearer <access_token>
```

El backend valida el token y obtiene la identidad del usuario autenticado.

Esto es importante para la trazabilidad, ya que las operaciones no dependen únicamente de un `user_id` enviado por el cliente, sino del usuario identificado mediante el JWT.


---

# 5. Refresh Tokens

Se implementó:

```http
POST /auth/refresh
```

Los refresh tokens permiten obtener un nuevo access token sin solicitar nuevamente las credenciales.

Los refresh tokens son almacenados de manera segura utilizando hash y pueden ser revocados.

Cada refresh token sirve **una sola vez**: al renovar se revoca y se entrega uno nuevo (rotación).

### Renovaciones simultáneas (Sprint 2)

Se reprodujo el caso con `backend/tests/test_refresh_concurrency.py` (dos peticiones a la vez con el mismo refresh token, en una BD de pruebas):

- **Antes:** la fila se leía sin bloquear. Las dos renovaciones respondían `200` y quedaban **dos sesiones válidas** a partir de un solo refresh token.
- **Ahora:** la fila se lee con `with_for_update()`. La segunda petición espera a que termine la primera, ve el token revocado y recibe `401`.

**Varias pestañas:** el frontend guarda la sesión en `localStorage`, compartido entre pestañas. Si dos pestañas renuevan a la vez, la que pierde recibe `401`; antes eso cerraba la sesión en todas. Ahora `frontend/src/api/client.ts` comprueba si otra pestaña ya guardó tokens nuevos y, si es así, los usa en vez de cerrar la sesión (pruebas en `client.test.ts`).


---

# 6. Logout

Se implementó:

```http
POST /auth/logout
```

El logout revoca el refresh token de la sesión (cuerpo `{"refresh_token": ...}`) y, desde el Sprint 2, **también el token de acceso** que llega en la cabecera `Authorization`.

- El `jti` del token de acceso se guarda en la tabla `revoked_access_token`, y `get_current_user` (`backend/app/security/auth.py`) lo rechaza con `401` («Access token revoked»). Antes seguía sirviendo hasta vencer (15 minutos).
- Solo se cierra esa sesión: las de otros equipos siguen activas.
- Los registros de tokens ya vencidos se borran en cada logout, porque un token vencido se rechaza de todos modos.


---

# 7. Remember Me

Se implementó la funcionalidad **Remember Me** mediante el sistema de refresh tokens.

Esto permite mantener la sesión del usuario durante un período mayor sin solicitar nuevamente las credenciales, dependiendo de la opción seleccionada durante el login.

- Sin Recordarme, el refresh token dura `REFRESH_TOKEN_DAYS` (7 días); con Recordarme, `REMEMBER_REFRESH_TOKEN_DAYS` (30).
- Al renovar, `POST /auth/refresh` deduce la opción de la duración del token anterior (`expires_at − created_at`), así que se conserva en cada rotación.
- Pruebas (Sprint 2, `backend/tests/test_auth_security.py`): con y sin Recordarme, dos renovaciones seguidas, comprobando la nueva fecha de vencimiento. Pasaron sin cambios en el código.

---

# 7b. Cambio de contraseña propio (Sprint 2)

```http
POST /users/me/password
```

Cuerpo: `current_password`, `new_password` (8–128) y, opcional, `refresh_token` de la sesión actual. Funciona para todos los roles.

- Si la contraseña actual es incorrecta responde `400`; si la nueva es igual a la actual, también `400`.
- **Cierra las demás sesiones** del usuario (revoca sus refresh tokens). La sesión actual se conserva si envía su `refresh_token`; el frontend lo hace.
- Los tokens de acceso de otros equipos siguen sirviendo hasta que vencen (15 minutos como máximo), porque no se conoce su `jti`; después ya no pueden renovarse.
- En el frontend: menú de usuario → **Cambiar contraseña** (pantalla `/cuenta`), y en móvil desde «Más».

---

# 8. Endpoint `/users/me`

Se implementó:

```http
GET /users/me
```

Este endpoint permite obtener la información del usuario actualmente autenticado.

La identidad se obtiene a partir del JWT enviado en la solicitud.

La respuesta puede incluir información como:

- ID
    
- username
    
- nombre completo
    
- email
    
- rol
    
- estado del usuario
    

---

# 9. Autenticación social

En el proyecto actual **no se implementó autenticación social**, debido a que no forma parte del alcance funcional definido para el sistema de inventario.

El sistema utiliza autenticación propia mediante usuario/email, contraseña y JWT.

---

# 10. Entidades específicas de la aplicación

El sistema cuenta con múltiples entidades específicas del dominio de inventario.

Entre ellas:

### User

Representa a los usuarios del sistema y sus roles.

### Product

Representa los productos, repuestos y materiales administrados por el inventario.

Incluye información como:

- código interno
    
- nombre
    
- marca
    
- modelo
    
- número de parte
    
- stock actual
    
- stock mínimo
    
- stock máximo
    
- ubicación física
    
- estado
    
- categoría
    
- unidad de medida
    

### Movement

Representa los movimientos de inventario.

Los tipos implementados son:

```text
ENTRY
EXIT
ADJUSTMENT
```

Los movimientos cuentan con estados:

```text
pending
authorized
```

También registran:

- usuario solicitante
    
- usuario autorizador
    
- motivo
    
- número de orden de trabajo
    

### MovementDetail

Contiene los productos y cantidades involucradas en cada movimiento.

### Alert

Representa las alertas de stock mínimo.

Registra:

- producto
    
- fecha de generación
    
- stock al momento de la alerta
    
- estado
    

Los estados definidos son:

```text
active
resolved
```

### Otras entidades

La base de datos también contempla:

- Category
    
- UnitOfMeasure
    
- Supplier
    
- ProductSupplier
    
- Machine
    
- ProductMachine
    
- Lot
    
- Worker
    
- Loan
    
- RefreshToken
    

---

# 11. CRUD completo

Se implementó un CRUD completo para la entidad **Product**.

Los endpoints principales son:

```http
POST   /products
GET    /products
GET    /products/{product_id}
PUT    /products/{product_id}
DELETE /products/{product_id}
```

El sistema permite:

- Crear productos.
    
- Consultar productos.
    
- Consultar un producto específico.
    
- Actualizar productos.
    
- Desactivar productos mediante eliminación lógica.
    

También se realizan validaciones de:

- código interno único
    
- categoría existente
    
- unidad de medida existente
    
- stock mínimo válido
    
- stock máximo no menor que el stock mínimo
    

---

# 12. Endpoints protegidos mediante JWT

Los endpoints privados utilizan autenticación JWT.

El usuario debe proporcionar un access token válido para acceder a las operaciones protegidas.

Además de la autenticación, existen restricciones basadas en roles.

Por ejemplo:

- `Coordinator` puede autorizar movimientos.
    
- `Operator` puede solicitar movimientos, pero no autorizarlos.
    
- `Read-only` está destinado a operaciones de consulta.
    

Esto permite aplicar control de acceso según las responsabilidades de cada usuario.


---

# 13. Trazabilidad de usuarios y operaciones

Una característica importante del sistema es la **trazabilidad de los movimientos de inventario**.

Cuando un usuario autenticado crea un movimiento, el sistema registra su identidad mediante:

```text
requesting_user_id
```

Cuando un Coordinator autoriza el movimiento, se registra:

```text
authorizing_user_id
```

Por ejemplo:

```json
{
    "id": 6,
    "type": "EXIT",
    "status": "authorized",
    "requesting_user_id": 1,
    "authorizing_user_id": 1,
    "reason": "Salida de repuesto para mantenimiento",
    "work_order_number": "OT-003"
}
```

Esto permite determinar:

> quién solicitó el movimiento y quién lo autorizó.

La identidad utilizada para registrar estas acciones proviene del usuario autenticado mediante JWT, evitando depender únicamente de un identificador enviado libremente por el cliente.

El flujo de trazabilidad es:

```text
Usuario inicia sesión
        ↓
Obtiene JWT
        ↓
Realiza una solicitud autenticada
        ↓
Backend identifica al usuario
        ↓
requesting_user_id
        ↓
Coordinator autoriza
        ↓
authorizing_user_id
```

Esta funcionalidad proporciona **seguridad, control de acceso y auditoría básica de las operaciones de inventario**.

---

# 14. JSON request y response

La API utiliza JSON para las solicitudes y respuestas.

Por ejemplo, para crear un movimiento:

```json
{
    "type": "EXIT",
    "reason": "Salida de repuesto para mantenimiento",
    "work_order_number": "OT-003",
    "details": [
        {
            "product_id": 1,
            "quantity": 2
        }
    ]
}
```

Las respuestas de los endpoints también utilizan estructuras JSON.

FastAPI y Pydantic permiten validar automáticamente los datos recibidos.


---

# 15. Documentación automática OpenAPI

Al utilizar FastAPI, la API genera automáticamente documentación basada en OpenAPI.

La documentación interactiva está disponible mediante Swagger UI:

```text
/docs
```

Desde allí se pueden visualizar:

- endpoints
    
- métodos HTTP
    
- parámetros
    
- cuerpos JSON
    
- respuestas
    
- códigos de error
    
- autenticación
    

---

# 16. Pruebas mediante Swagger UI y Postman

## Swagger UI

Los endpoints fueron probados utilizando Swagger UI.

Se realizaron pruebas de:

- registro
    
- login
    
- autenticación
    
- `/users/me`
    
- CRUD de productos
    
- creación de movimientos
    
- autorización de movimientos
    
- validación de stock
    
- generación de alertas
    
- consulta de alertas
    

También se probaron diferentes respuestas de error, incluyendo operaciones no permitidas por rol.

### Screenshots

![[Pasted image 20261004103218.png]]


![[Pasted image 20261004103044.png]]

![[Pasted image 20261004102941.png]]
## Postman

Se creó una colección:

```text
Aroma Cacao API
```

La colección utiliza variables como:

```text
base_url
access_token
refresh_token
```

El login guarda automáticamente los tokens mediante un script de Postman, permitiendo reutilizarlos en las solicitudes protegidas.

![[Pasted image 20261004104934.png]]


![[Pasted image 20261004104821.png]]




---

# 17. Lógica de negocio de inventario

Además de los requisitos generales de la API, se implementó lógica específica para el sistema de inventario.

## Flujo de movimientos

```text
Solicitud
    ↓
pending
    ↓
Autorización del Coordinator
    ↓
authorized
    ↓
Actualización del stock
```

El movimiento conserva la trazabilidad de:

```text
requesting_user_id
authorizing_user_id
```

---

## ENTRY

Cuando se autoriza un movimiento `ENTRY`:

```text
stock actual + cantidad
```

Ejemplo:

```text
Stock: 10
Entrada: 5
Nuevo stock: 15
```

---

## EXIT

Cuando se autoriza un movimiento `EXIT`:

```text
stock actual - cantidad
```

Antes de realizar la operación se verifica que exista suficiente stock.

Por ejemplo:

```text
Stock: 10
Salida: 15
```

La operación es rechazada porque la cantidad solicitada supera el stock disponible.

---

## ADJUSTMENT

Los movimientos `ADJUSTMENT` establecen directamente el stock:

```text
stock actual = cantidad indicada
```

Las cantidades negativas son rechazadas mediante validación de Pydantic.

---

# 18. Sistema de alertas de stock mínimo

Se implementó un sistema de alertas que verifica el stock después de autorizar un movimiento.

La condición utilizada es:

```text
current_stock <= minimum_stock
```

Cuando se cumple, se genera una alerta.

Ejemplo:

```text
Stock actual: 4
Stock mínimo: 5
```

Se genera:

```text
status = active
stock_at_alert = 4
```

También se implementó prevención de alertas activas duplicadas.

Si ya existe una alerta activa para el producto, no se genera otra.

---

# Conclusión

La API desarrollada para Aroma Cacao S.A. implementa los principales componentes requeridos para una API REST moderna: autenticación, autorización mediante roles, JWT, refresh tokens, CRUD, documentación automática, pruebas con Swagger y Postman y entidades específicas del dominio.

Además, se incorporó lógica de negocio propia del sistema de inventario, incluyendo movimientos `ENTRY`, `EXIT` y `ADJUSTMENT`, validación de existencias, autorización de movimientos por parte de Coordinators, alertas de stock mínimo y trazabilidad de las operaciones.

La trazabilidad permite identificar tanto al usuario que **solicitó** un movimiento como al usuario que **lo autorizó**, utilizando la identidad obtenida mediante JWT. Esto proporciona una base de auditoría para las operaciones realizadas dentro del inventario.

El único punto de la lista de requisitos que no se implementó es la autenticación social mediante Google o GitHub, debido a que no forma parte del alcance funcional actual del sistema de inventario.