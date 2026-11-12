Bodega es la interfaz de inventario del departamento de mantenimiento de una planta industrial: repuestos, lotes, movimientos autorizados, préstamos de herramientas, máquinas y proveedores. La primera empresa es **Aroma Cacao S.A.**; el producto se instala en otras empresas cambiando solo los tokens de marca y el `BrandMark`. Industrial, robusta y viva: verde selva de la plantación y amarillo mazorca sobre fondos claros y limpios, sin folclor.

## Principios

1. **Pendiente nunca parece aplicado.** Un movimiento sin autorizar lleva siempre fondo plano `pending-tint` (`bd-hatch`), borde **discontinuo** `pending-edge`, el ícono `hourglass-split` y el texto «No aplicado al stock». Solo `autorizado` usa relleno sólido `ok`, borde continuo y dice «Aplicado al stock». El borde discontinuo es exclusivo de lo pendiente: nada más lo usa.
2. **Estado = ícono + palabra.** Ningún estado se comunica solo con color. `ok` (azul petróleo) y `danger` (rojo) se separan por eje de color, ícono y texto.
3. **Bordes, no sombras.** Los paneles se separan con la regla superior `stroke-rule` en `ink` sobre `ground`. La sombra `shadow-overlay` es solo para modales, la campana y los avisos flotantes.
4. **Densidad en escritorio, dedos en el taller.** Escritorio: filas de `row-h` (44px) y controles `control-md`. Móvil y tablet: todo lo que se toca mide al menos `control-lg` (48px); la acción principal, `control-xl` (60px).
5. **Cada rol ve solo lo que puede hacer.** Los botones de escritura no se deshabilitan para Solo lectura: no se muestran (`RoleGate`, `can()`).

## Contenido y tono

- Español neutro de Ecuador, tuteo: «Pide una entrada», «Revisa la red Wi-Fi de la planta».
- Mayúscula solo al inicio y en nombres propios: «Nueva solicitud», no «Nueva Solicitud».
- Verbos concretos en botones: «Autorizar y aplicar al stock», «Rechazar solicitud», «Registrar devolución». Nunca «Aceptar» u «OK».
- Las confirmaciones dicen qué cambia, con cifras: «Stock 4 u. → 2 u.».
- Los errores del servidor se escriben como lo diría el jefe de bodega, con el código técnico aparte: título «La salida supera lo disponible», cuerpo «Se pidieron 4 u. … y hay 2 u. El stock no cambió.», código `STOCK_INSUFICIENTE · 409`. Una salida que supera lo disponible siempre se rechaza.
- Números con formato local: coma decimal en precios (`$ 8,40`), fechas `dd/mm/aaaa`, horas de 24 h, unidades abreviadas `u.`, `kg`, `l`.
- Roles en la interfaz: **Coordinador**, **Operador**, **Solo lectura**. Sin emoji.

## Color

Tres temas: `claro` (por defecto), `oscuro` y `contraste` (taller con mala luz o pantalla al sol; texto a 7:1). Todo par de texto cumple 4,5:1 y todo borde, ícono o anillo de foco con significado cumple 3:1 en los tres temas.

- Superficies: `ground` (piso de página) → `surface` (paneles, tablas) → `surface-raised` (campos, modales) y `surface-sunken` (encabezados de tabla, filtros, banda de indicadores).
- Texto: `ink` y `ink-muted` sobre cualquier superficie. Filetes con `line`; bordes de control con `line-strong`.
- Navegación: riel y cabecera móvil en `nav-bg` (verde selva profundo) con `nav-ink`; ítem activo `nav-active-bg` con barra `accent` (amarillo mazorca).
- Acción primaria: `brand` (verde selva) con `on-brand`; selección y fila activa: `brand-tint` con `brand-ink`. Usa un solo botón primario por vista.
- Estados: `pending-*` (pendiente, por vencer), `ok` / `ok-tint` / `ok-ink` (azul petróleo, distinto del verde de marca: autorizado, activo, éxito), `danger` / `danger-tint` / `danger-ink` (rechazado, stock bajo, vencido, errores), `info-*` (informativo, Solo lectura), `neutral-*` (inactivo, devuelto, vigente).
- Anillo de foco: 2px de `surface-raised` + 3px de `focus`, visible también sobre `nav-bg`.

### Marca por empresa

Una empresa cambia solo estos tokens: `brand`, `brand-hover`, `on-brand`, `brand-tint`, `brand-ink`, `accent`, `on-accent`, `nav-bg`, `nav-active-bg`, `nav-ink`, `nav-ink-muted`, más el objeto `brand` (`name`, `shortName`, `product`, `logoSrc`) que recibe `AppShell`. Los tokens de estado no se cambian nunca: el significado de pendiente, autorizado y rechazado es el mismo en todas las plantas.

Implementación: una hoja por empresa que redefine esas variables bajo `[data-tenant="<id>"]` (o un objeto de estilo con las variables en el contenedor raíz). Antes de publicar una marca nueva, comprueba: `brand` sobre `surface` ≥ 4,5:1, `on-brand` sobre `brand` y `brand-hover` ≥ 4,5:1, `brand-ink` sobre `brand-tint` ≥ 4,5:1, `accent` sobre `nav-bg` ≥ 3:1, `nav-ink-muted` sobre `nav-active-bg` ≥ 4,5:1. La tarjeta «Pantalla11MarcaPorEmpresa» muestra la misma pantalla con Aroma Cacao y con una segunda empresa de ejemplo.

Aroma Cacao no entregó logo: `BrandMark` escribe el nombre corto en `font-display`. Si una empresa entrega su logo, pásalo en `brand.logoSrc` (versión clara, para fondo `nav-bg`). Nunca un cuadrado con degradado ni un logo dibujado de memoria.

## Tipografía

- `font-sans` **Barlow**: interfaz y datos. Muy legible a distancia y con buena cifra tabular.
- `font-display` **Barlow Condensed**: títulos de pantalla (`page-title`), de panel (`section-title`) y cifras grandes (`kpi`).
- `font-mono` **IBM Plex Mono**: códigos internos, n.º de parte, lotes, RUC, OT y códigos de movimiento (`code`, `code-strong`).
- Toda cifra en tabla o indicador usa `font-variant-numeric: tabular-nums` (clase `bd-num`).
- Campos a 16px (`input`) para que iOS no haga zoom. Botones móviles en `touch-label` (18px).
- Rótulos `eyebrow` y `table-head` en MAYÚSCULAS con su espaciado; el resto, en minúsculas.

## Espaciado, radios y bordes

- Escala de 4px: `space-1`…`space-16`. Paneles: `space-6` en escritorio, `space-4` en móvil. Separación entre campos: `space-5`.
- Radios pequeños, de herramienta: `radius-xs` (insignias, códigos), `radius-sm` (botones, campos), `radius-md` (paneles, tarjetas), `radius-lg` (modales, hoja inferior). `radius-pill` solo para contadores y avatar.
- `stroke-control` (2px) en bordes de campos y botones secundarios: se ven con guantes y mala luz. `stroke-rule` (3px) arriba de cada panel.

## Diseño adaptable

- El marco (`AppShell`) es un contenedor (`container: app`). Por debajo de 720px de ancho: el riel se oculta, la cabecera pasa a `nav-bg` y aparece la barra inferior (Inicio, Productos, Movimientos, Préstamos, Más).
- `DataTable` es su propio contenedor: por debajo de 640px se dibuja como tarjetas con los mismos datos y acciones de 48px.
- Los modales se vuelven hoja inferior por debajo de 600px, con botones de 60px apilados y la acción principal arriba.
- Úsalo con Tailwind CSS v4 mapeando los tokens en `@theme` (p. ej. `--color-brand: var(--brand); --spacing-touch: var(--control-lg);`) y las variantes `@max-[720px]/app:` de consultas de contenedor. Los componentes son funciones sin estado global, compatibles con React 19.

## Movimientos: el flujo más importante

1. **Solicitud** (Operador o Coordinador): tipo Entrada, Salida o Ajuste. El motivo es obligatorio en Salida y Ajuste; en Ajuste se registra la cantidad contada en bodega y se muestra la diferencia con el sistema. Al enviar queda **Pendiente** y el stock no cambia (`StockImpact` discontinuo, «Solo si se autoriza»).
2. **Revisión** (solo Coordinador): banda con borde discontinuo «todavía no se aplicó al stock», detalle, `StockImpact` y `MovementFlow`. «Autorizar y aplicar al stock» (`ok`) y «Rechazar» (`danger-outline`) siempre pasan por `ConfirmDialog`; rechazar exige motivo.
3. **Resultado**: Autorizado → insignia sólida, `StockImpact` sólido «Aplicado» y aviso `Toast`. Rechazado → «Sin efecto en stock», el valor previsto tachado y el motivo visible para el solicitante.
4. Si el servidor responde `STOCK_INSUFICIENTE`, se muestra `Notice` de peligro y la autorización queda bloqueada.

## Estados de pantalla

Toda lista tiene sus cuatro estados: carga (`LoadingRows` con texto), vacía (`EmptyState` con qué hacer), error de conexión (`ConnectionError`, en bloque o en banda superior si ya hay datos) y lista. Las acciones importantes (autorizar, rechazar, desactivar, devolver) siempre confirman.

## Iconografía

**Bootstrap Icons 1.11.3** (MIT), en línea como SVG mediante `Icon name="…"`, con `currentColor`. Trazo de 16px de cuadrícula, a 16px en botones de escritorio, 20px en móvil y 22px en la navegación. Íconos fijos por concepto: Entrada `box-arrow-in-down`, Salida `box-arrow-up`, Ajuste `sliders`, Pendiente `hourglass-split`, Autorizado `check-circle-fill`, Rechazado `x-octagon-fill`, Stock bajo `exclamation-triangle-fill`, Vencido `calendar-x`, Préstamos `tools`, Máquinas `gear-wide-connected`, Proveedores `truck`. Los íconos solos (`IconButton`) llevan siempre `label`.
