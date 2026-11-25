import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_TENANT, tenantFromSettings, type TenantConfig } from '../config/tenant'
import { usePublicSettings } from '../api/hooks'
import { themeCss } from '../lib/company'
import { setFormatSettings } from '../lib/format'

export type ThemeName = 'claro' | 'oscuro'
export const THEMES: { value: ThemeName; label: string; icon: string }[] = [
  { value: 'claro', label: 'Claro', icon: 'brightness-high' },
  { value: 'oscuro', label: 'Oscuro', icon: 'moon' },
]

const THEME_KEY = 'bodega_theme'
const TENANT_KEY = 'bodega_tenant'
const FALLBACK_ICON = '/favicon.svg'

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  /** La empresa instalada: nombre, logo, colores, formato y módulos activos. */
  tenant: TenantConfig
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readTheme(): ThemeName {
  const saved = localStorage.getItem(THEME_KEY)
  // Quien tenía guardado el antiguo «contraste» vuelve al claro.
  return saved === 'oscuro' ? 'oscuro' : 'claro'
}

/** Lo guardado de la última visita, para pintar la marca sin esperar al servidor. */
function readTenant(): TenantConfig {
  try {
    const saved = localStorage.getItem(TENANT_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<TenantConfig>
      return { ...DEFAULT_TENANT, ...parsed, modules: { ...DEFAULT_TENANT.modules, ...parsed.modules } }
    }
  } catch {
    /* guardado corrupto: se usan los valores genéricos hasta que responda el servidor */
  }
  return DEFAULT_TENANT
}

/** «Sistema de mantenimiento · Aroma Cacao»: el subtítulo y el nombre corto configurados. */
export function pageTitle(tenant: Pick<TenantConfig, 'product' | 'shortName'>): string {
  const area = tenant.product.trim()
  return `Sistema de ${area ? area.toLowerCase() : 'bodega'} · ${tenant.shortName}`
}

function applyFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (link.getAttribute('href') !== href) {
    link.removeAttribute('type')
    link.href = href
  }
}

function applyThemeCss(css: string) {
  let style = document.getElementById('company-theme') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'company-theme'
    document.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readTheme)
  const [cached] = useState<TenantConfig>(readTenant)
  const settings = usePublicSettings()
  const tenant = useMemo(() => (settings.data ? tenantFromSettings(settings.data) : cached), [settings.data, cached])

  // Antes de pintar a los hijos: fmtPrice y fmtDate ya usan la moneda y el formato de la empresa.
  setFormatSettings({ currency: tenant.currency, date_format: tenant.dateFormat })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.title = pageTitle(tenant)
    applyFavicon(tenant.logoSrc ?? FALLBACK_ICON)
    applyThemeCss(themeCss(tenant.brandColor, tenant.accentColor))
    try {
      localStorage.setItem(TENANT_KEY, JSON.stringify(tenant))
    } catch {
      /* almacenamiento lleno o bloqueado: se vuelve a pedir en la próxima visita */
    }
  }, [tenant])

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), [])
  const value = useMemo(() => ({ theme, setTheme, tenant }), [theme, setTheme, tenant])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}

/** Etiqueta de la identificación fiscal de la empresa (RUC, NIT, RFC…). */
export function useTaxIdLabel() {
  return useContext(ThemeContext)?.tenant.taxIdLabel ?? DEFAULT_TENANT.taxIdLabel
}

/** Módulos activos de la empresa. Fuera del proveedor (pruebas de una pantalla), todos activos. */
export function useModules() {
  return useContext(ThemeContext)?.tenant.modules ?? DEFAULT_TENANT.modules
}
