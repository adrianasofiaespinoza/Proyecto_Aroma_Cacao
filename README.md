# Aroma Cacao: Inventory Management System

A web application for managing the tools, spare parts, supplies, equipment, and materials of a maintenance department. It records stock levels, requires authorization before stock changes, raises low-stock alerts, and keeps a record of who requested and authorized each movement.

The system is being built and validated with **Aroma Cacao S.A.**, an Ecuadorian cocoa exporter. It is designed to be reused by other companies: each company gets its own installation with its own configuration (see [docs/decisions/001-una-instalacion-por-empresa.md](docs/decisions/001-una-instalacion-por-empresa.md)).

- **Public API:** <https://aroma-cacao.onrender.com> (health check at `/health`, interactive docs at `/docs`)
- **Detailed project status:** [docs/contexto_proyecto.md](docs/contexto_proyecto.md)

---

## Features

| Module | What it does |
|---|---|
| **Authentication** | Email and password login, JWT access tokens, refresh tokens with rotation and revocation, and "Remember me". |
| **Users and roles** | Coordinators create and deactivate users. Deactivating a user revokes their sessions. |
| **Products** | Create, edit, search, and deactivate products (they are never deleted). Products have categories, units, and minimum and maximum stock levels. |
| **Inventory movements** | Entries, exits, and adjustments are created as **pending** requests. Stock changes only when a Coordinator **authorizes** a request, and a rejected request has no effect. |
| **Low-stock alerts** | An alert is raised when `current_stock <= minimum_stock` and resolved automatically when the stock recovers. |
| **Lots and expiration** | Products can require lot tracking. Each lot has an expiration date and a remaining quantity, expired lots cannot be used, and lots close to expiring are flagged. |
| **Machines** | Machines with location and compatible spare parts. Exits can record the destination machine. |
| **Tool loans** | Loans to workers (who do not need an account) and returns. A loan does not change the stock: *available = stock − loaned*. |
| **Suppliers** | Supplier contacts and reference prices per product. |
| **Dashboard** | Active products, low stock, pending movements, loaned tools, and expiring lots. |

### Roles

| | Coordinator | Operator | Read-only |
|---|:---:|:---:|:---:|
| View inventory, movements, and reports | ✓ | ✓ | ✓ |
| Request movements | ✓ | ✓ | |
| Authorize or reject movements | ✓ | | |
| Register loans and returns | ✓ | ✓ | |
| Manage products, machines, suppliers, and users | ✓ | | |

Permissions are enforced by the backend, not only hidden in the interface.

### Key business rules

- Stock is never edited directly; it only changes through authorized movements.
- An exit that exceeds the available quantity is always rejected.
- A reason is required for exits and adjustments.
- An adjustment records the quantity counted in the warehouse. When it is authorized, stock becomes *counted + loaned*.

Each module's rules, endpoints, and tests are documented in [docs/flows/](docs/flows/).

### Out of scope

Email or SMS notifications, export to Excel or PDF, advanced analytics, full purchase-order or work-order modules, ERP integration, a native mobile app, and social login.

---

## Technology

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Bootstrap Icons |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Security | JWT (`python-jose`), Argon2id password hashing (`pwdlib`) |
| Database | PostgreSQL 17 (Docker) |
| Quality | pytest, Ruff, GitHub Actions |
| Deployment | Render (API) |

```
Browser (React)  ──HTTP/JSON──>  FastAPI REST API  ──SQLAlchemy──>  PostgreSQL
```

---

## Project structure

```
backend/      FastAPI application (app/) and tests (tests/)
frontend/     React pages (one HTML entry per page) and the API client
database/     schema.sql and numbered SQL migrations
docs/         project status, flows, decisions, and the work plan
.github/      CI workflow and pull request template
```

---

## Getting started (local development)

Requirements: Git, Docker, Python 3.12+, and Node.js 20+.

**1. Database**

```bash
docker run -d --name aroma-postgres \
  -e POSTGRES_USER=aroma_user -e POSTGRES_PASSWORD=YOUR_PASSWORD \
  -e POSTGRES_DB=aroma_inventory \
  -p 5432:5432 -v aroma_pgdata:/var/lib/postgresql/data postgres:17

docker exec -i aroma-postgres psql -U aroma_user -d aroma_inventory < database/schema.sql
```

If your database was created from an older `schema.sql`, apply the files in `database/migrations/` in order.

**2. Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # set DATABASE_URL and JWT_SECRET (at least 32 characters)
uvicorn app.main:app --reload
```

Check that <http://127.0.0.1:8000/health> returns `{"status":"ok"}`. The API documentation is at <http://127.0.0.1:8000/docs>.

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173/login.html>. Vite forwards API requests to the local backend.

The step-by-step team guide, including creating the first Coordinator account, is in [docs/plan/guia-trabajo-equipo.md](docs/plan/guia-trabajo-equipo.md).

---

## Tests and CI

```bash
cd backend
ruff check .
pytest -v
```

Some tests need the local PostgreSQL database. They run inside a transaction that is rolled back, so the data is not changed.

GitHub Actions runs Ruff and the tests that do not need a database on every pull request to `main`. `main` is protected: changes need a pull request and a passing `validate` check. Every merge to `main` is deployed to Render automatically.

---

## Status and roadmap

All the modules listed above are implemented, covered by automated tests, and connected to the interface. Lots and expiration are under review before they are merged into `main`.

Next steps, planned in five sprints:

1. **Complete features:** editable catalogs, movements with several products, and reactivating products.
2. **Security:** close public registration, invalidate access tokens on logout, limit login attempts, and let users change their password.
3. **Per-company configuration:** versioned migrations, company settings and branding, optional modules, and an installation script.
4. **Infrastructure:** production hosting for the frontend and database, backups, and monitoring.
5. **Go-live:** import from Excel or CSV, real data, acceptance testing with staff, and user guides.

The full backlog is in [docs/plan/](docs/plan/). For verified versus pending items, see [docs/contexto_proyecto.md](docs/contexto_proyecto.md).

---

## Documentation

| Path | Content |
|---|---|
| [docs/contexto_proyecto.md](docs/contexto_proyecto.md) | Current status, decisions, and working rules |
| [docs/flows/](docs/flows/) | Behavior of each module: rules, endpoints, errors, and tests |
| [docs/decisions/](docs/decisions/) | Architecture decisions |
| [docs/plan/](docs/plan/) | Backlog, Jira guide, and team workflow |
| [docs/authentication.md](docs/authentication.md) | Authentication details |
