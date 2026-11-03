## Tarjeta de Jira

AC-

## Qué cambia

<!-- Explica en pocas líneas qué hace este cambio y por qué. -->

## Cómo se probó

- [ ] `ruff check .` sin errores (desde `backend/`)
- [ ] `pytest tests` en verde (desde `backend/`)
- [ ] `npm run build` correcto (desde `frontend/`), si se tocó el frontend
- [ ] Probado en el navegador con los roles afectados (Coordinator / Operator / Read-only)

## Checklist

- [ ] El flujo está documentado o actualizado en `docs/flows/`
- [ ] No incluye secretos (`.env`, contraseñas, tokens) ni archivos ajenos a la tarjeta
- [ ] Si cambia la base de datos, incluye la migración y se explica abajo

## Capturas (si cambia la interfaz)
