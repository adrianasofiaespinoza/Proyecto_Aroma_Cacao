# Instalar el sistema para una empresa nueva

Cada empresa tiene su propia instalación: su API, su BD y su frontend (decisión 001). Esta guía no contiene secretos reales: donde dice `<...>`, va el valor de esa instalación, que nunca se sube al repositorio.

## 1. Requisitos

- La BD: PostgreSQL 17, vacía y creada en el hosting elegido (`docs/decisions/002-hosting.md`).
- Un servicio para la API con Python 3.12 y la carpeta `backend/` como raíz.
- Un sitio estático para el frontend (`frontend/`).
- Para ejecutar el instalador: Python 3.12 con `pip install -r backend/requirements.txt`, o este repositorio en una computadora del equipo.

## 2. Variables de entorno de la API

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://<usuario>:<clave>@<host>/<bd>?sslmode=require` |
| `JWT_SECRET` | Al menos 32 caracteres aleatorios y uno distinto por instalación: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | El dominio del frontend, por ejemplo `https://bodega.empresa.com`. Sin `*`. Varios, separados por comas. |
| `LOG_LEVEL` | Opcional, `INFO` por defecto. |
| `PYTHON_VERSION` | `3.12.8`, en Render. |

Opcionales: `ACCESS_TOKEN_MINUTES` (15), `REFRESH_TOKEN_DAYS` (7), `REMEMBER_REFRESH_TOKEN_DAYS` (30). La referencia es `backend/.env.example`.

- **Build:** `pip install -r requirements.txt`.
- **Start:** `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Así cada despliegue aplica sus migraciones.

## 3. Instalar la BD con el script

Desde una computadora del equipo, en `backend/`, con `DATABASE_URL` apuntando a la BD **nueva y vacía** de la empresa (fish):

```fish
set -x PYTHONPATH .
set -x DATABASE_URL '<url externa de la BD nueva>'
python app/install.py
set -e DATABASE_URL
```

El script:

1. Aplica las migraciones de Alembic.
2. Carga los catálogos básicos de categorías y unidades.
3. Pide el nombre de la empresa y su nombre corto.
4. Crea el **primer Coordinator** de la empresa.
5. Ofrece crear la **cuenta de soporte** del equipo de desarrollo.

Las contraseñas se piden sin mostrarse. Si se interrumpe, se puede volver a ejecutar: no duplica nada ni cambia contraseñas. El último comando quita `DATABASE_URL`, para que la terminal no quede conectada a esa BD.

La contraseña del Coordinator se le entrega en persona. Al entrar por primera vez, deberá elegir la suya.

## 4. Publicar el frontend

- **Build:** `npm ci && npm run build`, con `frontend/` como raíz. La salida queda en `frontend/dist`.
- Todas las rutas que no sean archivos deben servir `index.html`, porque es una aplicación de una sola página.
- **Conexión con la API:** si el hosting permite reescribir rutas, `/auth`, `/users`, `/products`, `/settings` y las demás van a la API (ver `frontend/vercel.json`). Si no lo permite, el frontend llama a la API por su URL y `CORS_ORIGINS` debe incluir el dominio del frontend. Esto depende del hosting elegido.
- **Vercel Hobby no se puede usar** para un cliente que paga: solo admite uso no comercial. Cloudflare Pages sí lo permite en su plan gratuito, pero su `_redirects` no reenvía a la API: hace falta una Pages Function o CORS (`docs/decisions/002-hosting.md`, opción 6).

## 5. Configurar la empresa

1. Entra con la **cuenta de soporte**.
2. En **Configuración**, carga el logo, los colores, la moneda, el formato de fecha, la identificación fiscal y los módulos activos.
3. Entra con el **Coordinator** y comprueba que la marca se vea bien.
4. El Coordinator crea los demás usuarios desde **Usuarios**.

Detalle de cada opción: `docs/flows/configuracion-empresa.md`.

## 6. Copias de seguridad y monitoreo

- **Copias diarias cifradas:** configura los secretos `PROD_DATABASE_URL` y `BACKUP_PASSPHRASE` del flujo de copias, ejecútalo una vez a mano y haz una prueba de restauración (`docs/operacion/copias-de-seguridad.md`).
- **Monitor de `/health`** en UptimeRobot (`docs/operacion/monitoreo.md`).

## 7. Comprobar que todo funciona

- `GET <api>/health` responde `{"status": "ok", "database": "ok"}`.
- `GET <api>/settings/public` muestra el nombre de la empresa.
- En el frontend publicado: iniciar sesión, cambiar de pantalla, cerrar sesión y volver a entrar; desde el celular, el menú «Más».

## 8. Actualizar a una versión nueva

1. Antes de actualizar, lanza una copia a mano: **Actions → Copia diaria de la BD → Run workflow**.
2. Despliega la versión nueva. El comando de inicio aplica las migraciones (`alembic upgrade head`).
3. Repite las comprobaciones del paso 7.

Si una migración falla, la API no arranca y la versión anterior sigue funcionando. Revisa los registros del hosting antes de reintentar.

## Prueba de esta guía

**2026-11-25, BD local vacía:**

- `install.py` aplicó todas las migraciones, cargó los catálogos y creó la empresa y el primer Coordinator. La segunda ejecución no cambió nada.
- La copia cifrada y la restauración se probaron en una BD aparte (`docs/operacion/copias-de-seguridad.md`).

Falta probar los pasos 2, 4 y 6 en el hosting elegido, cuando el equipo lo decida.
