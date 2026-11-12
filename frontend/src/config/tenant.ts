/** Configuración de la empresa instalada. Una instalación = una empresa (docs/decisions/001). */
export interface TenantConfig {
  /** Coincide con el selector [data-tenant] de src/styles/tenants/<id>.css */
  id: string
  name: string
  shortName: string
  product: string
  logoSrc?: string
}

export const DEFAULT_TENANT: TenantConfig = {
  id: 'aroma-cacao',
  name: 'Aroma Cacao S.A.',
  shortName: 'Aroma Cacao',
  product: 'Mantenimiento',
}

export const APP_NAME = 'Bodega'
export const APP_VERSION = 'v1.0'
