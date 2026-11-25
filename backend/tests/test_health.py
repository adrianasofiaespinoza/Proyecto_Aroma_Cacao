from fastapi.testclient import TestClient

import app.main as main
from app.main import app

client = TestClient(app)


def test_health(monkeypatch):
    monkeypatch.setattr(main, "database_ok", lambda: True)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_health_reports_database_down(monkeypatch):
    # El monitor externo avisa con este 503
    monkeypatch.setattr(main, "database_ok", lambda: False)
    r = client.get("/health")
    assert r.status_code == 503
    assert r.json() == {"status": "error", "database": "unavailable"}
