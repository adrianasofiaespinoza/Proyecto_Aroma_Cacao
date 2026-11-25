"""Registros de la API: formato legible en la salida estándar (Render y la consola los muestran).

Nunca se registran contraseñas, tokens ni DATABASE_URL: el filtro RedactSecrets los tapa
en cualquier mensaje, incluidos los de uvicorn (las rutas de restablecimiento llevan el token)
y las trazas de los errores no controlados.
"""

import logging
import os
import re
import sys

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"

# Lo que se tapa, en este orden
SECRET_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Credenciales dentro de una URL de conexión: postgresql://usuario:clave@host
    (re.compile(r"(\w+(?:\+\w+)?://)[^\s:/@]+:[^\s@]+@"), r"\1***:***@"),
    # Token del enlace de restablecimiento en la ruta
    (re.compile(r"(/auth/password-reset/)[^\s/?\"']+"), r"\1***"),
    # Encabezado Authorization y tokens JWT sueltos
    (re.compile(r"(?i)(bearer\s+)[\w\-.]+"), r"\1***"),
    (re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]+"), "***"),
    # Campos JSON o pares clave=valor con nombres sensibles
    (
        re.compile(
            r"(?i)([\"']?(?:password|current_password|new_password|refresh_token|access_token|token|secret|jwt_secret|data_url)[\"']?\s*[:=]\s*)"
            r"(\"[^\"]*\"|'[^']*'|[^\s,}&]+)"
        ),
        r"\1***",
    ),
]


def redact(text: str) -> str:
    for pattern, replacement in SECRET_PATTERNS:
        text = pattern.sub(replacement, text)
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        text = text.replace(database_url, "***DATABASE_URL***")
    return text


def _redact_arg(value):
    return redact(value) if isinstance(value, str) else value


class RedactSecrets(logging.Filter):
    """Tapa los secretos del mensaje y de la traza del error.

    En el registro de accesos de uvicorn se tapa cada argumento por separado, porque su formateador los necesita.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name == "uvicorn.access" and isinstance(record.args, tuple):
            # Su formateador desempaqueta (cliente, método, ruta, versión, estado)
            record.args = tuple(_redact_arg(a) for a in record.args)
        else:
            # Se tapa el mensaje ya formateado: así no importa si el secreto viene en la plantilla o en un argumento
            record.msg = redact(record.getMessage())
            record.args = ()
        if record.exc_info:
            formatter = logging.Formatter()
            record.exc_text = redact(formatter.formatException(record.exc_info))
            record.exc_info = None
        return True


_configured = False


def configure_logging() -> None:
    """Una sola vez: nivel desde LOG_LEVEL (INFO por defecto) y filtro en todos los registros."""
    global _configured
    if _configured:
        return
    level = os.getenv("LOG_LEVEL", "INFO").upper()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(RedactSecrets())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

    # uvicorn trae sus propios handlers: se les agrega el mismo filtro
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        for existing in logging.getLogger(name).handlers:
            existing.addFilter(RedactSecrets())
        logging.getLogger(name).addFilter(RedactSecrets())

    _configured = True
