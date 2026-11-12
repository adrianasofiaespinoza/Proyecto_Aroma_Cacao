# Arquitectura del frontend (Bodega)

Interfaz web de inventario construida en noviembre de 2026 a partir del kit de diseño «Bodega» (`docs/design/bodega-kit/`). Sustituye por completo al frontend anterior de páginas HTML sueltas.

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| React 19 + TypeScript estricto | `frontend/src/**/*.tsx` | Tipos de la API y de los 30 componentes del kit (`reference/index.d.ts`). |
| Vite 8 + Tailwind CSS v4 | `vite.config.ts`, `src/styles/theme.css` | Sin `tailwind.config.js`: los tokens se exponen en `@theme`. |
| React Router 7 | `src/app/App.tsx` | Una sola página (`index.html`) con rutas; el `AppShell` del kit lo necesita. |
| TanStack Query 5 | `src/api/hooks.ts` | Caché, reintentos y refresco de los datos del servidor. |
| Vitest + Testing Library | `src/**/*.test.ts(x)` | Pruebas de reglas y de componentes. |
| Bootstrap Icons 1.11.3 | `src/lib/icons.ts` (+ `icons-extra.ts`) | SVG en línea con `currentColor`; sin fuente de íconos. |

No se usan librerías de componentes: todo está en `src/components/ui/`.

## Estructura

```
frontend/
  index.html                 entrada única (data-theme, data-tenant)
  public/fonts/              Barlow, Barlow Condensed, IBM Plex Mono
  src/
    main.tsx                 proveedores: Query, Theme, Toast, Router, Auth
    app/
      App.tsx                rutas y protección por sesión y por rol
      AppLayout.tsx          AppShell con datos reales: campana, pendientes, tema, cerrar sesión
      AuthProvider.tsx       sesión (login, logout, /users/me, rol traducido)
      ThemeProvider.tsx      tema claro/oscuro y empresa (data-tenant)
    api/
      client.ts              fetch con Bearer, renovación única ante 401, ApiError
      endpoints.ts           una función por endpoint del backend
      hooks.ts               useQuery/useMutation con claves e invalidación
      types.ts               tipos de las respuestas (schemas de FastAPI)
      useInventory.ts        productos, catálogos, lotes, máquinas y préstamos con mapas por id
    lib/
      permissions.ts         can(rol, acción) y ROLES (del kit)
      domain.ts              traducciones backend ↔ interfaz y reglas (stock bajo, lotes, disponible)
      errors.ts              mapa de errores del backend a mensajes de bodega
      format.ts              números, fechas, unidades, MOV-0000
    components/ui/           los 30 componentes del kit, uno por archivo, + index.ts
    pages/                   una carpeta por módulo; cada pantalla usa solo componentes de ui/
    styles/
      tokens.css             3 temas (generado desde tokens.json; no editar a mano)
      theme.css              entrada de Tailwind: tokens → utilidades
      components.css         clases bd-* de los componentes (del kit)
      screens.css            estilos de pantalla y piezas propias de la app
      tenants/<id>.css       los 11 tokens de marca de cada empresa
    config/tenant.ts         empresa instalada por defecto
```

## Reglas que la interfaz hace cumplir

- **Pendiente nunca parece aplicado.** `StatusBadge status="pendiente"`, `StockImpact status="pendiente"`, las filas `pending` y la banda de revisión usan fondo `pending-tint`, borde discontinuo y el texto «No aplicado al stock». Nada más usa borde discontinuo.
- **Cada rol ve solo lo que puede hacer.** `RoleGate` y `can()` ocultan (no deshabilitan) los botones de escritura. `/usuarios` redirige si no eres Coordinador. El contador de Movimientos solo lo ve quien autoriza. El backend vuelve a validar.
- **Motivo obligatorio** en salidas y ajustes (`reasonRequired`). En un ajuste se registra lo contado y se muestra la diferencia con el sistema.
- **Disponible = stock − prestado** (`useInventory().availableOf`). Una salida que supera lo disponible se bloquea en la pantalla y, si llega al servidor, se muestra como `STOCK_INSUFICIENTE`.
- **Autorizar y rechazar confirman siempre** con `ConfirmDialog` y las cifras de lo que cambia. Tras autorizar, un `Toast` muestra el antes → después.
- **Cuatro estados en cada lista:** carga (`LoadingRows`), vacía (`EmptyState`), sin conexión (`ConnectionError`, en bloque o en banda si ya hay datos) y lista.
- **Móvil:** por debajo de 720 px del contenedor el `AppShell` pasa a cabecera + barra inferior; las tablas se vuelven tarjetas por debajo de 640 px; los modales, hoja inferior por debajo de 600 px. Todo con consultas de contenedor del CSS del kit.

## Errores del backend

`src/lib/errors.ts` convierte el `detail` en inglés del backend en `{ title, message, code }`. Los casos con nombre: `STOCK_INSUFICIENTE` (con las cantidades extraídas del mensaje), `LOTE_INSUFICIENTE`, `LOTE_VENCIDO`, `PRODUCTO_INACTIVO`, `YA_REVISADO`, `CREDENCIALES`, `SESION_EXPIRADA`, `SIN_PERMISO`, `NO_ENCONTRADO`, `DUPLICADO`, `DATOS_INVALIDOS`, `SIN_CONEXION`, `ERROR_SERVIDOR`. El código técnico se muestra aparte en `Notice.code` («STOCK_INSUFICIENTE · 400»).

El backend responde `400` (no `409`) cuando una salida supera lo disponible; la interfaz lo trata igual.

## Marca por empresa

1. Copia `src/styles/tenants/_ejemplo-otra-empresa.css` a `src/styles/tenants/<id>.css`, cambia los 11 tokens y comprueba los contrastes que indica el archivo.
2. Importa la hoja en `src/main.tsx`.
3. Cambia `DEFAULT_TENANT` en `src/config/tenant.ts` (`id`, `name`, `shortName`, `product`, `logoSrc`). El `id` debe coincidir con el selector `[data-tenant]`.

Los tokens de estado (pendiente, autorizado, rechazado, stock bajo…) no se cambian por empresa. Cuando exista la configuración de empresa en el backend (Sprint 3), `ThemeProvider.setTenant` recibirá esos datos.

## Sesión

- El access token (15 min) y el refresh token se guardan en `localStorage` (`aroma_*`).
- Ante un `401`, `client.ts` renueva una sola vez aunque haya varias peticiones en vuelo y reintenta; si falla, cierra la sesión y la app vuelve a `/login`.
- Al arrancar con sesión guardada se confirma contra `/users/me` (rol actual y cuenta activa).

## Comandos

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxy al backend en 127.0.0.1:8000)
npm run typecheck
npm test
npm run build        # tsc + vite build
```

En desarrollo, `/dev/componentes` muestra todos los componentes con sus variantes.

## Diferencias respecto al kit y pendientes

- **Rechazo con motivo:** el diseño exige un motivo al rechazar; el backend (`PATCH /movements/{id}/reject`) no lo acepta ni lo guarda. El diálogo de rechazo confirma sin motivo hasta que exista el campo en el backend.
- **Varios productos por solicitud:** el backend lo admite; la pantalla de nueva solicitud registra un producto por solicitud (tarea de Sprint 1). La revisión y el detalle sí muestran todas las líneas.
- **Fecha de revisión:** el movimiento no guarda cuándo se autorizó o rechazó; el flujo muestra solo quién lo hizo.
- **Reactivar producto:** el botón llama a `PATCH /products/{id}/reactivate`, que llega con la PR #9 (AC-7). Mientras tanto, la interfaz avisa que aún no está en el servidor.
- **Pruebas visuales:** las capturas del kit son del diseño, no de la aplicación, así que no se comparan píxel a píxel. La revisión se hace a 1280 y 390 con el script de capturas de desarrollo y a ojo.
- **Mock con MSW:** no se creó; la app se conecta al backend real desde el inicio.
