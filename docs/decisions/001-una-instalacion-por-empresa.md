# Decisión 001: una instalación por empresa

- **Fecha:** 2026-11-03
- **Estado:** aceptada (decisión de la usuaria; sugerencia del docente de que el sistema se pueda ofrecer a distintas empresas)

## Contexto

Aroma Cacao es la primera empresa donde se usa el sistema, pero el objetivo es poder ofrecerlo a otras empresas adaptando ciertos aspectos. La sección 5 de `docs/contexto_proyecto.md` exige decidir antes de implementar si el sistema tendrá instalaciones independientes o varias empresas dentro de una misma instalación.

Hoy el sistema está atado a Aroma Cacao en:

- El nombre y el subtítulo "Mantenimiento", escritos directamente en las 9 páginas HTML (unas 40 apariciones), el título de la API y `/public/info`.
- El formato regional: fechas `es-EC` y moneda `$`.
- Los catálogos de categorías y unidades, cargados a mano y no editables desde la aplicación.
- Las reglas fijas: aprobación obligatoria de movimientos y módulos siempre activos.

Las reglas centrales (stock, movimientos, alertas, roles) ya son genéricas.

## Opciones

| | A. Una instalación por empresa | B. Multiempresa en una instalación |
|---|---|---|
| Funcionamiento | Servidor y BD propios por empresa; personalización por configuración. | BD compartida; `company_id` en cada dato. |
| Aislamiento | Total. | Depende de filtrar siempre por empresa. |
| Cambios de código | Moderados. | Grandes: todas las tablas, endpoints y pruebas. |
| Operación | Un despliegue por cliente. | Un solo despliegue. |

## Decisión

**Opción A: una instalación por empresa.** No se agrega `company_id` ni filtros multiempresa.

## Consecuencias

Lo que se implementará:

- **Configuración de la empresa**, editable por el `Coordinator`: nombre, logo, subtítulo, colores, moneda, formato de fecha y etiqueta de identificación fiscal (RUC/NIT/RFC).
- **Catálogos editables:** categorías y unidades de medida.
- **Reglas configurables:**
  - autoaprobación de las solicitudes del `Coordinator`;
  - módulos activables (préstamos, máquinas, proveedores), aplicados también en el backend.
- **Instalación de un cliente nuevo:** script que crea la BD, aplica las migraciones, crea el primer `Coordinator` y carga los catálogos básicos, más una guía de despliegue.
- **Migraciones versionadas** (Alembic), para actualizar todas las instalaciones de forma consistente.
- **Importación del inventario** inicial desde un archivo Excel o CSV.

Reglas que se mantienen fijas, porque son la base del sistema:

- El stock solo cambia mediante movimientos autorizados.
- Los tres roles (`Coordinator`, `Operator`, `Read-only`) y la restricción estricta de `Read-only`.
- Las reglas de alertas de stock mínimo.

Un paso futuro a la opción B sigue siendo posible, pero requeriría una nueva decisión.
