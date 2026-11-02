# Flujo de gestión de usuarios

## 1. Propósito y alcance

Permitir al `Coordinator` administrar las cuentas del sistema: listarlas, crearlas con un rol y una contraseña inicial, editar sus datos y rol, y activarlas o desactivarlas. El registro público (`POST /auth/register`, que crea usuarios `Read-only`) no cambia.

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
- **Al desactivar** a un usuario se revocan todos sus refresh tokens activos. Sus tokens de acceso dejan de funcionar en la siguiente petición, porque `get_current_user` comprueba `is_active` (`403 Inactive user`).
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

- Cambio de contraseña por parte del propio usuario: no está definido.
- Garantizar que siempre exista al menos un `Coordinator` activo: hoy solo se impide el autobloqueo; un `Coordinator` puede desactivar a otro.
