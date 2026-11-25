# Decisión 002: hosting de producción

- **Fecha:** 2026-11-25
- **Estado:** **propuesta: la decisión es del equipo** (tarjeta «Elegir el hosting de producción», Emma)
- **Fuente de los precios:** páginas oficiales de cada proveedor, revisadas el 2026-11-25 (lista al final). Los totales son estimaciones: no están publicados así.

## Contexto

- Hoy la API está en el plan gratuito de Render. Duerme tras 15 minutos sin tráfico, y su PostgreSQL gratuito **vence a los 30 días** (con 14 de gracia) y **no tiene backups**. La BD actual se creó a mediados de noviembre de 2026.
- Cada empresa cliente tiene su propia instalación (decisión 001), así que el **costo es por instalación**.
- Uso esperado: 5 a 20 personas por empresa, poco tráfico, en Ecuador.
- **El plan Hobby de Vercel no se puede usar para clientes que pagan.** Sus términos lo limitan a «personal or non-commercial use». Vercel Pro cuesta $20 por usuario al mes.

## Opciones

Supuestos: una API siempre encendida con 512 MB, una BD pequeña (≤10 GB), poco tráfico y sin impuestos.

| Opción | API | BD | Backups | Frontend | Total por mes (aprox.) |
|---|---|---|---|---|---|
| 1. Render de pago | Starter, $7 | basic-256mb, $6, más $0.30/GB | PITR de 3 días en Hobby, 7 en Pro ($25/mes por workspace) | Static site de Render, gratis | **~$13** |
| 2. Railway | Por uso. Hobby desde $5 con $5 de crédito | Contenedor con volumen, $0.15/GB más su consumo | Diarios, semanales y mensuales; al parecer solo en Pro (no confirmado) | Railway, o externo | **~$5–10** sin backups; **~$20+** en Pro |
| 3. Fly.io + Managed Postgres | shared-cpu-1x 512 MB, ~$3.69 | Developer $4 (sin PITR) o Basic $38 | 10 días con PITR en Basic; un backup diario en Developer | Externo | **~$8** o **~$42–45** |
| 4a. DigitalOcean App Platform + Managed PG | $5 | $15.15 | Diario y PITR de 7 días | 3 static sites gratis | **~$20** |
| 4b. DigitalOcean Droplet con Docker | $6, todo en un servidor | La administra el equipo | Imagen de disco diaria (+30%); además `pg_dump` propio | El mismo servidor | **~$8** |
| 5. Render Starter + Neon Launch | $7 | Por uso, $0.35/GB, más el cómputo | Restauración de hasta 7 días | Static site de Render | **~$9–10** (BD que se apaga sin uso) o **~$27** (siempre encendida) |

### 6. Cloudflare: solo para el frontend

Cloudflare no sirve como hosting completo, pero **Cloudflare Pages** encaja para el frontend y se combina con cualquiera de las opciones anteriores para la API y la BD.

- **Pages, plan gratuito:** 500 builds al mes, 100 proyectos por cuenta y 100 dominios propios por proyecto. Las peticiones a los archivos estáticos son gratis e ilimitadas y no hay cobro por ancho de banda.
- **Uso comercial:** los términos generales de Cloudflare (Self-Serve Subscription Agreement) no lo prohíben en el plan gratuito, a diferencia de Vercel Hobby. No hay términos propios de Pages en su lista de términos por servicio.
- **Conexión con la API:** el archivo `_redirects` de Pages **no puede reenviar a un dominio externo** («You cannot proxy external domains»). Hay dos caminos:
  - Una **Pages Function** que reenvíe `/auth`, `/users`, `/products`, etc. a la API. No cambia el código del frontend. Cada llamada a la API cuenta para el límite gratuito de Workers: **100 000 peticiones al día**, de sobra para 5 a 20 personas.
  - Que el frontend llame a la API por su URL, con `CORS_ORIGINS`. Requiere un cambio pequeño en `frontend/src/api/client.ts`, que hoy usa rutas relativas. Las sesiones no usan cookies, así que CORS no complica el inicio de sesión.
- **API en Cloudflare: no encaja.** Los Workers de Python admiten FastAPI, pero solo paquetes puros de Python o compilados para Pyodide; `psycopg` no aparece como compatible y Cloudflare recomienda conectarse a PostgreSQL con Hyperdrive. Habría que reescribir el acceso a la BD. **Cloudflare Containers** sí podría correr la API sin cambios, pero exige el plan Workers Paid (mínimo **$5/mes**) más el consumo por CPU, memoria y disco.
- **BD en Cloudflare: no hay PostgreSQL propio.** D1 es SQLite. Hyperdrive solo conecta con un PostgreSQL de otro proveedor (incluido gratis, 100 000 consultas al día). Desde Cloudflare se puede crear un PostgreSQL de PlanetScale, con los precios de PlanetScale.

**Costo:** el frontend en Pages es **$0**, así que el total es el de la opción elegida para la API y la BD. Por ejemplo, Render de pago (opción 1) con el frontend en Pages sigue en **~$13**.

## Qué opción encaja con cada prioridad

- **Menor costo:** el Droplet (~$8) o Fly Developer (~$8), a cambio de más mantenimiento o de backups más débiles.
- **Menos mantenimiento:** Render de pago (~$13), que el equipo ya conoce, o DigitalOcean App Platform (~$20).
- **Mejores backups gestionados:** DigitalOcean Managed PG (PITR de 7 días), Render con el workspace Pro, o Fly Basic (caro).
- **Frontend gratis con uso comercial:** Cloudflare Pages (opción 6), junto con cualquiera de las opciones para la API y la BD.
- **Cercanía a Ecuador:** Fly.io y Neon tienen región en São Paulo. Render, Railway y DigitalOcean no tienen región en Latinoamérica; las más cercanas son Virginia y Ohio.

## Lo que ya no depende de esta decisión

- **Copias diarias cifradas, guardadas 30 días,** con GitHub Actions (`docs/operacion/copias-de-seguridad.md`). Funcionan con cualquier hosting que dé una URL externa de la BD.
- **Monitoreo de `/health`** con UptimeRobot (`docs/operacion/monitoreo.md`).
- **CORS por variable de entorno** (`CORS_ORIGINS`), para el dominio de cada instalación.

## Sin confirmar en páginas oficiales

- Que los backups de Railway sean solo para el plan Pro.
- El precio de Fly.io en la región de São Paulo (gru).
- Si los backups y el PITR de DigitalOcean Managed PG están incluidos en el precio.
- Si el plan gratuito de Netlify permite uso comercial.
- Si existe un paquete de `psycopg` compatible con los Workers de Python (no aparece en la documentación).
- Si Cloudflare Containers ya es una versión estable o sigue en beta (sus páginas no lo indican).
- Si los static sites de Render pueden hacer proxy hacia la API. Si no, el frontend llamaría a la API por su URL, con `CORS_ORIGINS`.

## Decisión

_Pendiente: la toma el equipo._ Al decidir, registrar aquí la opción elegida, el costo aprobado y quién crea la cuenta.

## Fuentes (2026-11-25)

render.com/pricing · render.com/docs/free · render.com/docs/postgresql-backups · render.com/docs/regions · render.com/docs/static-sites · railway.com/pricing · docs.railway.com/pricing/plans · docs.railway.com/reference/backups · docs.fly.io/about/pricing · docs.fly.io/mpg · docs.fly.io/reference/regions · digitalocean.com/pricing/app-platform · digitalocean.com/pricing/managed-databases · digitalocean.com/pricing/droplets · docs.digitalocean.com/products/databases/postgresql/details/features · neon.com/pricing · neon.com/docs/introduction/regions · supabase.com/pricing · vercel.com/legal/terms · vercel.com/docs/plans/hobby · netlify.com/pricing · developers.cloudflare.com/pages/platform/limits · developers.cloudflare.com/pages/configuration/redirects · developers.cloudflare.com/pages/functions/pricing · developers.cloudflare.com/workers/platform/pricing · developers.cloudflare.com/workers/languages/python/packages · developers.cloudflare.com/workers/runtime-apis/tcp-sockets · developers.cloudflare.com/containers/platform/pricing · developers.cloudflare.com/hyperdrive/platform/pricing · developers.cloudflare.com/d1 · cloudflare.com/terms
