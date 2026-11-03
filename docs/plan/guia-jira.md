# Guía: llevar el proyecto Aroma Cacao en Jira

Esta guía está pensada para alguien que nunca ha usado Jira. Al terminarla tendrás el proyecto en Jira con todo lo que ya está hecho, lo que falta y un sprint listo para empezar.

Archivo para importar: `docs/plan/backlog-jira.csv`.

> Jira cambia su interfaz con frecuencia. Si un botón no tiene exactamente el nombre que aparece aquí, busca uno equivalente. Desde 2025, Jira llama **"work items"** (elementos de trabajo) a lo que antes llamaba **"issues"** (incidencias); son lo mismo.

---

## 1. Conceptos básicos

| Concepto | Qué es | En este proyecto |
|---|---|---|
| **Épica** (Epic) | Un bloque grande de trabajo que agrupa muchas tareas. | "Lotes y vencimientos", "Configuración por empresa"… (16 épicas). |
| **Historia** (Story) | Una funcionalidad vista desde el usuario: "como Coordinator quiero…". | "Rechazar solicitudes de movimiento". |
| **Tarea** (Task) | Trabajo técnico que no es una funcionalidad visible. | "Agregar el build del frontend al CI". |
| **Bug** | Algo que funciona mal. | "favicon.ico devuelve 404". |
| **Backlog** | La lista de todo lo pendiente, ordenada por prioridad. | Lo que está en "To Do". |
| **Sprint** | Un período fijo (normalmente 1 o 2 semanas) en el que te comprometes a terminar un grupo de elementos del backlog. | 5 sprints hasta la salida a producción. |
| **Tablero** (Board) | Columnas *To Do → In Progress → Done*. Mueves cada tarjeta según avanza. | Muestra el sprint activo. |
| **Prioridad** | Highest, High, Medium, Low, Lowest. | Ya viene asignada en el CSV. |
| **Etiqueta** (Label) | Una marca libre para filtrar. | `backend`, `frontend`, `sprint-1`, `trabajo-previo`… |

**Cómo se usa Scrum en la práctica:**

1. **Planificación del sprint:** eliges del backlog lo que cabe en el sprint y lo metes en él.
2. **Durante el sprint:** mueves las tarjetas en el tablero a medida que trabajas.
3. **Fin del sprint:** cierras el sprint. Lo que no se terminó vuelve al backlog o pasa al siguiente sprint.
4. **Revisión y retrospectiva:** qué se logró y qué mejorar para el siguiente sprint.

---

## 2. Qué contiene el CSV

El plan lleva el sistema a **producción** como un producto que se puede instalar en distintas empresas (ver `docs/decisions/001-una-instalacion-por-empresa.md`). Tiene 89 elementos:

| | Cantidad |
|---|---|
| Épicas (áreas del sistema) | 16 |
| Trabajo previo, ya terminado (`Done`) | 26 |
| Pendiente, repartido en 5 sprints | 42 |
| Backlog, para después de producción | 5 |

Las etiquetas indican a qué parte del plan pertenece cada elemento:

| Etiqueta | Objetivo | Contenido principal |
|---|---|---|
| `trabajo-previo` | Lo que ya funciona | Todos los módulos, pruebas, CI y backend publicado. |
| `sprint-1` | **Funcionalidad completa** | Lotes y vencimientos, catálogos editables, movimientos con varios productos. |
| `sprint-2` | **Seguridad** | Cerrar el registro público, logout real, límite de intentos, cambio de contraseña. |
| `sprint-3` | **Configuración por empresa** | Migraciones con Alembic, pantalla de configuración, marca configurable, módulos activables, script de instalación. |
| `sprint-4` | **Infraestructura y despliegue** | Hosting, frontend publicado, CORS, BD de producción, copias de seguridad, monitoreo, guía de instalación. |
| `sprint-5` | **Datos, pruebas y salida a producción** | Importación desde Excel/CSV, datos reales, pruebas de aceptación, guía de uso, salida a producción. |
| sin etiqueta de sprint | Backlog | Mejoras para después de producción. |

Con sprints de 2 semanas, el plan completo dura unas 10 semanas. Es una estimación: ajústala según lo que avance cada sprint.

---

## 3. Crear la cuenta y el proyecto

1. Entra en <https://www.atlassian.com/software/jira/free> y crea una cuenta gratuita (hasta 10 usuarios).
2. Elige un nombre para tu sitio, por ejemplo `aromacacao` (quedará `aromacacao.atlassian.net`).
3. Si te pregunta qué tipo de trabajo haces, elige *Software development*.
4. Crea un proyecto: **Projects → Create project → Scrum**.
   - Si te pregunta el tipo, elige **Team-managed** (más sencillo para empezar).
   - Nombre: `Aroma Cacao`. Clave (key): `AC`. Las tarjetas se llamarán `AC-1`, `AC-2`…
   - Si Jira no pregunta la clave y asigna otra automáticamente, cámbiala después en **Space settings → Details → Key**. Jira renombra las tarjetas y los enlaces antiguos siguen funcionando.

---

## 4. Importar el CSV

1. Abre el proyecto y busca la opción de importar. Según la versión aparece en:
   - el menú **⋯** (más acciones) del **Backlog** → **Import work items / Import issues**, o
   - **⚙ Settings → System → External system import → CSV**.
2. Sube `docs/plan/backlog-jira.csv`. Codificación **UTF-8**, separador **coma**.
3. Elige el proyecto **Aroma Cacao**.
4. **Asigna las columnas** a los campos de Jira:

   | Columna del CSV | Campo de Jira |
   |---|---|
   | Issue ID | Issue ID / Work item ID |
   | Issue Type | Issue Type / Work type |
   | Summary | Summary |
   | Status | Status |
   | Priority | Priority |
   | Parent | Parent |
   | Description | Description |
   | Labels (las 4 columnas) | Labels |

   `Issue ID` y `Parent` son los que vinculan cada historia con su épica: `Parent` contiene el `Issue ID` de la épica. Esos números son temporales y Jira asignará después las claves `AC-…`.
5. Si Jira pide **asignar valores** (mapear estados):
   - `To Do` → *To Do* (o *Por hacer* si Jira está en español).
   - `Done` → *Done* (o *Listo* / *Hecho*).
6. Ejecuta la importación y revisa el resumen. Debería indicar 89 elementos creados.

**Si algo falla:**
- *"Parent no está disponible para mapear":* crea el proyecto como **Company-managed** e importa desde **⚙ Settings → System → External system import → CSV**.
- *Las épicas quedan sueltas:* puedes vincularlas a mano abriendo cada historia → campo **Parent** → elegir la épica.
- *El estado no se aplicó:* busca la etiqueta `trabajo-previo`, selecciona todo y cámbialo a *Done* con la edición masiva (**Bulk change**).

---

## 5. Recorrer lo importado

- **Backlog:** muestra lo pendiente (*To Do*). Los elementos *Done* no aparecen en el backlog; búscalos en la vista **List** o en **Filters → Advanced search**.
- **Panel de épicas:** en el Backlog, activa el panel **Epic**. Ahí verás cada épica con su barra de progreso, que muestra cuánto falta en cada bloque del proyecto.
- **Filtrar por etiqueta:** en la búsqueda del backlog o con JQL:

  ```
  project = AC AND labels = "sprint-1" ORDER BY priority DESC
  ```

---

## 6. Planificar y empezar el Sprint 1

1. En **Backlog**, pulsa **Create sprint**.
2. Filtra por la etiqueta `sprint-1` (8 elementos).
3. Arrastra esos elementos al sprint. Puedes seleccionar varios con **Shift** o **Ctrl/Cmd**.
4. Revisa la carga: si te parece demasiado para dos semanas, deja en el backlog los de menor prioridad.
5. Pulsa **Start sprint**:
   - **Nombre:** `Sprint 1 – Funcionalidad completa`
   - **Duración:** 2 semanas
   - **Objetivo del sprint:** *"Cubrir todos los requisitos del README: lotes y vencimientos, catálogos editables y movimientos con varios productos."*
6. Ve a **Board**: verás el sprint en columnas.

Cuando termine, repite el proceso con `sprint-2`, `sprint-3`, etc. **Crea cada sprint solo cuando vayas a empezarlo:** así puedes ajustar su contenido con lo que aprendiste en el anterior.

El trabajo previo no necesita un sprint: queda registrado con el estado *Done* y la etiqueta `trabajo-previo`.

---

## 7. Trabajo diario con el tablero

1. Cuando empieces una tarea, arrástrala a **In Progress**.
2. Cuando esté terminada y verificada (pruebas en verde, PR mergeada), muévela a **Done**.
3. Si aparece trabajo nuevo, créalo con **+ Create**: elige el tipo, la épica (*Parent*) y la prioridad. Si no es para este sprint, déjalo en el backlog.
4. Al terminar el período, pulsa **Complete sprint**. Jira pregunta qué hacer con lo no terminado: pásalo al siguiente sprint o devuélvelo al backlog.
5. En **Reports** (si tu proyecto lo tiene) verás el gráfico de avance del sprint.

**Criterio de "Done" para este proyecto** (acordado en `docs/contexto_proyecto.md`):

- Implementado y con pruebas automáticas en verde.
- Flujo documentado en `docs/flows/`.
- PR revisada, con CI en verde y mergeada a `main`.

---

## 8. Cómo trabajaremos juntos

- Cuando me pidas una tarea, dime su clave (`AC-12`). Usaré esa clave en el nombre de la rama y en el mensaje del commit, por ejemplo `feature/AC-12-logout-token`.
- Al terminar, te diré qué tarjetas puedes mover a *Done*.
- **Opcional:** si instalas la app **GitHub for Jira** (desde *Apps → Explore more apps*), Jira mostrará automáticamente en cada tarjeta los commits y las PRs que mencionen su clave.

Si aparecen tareas nuevas, puedo generarte otro CSV solo con ellas para importarlas, en lugar de crearlas a mano.
