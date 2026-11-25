"""Sprint 4: CORS por variable de entorno, registros sin secretos y errores no controlados.

No usan la base de datos.
"""

import logging

import pytest
from fastapi.testclient import TestClient

from app.logging_config import RedactSecrets, redact
from app.main import app, cors_origins


# ------------------------------------------------------------
# CORS_ORIGINS
# ------------------------------------------------------------

def test_cors_defaults_to_local_origins(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert "http://localhost:5173" in cors_origins()


def test_cors_reads_comma_separated_origins(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " https://bodega.aromacacao.ec/ , https://otra.example.com ")
    assert cors_origins() == ["https://bodega.aromacacao.ec", "https://otra.example.com"]


@pytest.mark.parametrize("value", ["*", "https://ok.com,*", "bodega.aromacacao.ec"])
def test_cors_rejects_wildcard_and_bare_domains(monkeypatch, value):
    monkeypatch.setenv("CORS_ORIGINS", value)
    with pytest.raises(RuntimeError):
        cors_origins()


# ------------------------------------------------------------
# Secretos fuera de los registros
# ------------------------------------------------------------

@pytest.mark.parametrize("raw, secret", [
    ("postgresql+psycopg://aroma_user:SuperClave@db.render.com/aroma", "SuperClave"),
    ('POST body {"email": "a@b.com", "password": "MiClave123"}', "MiClave123"),
    ("new_password=OtraClave99&x=1", "OtraClave99"),
    ('"GET /auth/password-reset/AbCdEf123456789xyz HTTP/1.1" 200', "AbCdEf123456789xyz"),
    ("Authorization: Bearer eyJhbGciOi.eyJzdWIiOiIx.firma-secreta", "firma-secreta"),
    ('{"refresh_token": "r3fr3sh-t0k3n"}', "r3fr3sh-t0k3n"),
])
def test_redact_hides_secrets(raw, secret):
    assert secret not in redact(raw)


def test_redact_hides_configured_database_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p4ss@host/db")
    assert "p4ss" not in redact("conectando a postgresql+psycopg://u:p4ss@host/db")


def test_secret_in_template_does_not_break_formatting():
    record = logging.LogRecord("app", logging.INFO, __file__, 1, "password=%s user=%s", ("Oculta123", "ana"), None)
    RedactSecrets().filter(record)
    message = record.getMessage()
    assert "Oculta123" not in message
    assert "user=ana" in message


def test_filter_redacts_message_args_and_traceback():
    record = logging.LogRecord("x", logging.ERROR, __file__, 1, "login %s", ('{"password": "Secreta1"}',), None)
    try:
        raise ValueError("token=ABC123SECRET")
    except ValueError:
        import sys
        record.exc_info = sys.exc_info()
    RedactSecrets().filter(record)
    assert "Secreta1" not in record.getMessage()
    assert "ABC123SECRET" not in (record.exc_text or "")


def test_uvicorn_access_log_keeps_working_and_hides_reset_token():
    # El formateador de accesos de uvicorn desempaqueta los argumentos por separado
    from uvicorn.logging import AccessFormatter

    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:5000", "GET", "/auth/password-reset/TokenSecreto987654", "1.1", 200), None,
    )
    RedactSecrets().filter(record)
    line = AccessFormatter('%(client_addr)s - "%(request_line)s" %(status_code)s', use_colors=False).format(record)
    assert "TokenSecreto987654" not in line
    assert "/auth/password-reset/***" in line


# ------------------------------------------------------------
# Errores no controlados
# ------------------------------------------------------------

def test_unhandled_error_is_logged_without_secrets(caplog):
    @app.get("/_prueba_error")
    def boom():
        raise RuntimeError("fallo con password=NoDebeSalir")

    try:
        client = TestClient(app, raise_server_exceptions=False)
        with caplog.at_level(logging.ERROR, logger="app"):
            response = client.get("/_prueba_error")
        assert response.status_code == 500
        assert response.json() == {"detail": "Internal server error"}
        assert "Error no controlado en GET /_prueba_error" in caplog.text
        assert "NoDebeSalir" not in response.text
    finally:
        app.router.routes = [r for r in app.router.routes if getattr(r, "path", None) != "/_prueba_error"]
