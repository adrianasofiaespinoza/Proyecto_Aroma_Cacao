# Guía de trabajo del equipo

Para: **Adriana, Tamya y Emma**. Explica cómo preparar la computadora, cómo hacer cada tarea asignada en Jira y cómo usar Git y GitHub para entregarla.

Lecturas complementarias:

- `docs/plan/guia-jira.md`: cómo usar Jira.
- `docs/contexto_proyecto.md`: estado del proyecto y reglas (sección 4).
- `docs/flows/`: cómo funciona cada módulo.

---

## 1. Git y GitHub en cinco conceptos

Git guarda el historial del código en tu computadora. GitHub es el sitio donde el equipo comparte ese historial.

| Concepto | Qué es | Comparación |
|---|---|---|
| **Commit** | Un punto de guardado del código **en tu computadora**, con un mensaje que dice qué cambiaste. No sube nada a internet. | Como "guardar versión" en un documento, con una nota. |
| **Rama** (branch) | Una copia paralela del código donde trabajas sin afectar a las demás. | Un borrador aparte. |
| **Push** | **Sube** tus commits a GitHub. | Compartir el borrador. |
| **Pull Request (PR)** | Una solicitud para unir tu rama a `main`. Otra persona la revisa y el CI la prueba. | Pedir revisión antes de publicar. |
| **Merge** | Unir la rama aprobada a `main`. | Publicar la versión final. |

**¿Para qué sirven los commits?** Para llevar un historial ordenado: qué cambió, cuándo, quién y por qué. Si algo se rompe, se puede ver o deshacer un commit concreto. GitHub los asocia a tu cuenta por el **correo** configurado en Git; así aparecen tus contribuciones en el repositorio.

`main` está protegida: nadie puede subir directamente a ella. Todo entra por una PR con el CI en verde y la aprobación de otra persona.

---

## 2. Preparar la computadora (una sola vez)

Necesitas: **Git**, **Docker**, **Python 3.12 o superior**, **Node.js 20 o superior** y un editor (por ejemplo, VS Code).

> Los comandos son para Linux y macOS (bash o zsh). En Windows usa **Git Bash**; las diferencias se indican cuando hay alguna.

### 2.1 Configurar Git con tu cuenta de GitHub

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "el-correo-de-tu-cuenta-de-github@ejemplo.com"
```

El correo debe ser **el mismo de tu cuenta de GitHub**; si no, tus commits no aparecerán como tuyos.

Inicia sesión en GitHub desde la terminal con la [CLI de GitHub](https://cli.github.com/):

```bash
gh auth login
```

### 2.2 Clonar el repositorio

```bash
git clone https://github.com/adrianasofiaespinoza/Proyecto_Aroma_Cacao.git
cd Proyecto_Aroma_Cacao
```

Adriana tiene que añadirte como colaboradora en GitHub (*Settings → Collaborators*) para que puedas subir ramas.

### 2.3 Base de datos (PostgreSQL en Docker)

Elige una contraseña para tu base local y úsala en ambos comandos:

```bash
docker run -d --name aroma-postgres \
  -e POSTGRES_USER=aroma_user \
  -e POSTGRES_PASSWORD=TU_CONTRASEÑA \
  -e POSTGRES_DB=aroma_inventory \
  -p 5432:5432 -v aroma_pgdata:/var/lib/postgresql/data \
  postgres:17

# Espera unos segundos y crea las tablas y los catálogos iniciales:
docker exec -i aroma-postgres psql -U aroma_user -d aroma_inventory < database/schema.sql
```

`schema.sql` ya incluye la migración 001; no hace falta ejecutarla aparte. Los días siguientes solo necesitas `docker start aroma-postgres`.

### 2.4 Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows (Git Bash): source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env               # y completa DATABASE_URL y JWT_SECRET
uvicorn app.main:app --reload
```

Comprueba que <http://127.0.0.1:8000/health> responde `{"status":"ok"}` y que la documentación de la API está en <http://127.0.0.1:8000/docs>.

### 2.5 Tu primer usuario local

Mientras siga abierto el registro público:

1. En <http://127.0.0.1:8000/docs>, ejecuta `POST /auth/register` con tus datos. Se crea con el rol `Read-only`.
2. Conviértelo en Coordinator:

   ```bash
   docker exec aroma-postgres psql -U aroma_user -d aroma_inventory \
     -c "UPDATE users SET role = 'Coordinator' WHERE email = 'tu-correo@ejemplo.com';"
   ```

Cuando se cierre el registro público (Sprint 2), este paso lo hará el script de instalación.

### 2.6 Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre <http://localhost:5173/login> e inicia sesión. El frontend usa el backend local a través del proxy de Vite. Antes de subir cambios del frontend, ejecuta `npm run typecheck`, `npm test` y `npm run build`. La estructura está explicada en `docs/architecture/frontend.md`.

---

## 3. Cómo hacer una tarea asignada, paso a paso

### Paso 1. Toma la tarjeta en Jira

- Abre tu tarjeta (por ejemplo, `AC-27`), lee la descripción y el documento de flujo relacionado en `docs/flows/`.
- Si algo no está claro, **pregunta antes de programar**, con un comentario en la tarjeta o en el grupo.
- Muévela a **In Progress**. Ten como máximo 2 tarjetas en curso a la vez.

### Paso 2. Crea tu rama desde `main` actualizada

```bash
git switch main
git pull
git switch -c feature/AC-27-registrar-lotes
```

Formato del nombre: `tipo/AC-NN-descripcion-corta`. Usa `feature/` para algo nuevo, `fix/` para un error y `docs/` para documentación.

### Paso 3. Programa en pasos pequeños y haz commits

Cada vez que completes una parte que funcione, guarda un commit:

```bash
git status                 # qué archivos cambiaste
git diff                   # qué cambiaste exactamente
git add backend/app/routers/lots.py backend/tests/test_lots.py
git commit -m "feat(lots): register lots with expiration date (AC-27)"
```

- Usa `git add` con archivos concretos, no `git add .` a ciegas, para no subir archivos que no corresponden.
- Varios commits pequeños son mejores que uno enorme.

**Formato de los mensajes** (en inglés, como el resto del historial):

```
tipo(área): qué hace, en presente (AC-NN)
```

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| `feat` | Funcionalidad nueva | `feat(lots): register lots with expiration date (AC-27)` |
| `fix` | Corrección de un error | `fix(movements): reject duplicated products in adjustments (AC-33)` |
| `test` | Solo pruebas | `test(lots): cover expired lot exits (AC-27)` |
| `docs` | Solo documentación | `docs(lots): document lots flow (AC-27)` |
| `refactor` | Reorganizar código sin cambiar el comportamiento | `refactor(api): extract error helper (AC-40)` |
| `ci` / `chore` | CI, configuración, limpieza | `ci: build frontend in workflow (AC-58)` |

La clave `AC-NN` en el mensaje y en el nombre de la rama hace que Jira muestre los commits dentro de la tarjeta (si está instalada la app *GitHub for Jira*).

### Paso 4. Prueba antes de subir

```bash
cd backend
ruff check .
pytest tests            # necesita la base de datos local encendida
cd ../frontend
npm run build           # si tocaste el frontend
```

Además, prueba la funcionalidad en el navegador con los roles afectados: **Coordinator, Operator y Read-only**. Recuerda que los permisos se aplican en el backend, no solo ocultando botones.

Si escribes pruebas que usan la base de datos, usa los fixtures de `backend/tests/conftest.py`: cada prueba corre en una transacción que se revierte y no deja datos.

### Paso 5. Documenta

Actualiza o crea el documento del flujo en `docs/flows/` (qué hace, permisos, errores, endpoints, cómo se probó). Si el cambio modifica el estado del proyecto, actualiza también `docs/contexto_proyecto.md`.

### Paso 6. Sube la rama y abre la PR

```bash
git push -u origin feature/AC-27-registrar-lotes
```

En GitHub aparecerá el botón **Compare & pull request**. También puedes abrirla desde la terminal:

```bash
gh pr create --base main --title "AC-27: Registrar lotes con fecha de vencimiento"
```

La PR se abre con una plantilla: complétala (tarjeta de Jira, qué cambia, cómo se probó). En Jira, mueve la tarjeta a revisión si tu tablero tiene esa columna; si no, déjala en *In Progress*.

### Paso 7. Revisión y CI

- El CI (`validate`) se ejecuta solo: debe quedar en **verde**. Si falla, abre el detalle, corrígelo, haz un commit nuevo y vuelve a hacer push. La PR se actualiza sola.
- La revisión la hace la persona asignada:

  | Autora | Revisa |
  |---|---|
  | Adriana | Emma |
  | Tamya | Adriana |
  | Emma | Tamya |

- Si te piden cambios, hazlos en la misma rama (commit y push) y responde los comentarios.

### Paso 8. Merge y cierre

- Con el CI en verde y la aprobación, pulsa **Merge pull request** y luego **Delete branch**.
- Actualiza tu `main` local:

  ```bash
  git switch main
  git pull
  ```

- En Jira, mueve la tarjeta a **Done**.

---

## 4. Cómo revisar la PR de otra persona

1. Lee la tarjeta de Jira para saber qué debía hacer el cambio.
2. En la pestaña **Files changed**, revisa el código. Puedes comentar una línea concreta con el botón **+**.
3. Si puedes, pruébalo en tu computadora:

   ```bash
   gh pr checkout NUMERO_DE_PR
   ```

4. Comprueba:
   - Hace lo que pide la tarjeta.
   - Respeta los permisos por rol.
   - Tiene pruebas y el CI está en verde.
   - Documenta el flujo.
   - No incluye secretos ni archivos que no corresponden.
5. Termina con **Review changes**: **Approve** si está bien, o **Request changes** explicando qué falta.

Revisar con respeto: se comenta el código, no a la persona. Las preguntas ("¿qué pasa si la cantidad es 0?") ayudan más que las órdenes.

---

## 5. Problemas comunes

| Problema | Solución |
|---|---|
| `git push` rechazado porque la rama remota tiene cambios | `git pull` en tu rama, resuelve conflictos si los hay y vuelve a hacer push. |
| La PR dice que la rama está desactualizada | Pulsa **Update branch** en GitHub, o en tu terminal: `git switch main && git pull && git switch tu-rama && git merge main` y luego push. |
| **Conflicto** al hacer merge | Git marca los archivos con `<<<<<<<`, `=======` y `>>>>>>>`. Edita el archivo para dejar la versión correcta, borra las marcas, luego `git add archivo` y `git commit`. Si dudas, pide ayuda a quien escribió el otro cambio. |
| Hiciste un commit en `main` por error | No hagas push. Crea una rama desde ahí (`git switch -c feature/AC-NN-...`), sube esa rama y pide ayuda para limpiar `main`. |
| El CI falla en `ruff` | Ejecuta `ruff check .` en `backend/` y corrige lo que indique. |
| `pytest` falla al conectar con la base | `docker start aroma-postgres` y revisa `DATABASE_URL` en `backend/.env`. |
| El frontend no carga datos | Comprueba que el backend esté corriendo en el puerto 8000 y que hayas iniciado sesión. |

---

## 6. Reglas del equipo

1. **Nunca subas** `backend/.env`, contraseñas, tokens ni datos personales. `.gitignore` ya excluye `.env`, `node_modules/` y `dist/`; revisa `git status` antes de cada commit.
2. **No cambies el esquema de la base de datos** sin migración y sin acordarlo con el equipo.
3. **No borres datos** de bases compartidas ni de producción.
4. **Una tarjeta, una rama, una PR.** PRs pequeñas se revisan mejor y generan menos conflictos.
5. **Archivos con riesgo de conflicto:**
   - `frontend/src/services/api.js`
   - `backend/app/main.py`
   - `frontend/src/components/MovementsPage.jsx`
   - `docs/contexto_proyecto.md`

   Si dos personas los van a tocar, avísense y actualicen su rama con `main` a menudo.
6. **No dejes una PR esperando revisión más de un día** sin avisar en el grupo.
7. **Herramientas de IA:** si usas una para ayudarte, revisa y entiende todo el código antes del commit. No incluyas líneas de coautoría automática de la herramienta en los mensajes de commit; las contribuciones deben figurar a nombre de quien hace el trabajo.
8. **Seguimiento diario** con un mensaje corto en el grupo: qué hice, qué haré y si algo me bloquea.

---

## 7. Lista para dar una tarjeta por terminada

- [ ] Hace todo lo que pide la tarjeta.
- [ ] Permisos por rol aplicados en el backend y probados.
- [ ] Pruebas automáticas nuevas o actualizadas; `ruff` y `pytest` en verde.
- [ ] `npm run build` correcto si se tocó el frontend.
- [ ] Flujo documentado en `docs/flows/`.
- [ ] PR revisada y aprobada, con el CI en verde y mergeada a `main`.
- [ ] Tarjeta movida a **Done** en Jira.
