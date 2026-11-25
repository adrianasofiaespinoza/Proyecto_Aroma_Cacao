/**
 * Configuración de la empresa instalada. Una instalación = una empresa (docs/decisions/001).
 * Viene de GET /settings/public; esto es solo lo que se muestra mientras llega
 * (o si el servidor no responde y no hay nada guardado).
 */
import { DEFAULT_ACCENT, DEFAULT_BRAND, type DateFormat } from '../lib/company'
import type { CompanyModules, PublicSettings } from '../api/types'

export interface TenantConfig {
  name: string
  shortName: string
  product: string
  logoSrc?: string
  brandColor: string
  accentColor: string
  currency: string
  dateFormat: DateFormat
  /** Etiqueta de la identificación fiscal: RUC, NIT, RFC… */
  taxIdLabel: string
  modules: CompanyModules
}

export const DEFAULT_TENANT: TenantConfig = {
  name: 'Mi empresa',
  shortName: 'Mi empresa',
  product: 'Mantenimiento',
  brandColor: DEFAULT_BRAND,
  accentColor: DEFAULT_ACCENT,
  currency: 'USD',
  dateFormat: 'dd/mm/aaaa',
  taxIdLabel: 'RUC',
  modules: { loans: true, machines: true, suppliers: true },
}

export function tenantFromSettings(s: PublicSettings): TenantConfig {
  return {
    name: s.name,
    shortName: s.short_name,
    product: s.subtitle,
    logoSrc: s.logo_url ?? undefined,
    brandColor: s.brand_color,
    accentColor: s.accent_color,
    currency: s.currency,
    dateFormat: s.date_format,
    taxIdLabel: s.tax_id_label,
    modules: s.modules,
  }
}

export const APP_NAME = 'Bodega'
export const APP_VERSION = 'v1.0'
