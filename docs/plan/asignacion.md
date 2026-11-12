# Reparto de tareas por sprint

Para: **Adriana, Tamya y Emma**. Indica quién hace cada tarjeta de `docs/plan/backlog-jira.csv` en cada sprint. Cómo hacer cada tarea se explica en `docs/plan/guia-trabajo-equipo.md`.

Es una propuesta para arrancar: en la planificación de cada sprint se pueden intercambiar tarjetas según cómo haya ido el anterior. Si hay diferencias, lo que manda es el responsable (*Assignee*) de la tarjeta en Jira.

## Criterio

Las áreas rotan: en cada sprint cada persona toca algo distinto, para que al final las tres hayan trabajado en backend, frontend, base de datos e infraestructura. Las tareas que dependen una de otra quedan con la misma persona cuando es posible, y la carga es parecida entre las tres.

## Sprint 1: Funcionalidad completa

| Persona | Tarjetas |
|---|---|
| **Adriana** | Registrar lotes con fecha de vencimiento · Las entradas y salidas con lote actualizan la cantidad del lote · Seleccionar lote al registrar movimientos · Aviso de lotes próximos a vencer |
| **Tamya** | Crear y editar categorías y unidades de medida · Reactivar productos desactivados |
| **Emma** | Movimientos con varios productos desde la pantalla · Rechazar ajustes con el mismo producto repetido |

El aviso de lotes próximos a vencer estaba pensado para Tamya, pero se hizo junto con el resto de los lotes.

## Sprint 2: Seguridad

| Persona | Tarjetas |
|---|---|
| **Adriana** | Limitar los intentos de inicio de sesión · Empezar las migraciones versionadas con Alembic (la tarjeta es del Sprint 3, pero todo ese sprint depende de ella) |
| **Tamya** | Invalidar el token de acceso al cerrar sesión · Revisar la renovación concurrente de refresh tokens · Prueba de que Recordarme se conserva al rotar tokens |
| **Emma** | Cerrar el registro público · Cambio de contraseña por el propio usuario · Garantizar que siempre exista al menos un Coordinator activo |

## Sprint 3: Configuración por empresa

| Persona | Tarjetas |
|---|---|
| **Adriana** | Terminar las migraciones con Alembic · Script de instalación para una empresa nueva |
| **Tamya** | Configuración de la empresa en la BD y su endpoint · Pantalla de configuración de la empresa · Activar o desactivar módulos por empresa |
| **Emma** | Quitar el nombre Aroma Cacao fijo del código · Moneda y formato de fecha según la configuración · Autoaprobación configurable de solicitudes del Coordinator · favicon.ico devuelve 404 |

## Sprint 4: Infraestructura y despliegue

| Persona | Tarjetas |
|---|---|
| **Adriana** | BD de producción con migraciones aplicadas · Copias de seguridad automáticas de la BD · Guía de instalación para una empresa nueva |
| **Tamya** | Registros de errores y monitoreo de /health · Agregar al CI el build del frontend y las pruebas sin BD · PostgreSQL en el CI para las pruebas de integración · Limpiar archivos residuales y ramas ya mergeadas |
| **Emma** | Elegir el hosting de producción · Publicar el frontend junto con la API · Orígenes de CORS por variable de entorno |

## Sprint 5: Datos, pruebas y salida a producción

| Persona | Tarjetas |
|---|---|
| **Adriana** | Limpiar los datos de prueba de la BD · Cargar los datos reales de Aroma Cacao · Salida a producción |
| **Tamya** | Importar el inventario desde Excel o CSV |
| **Emma** | Pruebas de concurrencia de autorizaciones y préstamos · Índice único para evitar alertas activas duplicadas · Guía de uso por rol |
| **Las tres** | Prueba de aceptación con el personal por rol: cada una toma un rol (Coordinator, Operator o Read-only) |

## Después de producción

Las 5 tarjetas del backlog sin etiqueta de sprint no tienen responsable todavía. Se asignan si se deciden hacer.

## Revisión de PRs

Cada PR la aprueba siempre la misma persona, para que nadie revise su propio trabajo y cada una conozca bien el código de otra:

| Autora | Revisa |
|---|---|
| Tamya | Adriana |
| Emma | Tamya |
| Adriana | Emma |

## Cómo hacer una tarea con IA

Usar una herramienta de IA es opcional. Quien la usa sigue siendo responsable del resultado: revisa y entiende todo el código antes del commit.

1. Mueve la tarjeta a *In Progress* y crea tu rama, como indica `docs/plan/guia-trabajo-equipo.md`.
2. Copia el texto de abajo en la IA, con la clave y el nombre de tu tarjeta al final.
3. Lee el plan que te proponga y apruébalo antes de que programe.
4. Ejecuta las pruebas tú misma y prueba en el navegador con los roles afectados.
5. Lee los cambios hasta poder explicarlos y haz el commit, sin líneas de atribución a la IA.
6. Abre la PR para que la revise tu compañera asignada.

### Texto para copiar

```text
Trabajas en el sistema de inventario Aroma Cacao.
Antes de cambiar nada, lee docs/contexto_proyecto.md y
docs/plan/guia-trabajo-equipo.md, y explícame tu plan.

Reglas:
- Haz solo esta tarea, en la rama actual.
- Si falta una regla de negocio, pregúntame; no la inventes.
- No hagas commit, push ni merge; eso lo hago yo.
- No cambies la base de datos sin una migración y sin mi aprobación.
- No borres datos ni archivos sin preguntar.
- No leas ni muestres backend/.env, contraseñas ni tokens.
- No borres backend/app/reset_password.py ni lo conviertas en un endpoint.
- Los permisos se aplican en el backend, no solo en la interfaz.
- Agrega pruebas y documenta el flujo en docs/flows/.
- Al terminar, dime qué cambiaste, qué comandos ejecutaste con su
  resultado y qué debo probar en el navegador.

Tarea:
- Tarjeta: [clave y nombre de la tarjeta en Jira]
- Lee su descripción en docs/plan/tareas.md
```

### Lo que no se le deja a la IA

| Tarjeta | Lo que hace la persona |
|---|---|
| Elegir el hosting de producción | Decide según el costo y crea la cuenta. La IA solo compara opciones. |
| BD de producción y salida a producción | Ejecuta los pasos con las credenciales reales, que no se le pasan a la IA. |
| Limpiar los datos de prueba y cargar los datos reales | Revisa y aprueba el script, y saca una copia antes. No pegues datos reales en la IA sin permiso de la empresa. |
| Prueba de aceptación con el personal | La hace con el personal, cada una con un rol. |

## Cómo llevarlo a Jira

1. Invita a Tamya y Emma al proyecto: **Space settings → Access / People → Add people**, con sus correos.
2. Antes de empezar cada sprint, pon el responsable en el campo **Assignee** de cada tarjeta. Conviene hacerlo juntas en la planificación, porque sirve de repaso del sprint.
3. Si una tarea depende de otra, enlázalas con **Link → is blocked by** para que se vea en el tablero.
