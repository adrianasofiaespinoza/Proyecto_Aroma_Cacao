# Configuración de la empresa

Cada empresa tiene su propia instalación, con su servidor y su base de datos (`docs/decisions/001-una-instalacion-por-empresa.md`). Lo propio de cada empresa se guarda en la tabla `company_settings`, que tiene una sola fila (`id = 1`) y se crea con la revisión `0004` de Alembic.

## Qué se configura

| Dato | Reglas |
|---|---|
| Nombre y nombre corto | Obligatorios. Hasta 100 y 40 caracteres. El corto se ve en el menú y en la pestaña del navegador («Sistema de mantenimiento · Aroma Cacao»). |
| Subtítulo | Opcional, hasta 60 caracteres (por ejemplo, «Mantenimiento»). |
| Identificación fiscal | La etiqueta (RUC, NIT, RFC…) y el número. La etiqueta es pública: se usa en Proveedores. **El número no se publica sin sesión.** |
| Logo | PNG, JPG, WebP o SVG de hasta 200 KB. Se guarda en la BD porque el disco de Render gratuito no persiste. También es el icono de la pestaña. |
| Color principal y de acento | Hexadecimal (`#1d4e7a`). El principal debe tener contraste ≥ 4.5 con el blanco; el acento, ≥ 3 con el fondo del menú. Los otros 9 tonos del tema se calculan a partir de estos dos; en el tema oscuro también los fondos y los grises toman el matiz de la empresa. |
| Moneda | De una lista: USD, EUR, MXN, COP, PEN, CLP, ARS, GTQ, CRC, DOP, BOB, PYG, UYU. Define también el separador decimal. |
| Formato de fecha | `dd/mm/aaaa`, `mm/dd/aaaa` o `aaaa-mm-dd`. |
| Módulos | Préstamos, Máquinas y Proveedores, activos por defecto. |
| Autoaprobación del Coordinator | Desactivada por defecto. |

## Quién la cambia

La marca, la moneda y los módulos son parte del servicio que el equipo de desarrollo vende e instala, no de la empresa cliente (decisión de la usuaria, 2026-11-25):

- **Soporte** (`Support`, revisión `0005`): la cuenta del equipo de desarrollo en cada instalación. Ve **Configuración** completa y consulta el resto del sistema en modo lectura. No crea, autoriza ni presta nada, así que su nombre nunca aparece en el historial de la empresa.
- **La empresa no lo ve:** `GET /users` no lista las cuentas de soporte, `PUT /users/{id}` responde `404` con ellas y nadie puede asignar el rol desde la API (`422`). Se crean por consola con `app/create_support.py` o con el instalador.
- **Pendiente de decidir:** si la cuenta de soporte debe dejar de ver los datos del cliente (solo **Configuración**) o si la configuración pasa a hacerse solo por consola. Ver `docs/contexto_proyecto.md`, E6.
- **Coordinator de la empresa:** en **Configuración** solo ve la regla de **autoaprobación** (`GET` y `PUT /settings/rules`).

Una instalación nueva empieza con valores genéricos («Mi empresa» y la paleta verde original). La de Aroma Cacao ya está configurada en la BD local y en la de Render.

## Endpoints

| Método y ruta | Quién | Para qué |
|---|---|---|
| `GET /settings/public` | Cualquiera, sin sesión | Nombre, logo, colores, formato y módulos. Lo usa el login antes de iniciar sesión. Incluye la etiqueta fiscal, pero no el número ni la autoaprobación. |
| `GET /settings` | Support | Todos los datos. |
| `PUT /settings` | Support | Guarda todo menos el logo. |
| `PUT /settings/logo` | Support | Sube el logo como data URL (`data:image/png;base64,…`). |
| `DELETE /settings/logo` | Support | Quita el logo. |
| `GET` y `PUT /settings/rules` | Coordinator o Support | La autoaprobación del Coordinator. |
| `GET /settings/logo` | Cualquiera | La imagen, con `nosniff` y una CSP que impide ejecutar scripts de un SVG. |
| `GET /favicon.ico` | Cualquiera | El logo, o un icono genérico si no hay. |

Un valor fuera de la lista, un color mal escrito o con poco contraste responde `422`. El backend comprueba que el contenido del logo corresponda a su tipo.

## Módulos activables

- Con un módulo desactivado, sus endpoints responden **`403`** con `The <Module> module is disabled in this installation` (decisión de la usuaria). Préstamos incluye `/loans` y `/workers`.
- El menú lo oculta, sus rutas vuelven al inicio y el dashboard quita su indicador. En Nueva solicitud, sin Máquinas desaparece «Máquina destino».
- **Los datos no se borran:** al activarlo de nuevo, todo sigue ahí.
- **No se puede desactivar Préstamos con herramientas prestadas** (`409`). Si se permitiera, el stock disponible bajaría sin explicación visible: el backend sigue descontando lo prestado.
- Productos, movimientos, lotes, alertas y el dashboard funcionan con los tres módulos desactivados.

## Autoaprobación del Coordinator

Si la opción está activa y un **Coordinator** crea una solicitud:

1. Se crea la solicitud como siempre.
2. Se autoriza en el mismo momento con `apply_authorization`, la misma función de la autorización manual. Se aplican las mismas validaciones de stock disponible, lotes y productos inactivos, y se actualizan las alertas.
3. En el historial, el Coordinator queda como quien la solicitó y como quien la autorizó.
4. **Si no pasa una validación, queda pendiente** y la respuesta trae `auto_authorize_error` con el motivo. El stock no cambia. La pantalla avisa: «Quedó pendiente: no se pudo autorizar automáticamente».

Las solicitudes de los Operators siempre quedan pendientes.

## Instalación para una empresa nueva

Desde `backend/`, con `DATABASE_URL` apuntando a la BD nueva y vacía:

```fish
set -x PYTHONPATH .
python app/install.py
```

El script:

1. Aplica las migraciones de Alembic. Si la base tiene tablas pero no está versionada, se detiene y explica cómo hacer el `alembic stamp 0001`.
2. Agrega las categorías y unidades básicas que falten.
3. Pide el nombre de la empresa si todavía tiene el genérico.
4. Crea el primer Coordinator si no hay ninguno activo. La contraseña se pide por teclado y nunca va en argumentos ni en archivos.
5. Ofrece crear la cuenta de soporte del equipo de desarrollo si no hay ninguna.

Ejecutarlo dos veces no duplica nada ni cambia ninguna contraseña. El logo, los colores y la moneda se ajustan después en **Configuración**.

## Pruebas

`backend/tests/test_company_settings.py`, con 34 pruebas: permisos, lo que no se publica, validaciones, logo, módulos, autoaprobación e instalación. En el frontend, `src/lib/company.test.ts` cubre el contraste en los dos temas, el formato regional, el menú y los errores. `NewMovementPage.test.tsx` cubre los avisos de la autoaprobación.
