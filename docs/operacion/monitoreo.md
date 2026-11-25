# Registros y monitoreo

## `/health`

`GET /health` comprueba también la BD (decisión de la usuaria, 2026-11-25):

- `200 {"status": "ok", "database": "ok"}`: la API y la BD responden.
- `503 {"status": "error", "database": "unavailable"}`: la BD no responde. La consulta (`SELECT 1`) tiene un límite de 2 segundos y la conexión, de 5.

No necesita sesión.

## Registros

`backend/app/logging_config.py` configura los registros en la salida estándar, que Render muestra en **Logs**.

- Nivel con la variable `LOG_LEVEL` (`INFO` por defecto).
- **Nunca se registran secretos:** un filtro tapa las contraseñas, los tokens (también el del enlace de restablecimiento en las rutas de uvicorn), el encabezado `Authorization` y las credenciales de cualquier URL de conexión, incluida `DATABASE_URL`. El filtro se aplica también a las trazas de error.
- **Errores no controlados:** quedan registrados con el método y la ruta (`Error no controlado en GET /...`) y su traza. El cliente solo recibe `500 {"detail": "Internal server error"}`.
- Si la BD no responde, `/health` registra `La base de datos no responde: <tipo de error>`, sin la URL.

Pruebas: `backend/tests/test_infra.py` y `backend/tests/test_health.py`.

## Monitor externo: UptimeRobot (plan gratuito)

Decisión de la usuaria (2026-11-25). Revisa `/health` cada 5 minutos y avisa por correo si falla.

Cada integrante que deba recibir los avisos:

1. Crea una cuenta en uptimerobot.com con su correo.
2. **New monitor**:
   - Tipo: **HTTP(s)**.
   - Nombre: `Bodega · Aroma Cacao API`.
   - URL: `https://aroma-cacao.onrender.com/health` (o la URL de producción cuando cambie el hosting).
   - Intervalo: 5 minutos.
3. En **Alert contacts**, deja marcado su correo.

Un `503` (BD caída) o que la API no responda dispara el aviso.

**Ojo con el plan gratuito de Render:** la API se suspende tras un rato sin uso. Las visitas del monitor cada 5 minutos la mantienen despierta, lo que consume horas del plan gratuito. Con el hosting de producción esto deja de importar.
