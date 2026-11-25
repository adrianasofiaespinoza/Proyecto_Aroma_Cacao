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

## Qué opción encaja con cada prioridad

- **Menor costo:** el Droplet (~$8) o Fly Developer (~$8), a cambio de más mantenimiento o de backups más débiles.
- **Menos mantenimiento:** Render de pago (~$13), que el equipo ya conoce, o DigitalOcean App Platform (~$20).
- **Mejores backups gestionados:** DigitalOcean Managed PG (PITR de 7 días), Render con el workspace Pro, o Fly Basic (caro).
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
- Si los static sites de Render pueden hacer proxy hacia la API. Si no, el frontend llamaría a la API por su URL, con `CORS_ORIGINS`.

## Decisión

_Pendiente: la toma el equipo._ Al decidir, registrar aquí la opción elegida, el costo aprobado y quién crea la cuenta.

## Fuentes (2026-11-25)

render.com/pricing · render.com/docs/free · render.com/docs/postgresql-backups · render.com/docs/regions · render.com/docs/static-sites · railway.com/pricing · docs.railway.com/pricing/plans · docs.railway.com/reference/backups · docs.fly.io/about/pricing · docs.fly.io/mpg · docs.fly.io/reference/regions · digitalocean.com/pricing/app-platform · digitalocean.com/pricing/managed-databases · digitalocean.com/pricing/droplets · docs.digitalocean.com/products/databases/postgresql/details/features · neon.com/pricing · neon.com/docs/introduction/regions · supabase.com/pricing · vercel.com/legal/terms · vercel.com/docs/plans/hobby · netlify.com/pricing
