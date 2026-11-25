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
  - Un usuario creado por el `Coordinator` (o restablecido con `reset_password.py`) queda con `must_change_password = true`. Hasta elegir la suya, el backend responde `403 Password change required` a todo excepto `/users/me` y `/users/me/password`. En la app ve solo la pantalla «Elige tu contraseña».
  - **Si alguien olvida su contraseña:** el `Coordinator` pulsa el candado en **Usuarios** y obtiene un **enlace de un solo uso** (`POST /users/{id}/password-reset`). Vence a las 24 horas, generar otro anula el anterior y se registra quién lo creó. La persona lo abre (`/restablecer?token=…`), elige su contraseña (`GET` y `POST /auth/password-reset`, sin sesión), se cierran sus sesiones y se borra su bloqueo por intentos. El `Coordinator` nunca conoce la contraseña resultante. Solo se guarda el hash del token.
  - No se generan enlaces para usuarios inactivos (`400`) ni para cuentas de soporte (`404`).
  - Revisión `0006`; pruebas en `backend/tests/test_password_reset.py`.
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
