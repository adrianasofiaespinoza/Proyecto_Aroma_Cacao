/**
 * Configuración de la empresa: monedas, formatos de fecha y colores del tema.
 * Las reglas de contraste son las mismas que valida el backend (app/services/company.py).
 */

export type DateFormat = 'dd/mm/aaaa' | 'mm/dd/aaaa' | 'aaaa-mm-dd'
export type ModuleId = 'loans' | 'machines' | 'suppliers'

export const CURRENCIES: { code: string; label: string; locale: string }[] = [
  { code: 'USD', label: 'Dólar estadounidense (USD)', locale: 'es-EC' },
  { code: 'EUR', label: 'Euro (EUR)', locale: 'es-ES' },
  { code: 'MXN', label: 'Peso mexicano (MXN)', locale: 'es-MX' },
  { code: 'COP', label: 'Peso colombiano (COP)', locale: 'es-CO' },
  { code: 'PEN', label: 'Sol peruano (PEN)', locale: 'es-PE' },
  { code: 'CLP', label: 'Peso chileno (CLP)', locale: 'es-CL' },
  { code: 'ARS', label: 'Peso argentino (ARS)', locale: 'es-AR' },
  { code: 'GTQ', label: 'Quetzal (GTQ)', locale: 'es-GT' },
  { code: 'CRC', label: 'Colón costarricense (CRC)', locale: 'es-CR' },
  { code: 'DOP', label: 'Peso dominicano (DOP)', locale: 'es-DO' },
  { code: 'BOB', label: 'Boliviano (BOB)', locale: 'es-BO' },
  { code: 'PYG', label: 'Guaraní (PYG)', locale: 'es-PY' },
  { code: 'UYU', label: 'Peso uruguayo (UYU)', locale: 'es-UY' },
]

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'dd/mm/aaaa', label: 'dd/mm/aaaa (24/11/2026)' },
  { value: 'mm/dd/aaaa', label: 'mm/dd/aaaa (11/24/2026)' },
  { value: 'aaaa-mm-dd', label: 'aaaa-mm-dd (2026-11-24)' },
]

export const MODULES: { id: ModuleId; label: string; hint: string }[] = [
  { id: 'loans', label: 'Préstamos', hint: 'Préstamo y devolución de herramientas a trabajadores.' },
  { id: 'machines', label: 'Máquinas', hint: 'Máquinas de la planta y repuestos asociados.' },
  { id: 'suppliers', label: 'Proveedores', hint: 'Proveedores y precios de referencia.' },
]

export const DEFAULT_BRAND = '#0b6e4f'
export const DEFAULT_ACCENT = '#f2a900'

export function localeFor(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.locale ?? 'es-EC'
}

// ---------- Colores ----------

const HEX = /^#[0-9a-fA-F]{6}$/
export const isHexColor = (value: string) => HEX.test(value)

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function toHex(c: number[]): string {
  return '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
}

/** Mezcla `color` con `other`; amount = proporción de `other` (0..1). */
export function mix(color: string, other: string, amount: number): string {
  const a = rgb(color)
  const b = rgb(other)
  return toHex(a.map((x, i) => x + ((b[i] ?? 0) - x) * amount))
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const WHITE = '#ffffff'
const BLACK = '#000000'
export const MIN_BRAND_CONTRAST = 4.5
export const MIN_ACCENT_CONTRAST = 3

/** Fondo del menú en el tema claro (igual que nav_background del backend). */
export const navBackground = (brand: string) => mix(brand, BLACK, 0.6)

/** Errores de legibilidad en español, para mostrar junto al campo. */
export function colorErrors(brand: string, accent: string): { brand?: string; accent?: string } {
  const out: { brand?: string; accent?: string } = {}
  if (!isHexColor(brand)) out.brand = 'Escribe un color como #0b6e4f.'
  else if (contrast(brand, WHITE) < MIN_BRAND_CONTRAST) out.brand = 'Es muy claro: el texto en este color no se leería sobre fondo blanco. Elige uno más oscuro.'
  if (!isHexColor(accent)) out.accent = 'Escribe un color como #f2a900.'
  else if (isHexColor(brand) && contrast(accent, navBackground(brand)) < MIN_ACCENT_CONTRAST) out.accent = 'Es muy oscuro: no se distinguiría en el menú. Elige uno más claro o más vivo.'
  return out
}

/** Oscurece (o aclara) `color` hacia `toward` hasta lograr el contraste pedido contra `against`. */
function untilContrast(color: string, toward: string, against: string, min: number): string {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(color, toward, t)
    if (contrast(c, against) >= min) return c
  }
  return toward
}

const bestText = (bg: string, dark = '#14110a') => (contrast(bg, WHITE) >= contrast(bg, dark) ? WHITE : dark)

export type ThemeTokens = Record<'brand' | 'brand-hover' | 'on-brand' | 'brand-tint' | 'brand-ink' | 'accent' | 'on-accent' | 'nav-bg' | 'nav-active-bg' | 'nav-ink' | 'nav-ink-muted', string>


/** Los 11 tokens de marca (ver styles/tokens.css) para el tema claro y el oscuro; en el oscuro, también los neutros. */
/** Fondos, líneas y grises del tema oscuro: también toman el matiz de la empresa. */
export type DarkNeutrals = Record<'ground' | 'surface' | 'surface-raised' | 'surface-sunken' | 'line' | 'line-strong' | 'ink' | 'ink-muted' | 'neutral-tint' | 'neutral-ink', string>

export function deriveTheme(brand: string, accent: string): { claro: ThemeTokens; oscuro: ThemeTokens & DarkNeutrals } {
  const navBg = navBackground(brand)
  const navActive = mix(brand, BLACK, 0.35)
  const navInk = mix(WHITE, brand, 0.05)
  const tint = mix(brand, WHITE, 0.85)
  const claro: ThemeTokens = {
    brand,
    'brand-hover': mix(brand, BLACK, 0.15),
    'on-brand': WHITE,
    'brand-tint': tint,
    'brand-ink': untilContrast(brand, BLACK, tint, 4.5),
    accent,
    'on-accent': bestText(accent),
    'nav-bg': navBg,
    'nav-active-bg': navActive,
    'nav-ink': navInk,
    'nav-ink-muted': untilContrast(mix(navInk, navBg, 0.3), WHITE, navActive, 4.5),
  }

  // Tema oscuro: también los fondos, líneas y grises toman un matiz del color de la empresa.
  const surfaceDark = mix('#171b19', brand, 0.12)
  const raisedDark = mix('#1f2422', brand, 0.12)
  const neutralsDark: DarkNeutrals = {
    ground: mix('#101312', brand, 0.1),
    surface: surfaceDark,
    'surface-raised': raisedDark,
    'surface-sunken': mix('#0a0c0b', brand, 0.08),
    line: mix('#2c3330', brand, 0.15),
    'line-strong': mix('#77817c', brand, 0.15),
    ink: mix('#f2f4f3', brand, 0.04),
    'ink-muted': untilContrast(mix('#adb6b1', brand, 0.1), WHITE, raisedDark, 4.5),
    'neutral-tint': mix('#232926', brand, 0.1),
    'neutral-ink': untilContrast(mix('#c8cfcb', brand, 0.1), WHITE, mix('#232926', brand, 0.1), 4.5),
  }
  const brandDark = untilContrast(brand, WHITE, surfaceDark, 4.5)
  const tintDark = mix(brand, BLACK, 0.7)
  const navBgDark = mix(brand, BLACK, 0.88)
  const navActiveDark = mix(brand, BLACK, 0.7)
  const navInkDark = mix(WHITE, brand, 0.04)
  const oscuro: ThemeTokens & DarkNeutrals = {
    ...neutralsDark,
    brand: brandDark,
    'brand-hover': mix(brandDark, WHITE, 0.2),
    'on-brand': bestText(brandDark, mix(brand, BLACK, 0.85)),
    'brand-tint': tintDark,
    'brand-ink': untilContrast(mix(brand, WHITE, 0.55), WHITE, tintDark, 4.5),
    accent: untilContrast(accent, WHITE, navBgDark, 3),
    'on-accent': bestText(accent),
    'nav-bg': navBgDark,
    'nav-active-bg': navActiveDark,
    'nav-ink': navInkDark,
    'nav-ink-muted': untilContrast(mix(navInkDark, navBgDark, 0.35), WHITE, navActiveDark, 4.5),
  }
  return { claro, oscuro }
}

/** Hoja de estilos con el tema de la empresa. Vacía con la paleta por defecto: se usa tokens.css tal cual. */
export function themeCss(brand: string, accent: string): string {
  if (brand.toLowerCase() === DEFAULT_BRAND && accent.toLowerCase() === DEFAULT_ACCENT) return ''
  if (!isHexColor(brand) || !isHexColor(accent)) return ''
  const { claro, oscuro } = deriveTheme(brand, accent)
  const block = (t: Record<string, string>) => Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(' ')
  // La misma especificidad que tokens.css, cargada después.
  return `:root, [data-theme="claro"] { ${block(claro)} }\n[data-theme="oscuro"] { ${block(oscuro)} }\n@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ${block(oscuro)} } }`
}

