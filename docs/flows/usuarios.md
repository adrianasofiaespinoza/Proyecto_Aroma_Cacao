# Flujo de gestión de usuarios

## 1. Propósito y alcance

Permitir al `Coordinator` administrar las cuentas del sistema: listarlas, crearlas con un rol y una contraseña inicial, editar sus datos y rol, y activarlas o desactivarlas. El registro público se cerró en el Sprint 2: los usuarios solo los crea un `Coordinator`, y el primero de una base nueva se crea con `backend/app/create_coordinator.py`.

No existe un endpoint para restablecer contraseñas: se mantiene la herramienta local `backend/app/reset_password.py` (ver `contexto_proyecto.md`, sección C).

## 2. Permisos

| Operación | Endpoint | Roles |
|---|---|---|
| Usuario actual | `GET /users/me` | Cualquier usuario autenticado |
| Listar | `GET /users` | `Coordinator` (otros: `403`) |
| Crear | `POST /users` | `Coordinator` |
| Editar / activar / desactivar | `PUT /users/{id}` | `Coordinator` |

## 3. Reglas y validaciones

`POST /users` recibe `username` (1–50), `full_name` (1–100), `email` (formato válido, máximo 100), `password` (8–128), `role` (`Coordinator | Operator | Read-only`, por defecto `Operator`) y `is_active`.

- La contraseña se guarda solo como hash Argon2id y nunca aparece en la respuesta.
- `username` o `email` duplicados → `409`.
- `PUT /users/{id}` modifica `full_name`, `email`, `role` e `is_active`. El `username` no se puede editar.
- **Protección contra bloqueo:** un `Coordinator` no puede desactivarse ni quitarse el rol `Coordinator` a sí mismo (`400`).
- **Siempre al menos un `Coordinator` activo (Sprint 2):** antes de quitarle el rol o desactivar a un `Coordinator`, se bloquean las filas de los `Coordinators` activos (`SELECT ... FOR UPDATE`, en orden de id) y se responde `400` («At least one active Coordinator is required») si no quedaría ninguno. Así, si dos `Coordinators` intentan quitarse el rol el uno al otro al mismo tiempo, los cambios se aplican de uno en uno y el segundo se rechaza.
- **Cambio de contraseña propio (Sprint 2):** `POST /users/me/password`, para todos los roles. Ver `docs/authentication.md`, sección 7b.
- **Al desactivar** a un usuario se revocan todos sus refresh tokens activos. Sus tokens de acceso dejan de funcionar en la siguiente petición, porque `get_current_user` comprueba `is_active` (`403 Inactive user`).
- **Nadie conoce la contraseña de otra persona (2026-11-25, decisión de la usuaria):**
  - Un usuario creado por el `Coordinator`, el primer Coordinator creado por consola (`create_coordinator.py` o `install.py`) y uno restablecido con `reset_password.py` quedan con `must_change_password = true`. Las cuentas de soporte no, porque las crea su propia dueña. Hasta elegir la suya, el backend responde `403 Password change required` a todo excepto `/users/me` y `/users/me/password`. En la app ve solo la pantalla «Elige tu contraseña».
  - **Si alguien olvida su contraseña, la recupera sola con su código de recuperación** (recomendación del profesor, decisión de la usuaria, 2026-11-27: «no quiero que siempre se dependa del coordinador»):
    - Al elegir su contraseña (primer ingreso, después de un reseteo o si todavía no tenía código), el sistema le muestra un **código de recuperación de un solo uso** (`ABCD-EFGH-JKMN`, sin caracteres confusos como 0/O o 1/I). Solo se muestra esa vez; puede copiarlo o descargarlo, y debe marcar «Ya guardé mi código» para seguir. Se guarda solo su hash Argon2id (`users.recovery_code_hash`, revisión `0008`).
    - En el login, **«¿Olvidaste la contraseña?»** (`/recuperar`) pide el correo, el código y la contraseña nueva (`POST /auth/recover`, sin sesión). El código se gasta y recibe uno nuevo. Además, se cierran sus sesiones y se anulan los enlaces pendientes. Acepta minúsculas, espacios y guiones.
    - Mismo mensaje si el correo no existe, está inactivo o el código no coincide. Cada intento fallido cuenta en el mismo límite del login (5 fallos → 15 minutos de bloqueo), así que no se puede adivinar el código probando.
    - Desde su cuenta (Configuración o Cambiar contraseña) puede **generar un código nuevo** con su contraseña actual (`POST /users/me/recovery-code`); el anterior deja de servir. Un cambio de contraseña normal conserva el código que ya tenía.
  - **Respaldo del coordinador:** si además perdió el código, el `Coordinator` (o soporte) pulsa **Resetear contraseña** en **Usuarios** (`POST /users/{id}/password-reset`). La contraseña actual de la persona deja de servir, se cierran sus sesiones y se borra su bloqueo por intentos. El sistema entrega **a la vez** (decisión de la usuaria: el coordinador no elige):
    - una **contraseña temporal** de un solo ingreso, generada por el sistema: al entrar con ella debe elegir la suya (`must_change_password`);
    - un **enlace de un solo uso** (`/restablecer?token=…`, 24 horas) para elegirla sin escribir la temporal. Generar otro anula el anterior y se registra quién lo creó.

    La persona usa cualquiera de los dos y recibe un código de recuperación nuevo. El `Coordinator` nunca conoce la contraseña final. Solo se guardan hashes.
  - No se resetean usuarios inactivos (`400`) ni cuentas de soporte (`404`).
  - Revisiones `0006` y `0008`; pruebas en `backend/tests/test_password_reset.py` y `backend/tests/test_recovery.py`.
- El campo "Cargo" de la maqueta se omitió por decisión de la usuaria: no existe en la tabla `users`.

## 4. Interfaz (`frontend/usuarios.html`)

`frontend/src/components/UsersPage.jsx`:

- Solo para `Coordinator`. Los demás roles ven un mensaje explicativo y no se llama a `GET /users`.
- Tabla con búsqueda (nombre, usuario, correo) y filtros por rol y estado. El usuario actual aparece marcado como "(usted)".
- Formulario de creación y edición. Al editarse a sí mismo, el rol y el estado aparecen deshabilitados. Antes de desactivar a alguien se advierte que se cerrarán sus sesiones.

## 5. Pruebas

- `backend/tests/test_users_machines_loans.py`: permisos por rol, hash de la contraseña, validaciones (`422`), duplicados (`409`), edición, revocación de tokens al desactivar, protección contra bloqueo y `404`.
- Navegador (2026-11-01, backend en modo sandbox con transacción revertida): crear un Operator, rechazo nativo de contraseña corta, correo duplicado (`409`), controles deshabilitados al editarse a sí mismo y mensaje para los roles que no son `Coordinator`.

## 6. Pendiente

- Nada de lo que estaba aquí: el cambio de contraseña propio y la regla de al menos un `Coordinator` activo se hicieron en el Sprint 2 (pruebas en `backend/tests/test_user_password_and_coordinators.py`).
