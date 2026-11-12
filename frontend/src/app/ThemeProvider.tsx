import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_TENANT, type TenantConfig } from '../config/tenant'

export type ThemeName = 'claro' | 'oscuro'
export const THEMES: { value: ThemeName; label: string; icon: string }[] = [
  { value: 'claro', label: 'Claro', icon: 'brightness-high' },
  { value: 'oscuro', label: 'Oscuro', icon: 'moon' },
]

const THEME_KEY = 'bodega_theme'
const TENANT_KEY = 'bodega_tenant'

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  tenant: TenantConfig
  setTenant: (t: TenantConfig) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readTheme(): ThemeName {
  const saved = localStorage.getItem(THEME_KEY)
  // Quien tenía guardado el antiguo «contraste» vuelve al claro.
  return saved === 'oscuro' ? 'oscuro' : 'claro'
}

function readTenant(): TenantConfig {
  try {
    const saved = localStorage.getItem(TENANT_KEY)
    if (saved) return { ...DEFAULT_TENANT, ...(JSON.parse(saved) as Partial<TenantConfig>) }
  } catch {
    /* configuración corrupta: se usa la de la instalación */
  }
  return DEFAULT_TENANT
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readTheme)
  const [tenant, setTenantState] = useState<TenantConfig>(readTenant)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.tenant = tenant.id
    document.title = `Bodega · ${tenant.shortName}`
    localStorage.setItem(TENANT_KEY, JSON.stringify(tenant))
  }, [tenant])

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), [])
  const setTenant = useCallback((t: TenantConfig) => setTenantState(t), [])
  const value = useMemo(() => ({ theme, setTheme, tenant, setTenant }), [theme, setTheme, tenant, setTenant])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}
