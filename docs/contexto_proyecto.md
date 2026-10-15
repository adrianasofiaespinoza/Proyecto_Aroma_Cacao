# Contexto del proyecto: Aroma Cacao

## 1. Objetivo

Sistema web de gestión de inventario para Aroma Cacao.
- Repositorio: https://github.com/adrianasofiaespinoza/Proyecto_Aroma_Cacao
- Ruta local: `~/Documents/Proyecto_aroma_cacao`
- Entorno: CachyOS Linux, terminal Fish

## 2. Stack tecnológico

- Frontend: React
- Backend: FastAPI
- Base de datos: PostgreSQL
- ORM: SQLAlchemy
- Estilos: Tailwind CSS
- Autenticación: JWT (`python-jose`)
- Hashing de contraseñas: `pwdlib` (Argon2)
- Validación de datos: Pydantic

## 3. Estado actual del sistema

### A. Funcionalidades confirmadas por código y probadas en tests unitarios
- **Autenticación y seguridad (Completado)**:
  - Eliminados endpoints de prueba `/test-users` y `/test-db` en [`backend/app/main.py`](../backend/app/main.py); añadido endpoint `/health` seguro.
  - Validación obligatoria de `JWT_SECRET` (mínimo 32 caracteres) y carga consistente de `.env` en [`backend/app/security/jwt.py`](../backend/app/security/jwt.py).
  - Inclusión de claim único `jti` (UUID) en tokens access y refresh para garantizar unicidad y evitar colisiones de hash.
  - Parseo seguro de `sub` a `int` con manejo de excepciones en [`backend/app/security/auth.py`](../backend/app/security/auth.py) y [`backend/app/routers/auth.py`](../backend/app/routers/auth.py), retornando HTTP 401 Unauthorized en lugar de 500 ante tokens inválidos.
  - Rotación real de refresh tokens en `/auth/refresh` (revoca atómicamente el token previo y emite uno nuevo).
  - Cálculo dinámico de `expires_in` a partir de `ACCESS_TOKEN_MINUTES * 60` tanto en login como en refresh.
  - Protección contra colisiones de concurrencia en `/auth/register` capturando `IntegrityError` y retornando HTTP 409 Conflict.
  - Sincronización completa de [`.env.example`](../.env.example) con las variables reales del backend.
  - Eliminación de advertencias de deprecación de `datetime.utcnow()` reemplazándolas con `datetime.now(timezone.utc)`.
- **Productos**:
  - Modelos [`Product`](../backend/app/models/product.py), [`Category`](../backend/app/models/product.py) y [`UnitOfMeasure`](../backend/app/models/product.py).
  - CRUD con control de roles (`Coordinator` para mutaciones, autenticado para lectura) en [`products.py`](../backend/app/routers/products.py).
- **Movimientos de inventario**:
  - Modelos [`Movement`](../backend/app/models/movement.py) y [`MovementDetail`](../backend/app/models/movement.py).
  - Tipos `ENTRY`, `EXIT`, `ADJUSTMENT`.
  - Flujo de aprobación (`pending` -> autorizado por `Coordinator`) en [`movements.py`](../backend/app/routers/movements.py).
  - Validación de cantidad `gt=0` en detalles.
- **Alertas**:
  - Modelo [`Alert`](../backend/app/models/alert.py) y router [`alerts.py`](../backend/app/routers/alerts.py). Creación automática al autorizar movimiento si stock <= stock mínimo.

### B. Funcionalidades pendientes de verificar / corregir
- **Movimientos y stock**:
  - Bloqueo pesimista (`with_for_update`) al autorizar movimientos para evitar condiciones de carrera en el stock.
  - Validar si el producto está inactivo al momento de autorizar un movimiento pendiente.
  - Validar lotes y máquinas asociados al producto y sus estados.
  - Clarificar lógica de `ADJUSTMENT` (si representa stock absoluto o diferencial).
- **Base de datos física y entorno local**:
  - Confirmar si el servicio PostgreSQL local está activo y si las tablas de [`schema.sql`](../database/schema.sql) ya fueron creadas.
  - Verificar Swagger en vivo con FastAPI en ejecución.
- **Frontend**:
  - Revisar conexión del cliente React con el backend y almacenamiento de tokens.

### C. Funcionalidades probadas en ejecución con base de datos real
- *Pendiente de verificar contra PostgreSQL local.*

## 4. Instrucciones de trabajo

1. No revisar el proyecto desde cero. Usar este documento como base.
2. Distinguir siempre entre:
   - Funcionalidad confirmada por el código revisado.
   - Funcionalidad probada en ejecución.
   - Funcionalidad pendiente de verificar.
3. Explicar el problema y el cambio antes de modificar código.
4. Cambios pequeños, atómicos y compatibles con el stack.
5. Comandos para terminal Fish (ej. `source .aroma_cacao/bin/activate.fish`).
6. Al completar un bloque de trabajo importante, actualizar este documento.
