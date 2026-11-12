# Bodega — kit de implementación

> Copia de referencia del kit entregado por Claude Design (noviembre de 2026). La implementación vive en `frontend/`; este material se conserva para comparar y para incorporar empresas nuevas.

Material para implementar la interfaz de Bodega en React 19 + TypeScript + Tailwind CSS v4.

- `styles/`: `tokens.css` (3 temas), `theme.css` (entrada de Tailwind v4), `components.css` y `tenants/` (marca por empresa).
- Las fuentes (Barlow, Barlow Condensed e IBM Plex Mono, SIL OFL) están en `frontend/public/fonts/`.
- `src/lib/`: `icons.ts` (Bootstrap Icons 1.11.3, MIT) y `permissions.ts`, ya tipados.
- `design-system/`: `tokens.json` y la guía de marca.
- `reference/`: componentes de referencia en JSX, API tipada (`index.d.ts`), las 16 pantallas y sus capturas.

Para agregar una empresa: copia `styles/tenants/_ejemplo-otra-empresa.css`, cambia los 11 valores y comprueba el contraste que indica el archivo.
