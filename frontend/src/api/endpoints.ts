import { apiFetch, json, request, tokenStorage } from './client'
import { errorFromResponse } from '../lib/errors'
import type {
  Alert, Category, CompanySettings, CompanySettingsInput, PublicSettings, Loan, LoanInput, Lot, LotInput, Machine, MachineInput, Movement, MovementInput, MovementStatus, MovementType,
  Product, ProductInput, Supplier, SupplierInput, TokenResponse, Unit, User, UserCreateInput, UserUpdateInput, Worker,
} from './types'

// ---------- Sesión ----------
export async function login(input: { email: string; password: string; remember_me: boolean }): Promise<User> {
  const res = await apiFetch('/auth/login', { method: 'POST', ...json(input) })
  if (!res.ok) throw await errorFromResponse(res)
  const tokens = (await res.json()) as TokenResponse
  tokenStorage.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })
  const user = await request<User>('/users/me')
  tokenStorage.setSession({ user })
  return user
}

export async function logout(): Promise<void> {
  const refresh_token = tokenStorage.getRefreshToken()
  if (refresh_token) {
    try {
      await apiFetch('/auth/logout', { method: 'POST', ...json({ refresh_token }) })
    } catch {
      /* sin conexión: la sesión local se cierra igual */
    }
  }
  tokenStorage.clearSession()
}

export const getMe = () => request<User>('/users/me')

/** Cambia la contraseña propia. Conserva esta sesión y cierra las demás del usuario. */
export const changePassword = (input: { current_password: string; new_password: string }) =>
  request<{ message: string }>('/users/me/password', { method: 'POST', ...json({ ...input, refresh_token: tokenStorage.getRefreshToken() }) })

// ---------- Catálogos ----------
export const getCategories = () => request<Category[]>('/categories')
export const getUnits = () => request<Unit[]>('/units')

// ---------- Productos ----------
export const getProducts = () => request<Product[]>('/products')
export const getProduct = (id: number) => request<Product>(`/products/${id}`)
export const createProduct = (input: ProductInput) => request<Product>('/products', { method: 'POST', ...json(input) })
export const updateProduct = (id: number, input: Omit<ProductInput, 'current_stock'>) => request<Product>(`/products/${id}`, { method: 'PUT', ...json(input) })
export const deactivateProduct = (id: number) => request<Product>(`/products/${id}`, { method: 'DELETE' })
/** Disponible cuando se una la PR #9 (AC-7). */
export const reactivateProduct = (id: number) => request<Product>(`/products/${id}/reactivate`, { method: 'PATCH' })

// ---------- Lotes ----------
export const getLots = (params: { expiringWithinDays?: number } = {}) =>
  request<Lot[]>(params.expiringWithinDays != null ? `/lots?expiring_within_days=${params.expiringWithinDays}` : '/lots')
export const createLot = (productId: number, input: LotInput) => request<Lot>(`/products/${productId}/lots`, { method: 'POST', ...json(input) })
export const updateLot = (lotId: number, input: LotInput) => request<Lot>(`/lots/${lotId}`, { method: 'PUT', ...json(input) })

// ---------- Movimientos ----------
export function getMovements(params: { status?: MovementStatus; type?: MovementType } = {}) {
  const q = new URLSearchParams()
  if (params.status) q.set('status_filter', params.status)
  if (params.type) q.set('type_filter', params.type)
  const qs = q.toString()
  return request<Movement[]>(`/movements${qs ? `?${qs}` : ''}`)
}
export const getMovement = (id: number) => request<Movement>(`/movements/${id}`)
export const createMovement = (input: MovementInput) => request<Movement>('/movements', { method: 'POST', ...json(input) })
export const authorizeMovement = (id: number) => request<Movement>(`/movements/${id}/authorize`, { method: 'PATCH' })
export const rejectMovement = (id: number) => request<Movement>(`/movements/${id}/reject`, { method: 'PATCH' })

// ---------- Alertas ----------
export const getAlerts = () => request<Alert[]>('/alerts')

// ---------- Máquinas ----------
export const getMachines = () => request<Machine[]>('/machines')
export const saveMachine = (id: number | null, input: MachineInput) =>
  request<Machine>(id ? `/machines/${id}` : '/machines', { method: id ? 'PUT' : 'POST', ...json(input) })
export const addMachineProduct = (machineId: number, product_id: number) => request<Machine>(`/machines/${machineId}/products`, { method: 'POST', ...json({ product_id }) })
export const removeMachineProduct = (machineId: number, productId: number) => request<Machine>(`/machines/${machineId}/products/${productId}`, { method: 'DELETE' })

// ---------- Préstamos ----------
export const getLoans = () => request<Loan[]>('/loans')
export const getWorkers = () => request<Worker[]>('/workers')
export const createLoan = (input: LoanInput) => request<Loan>('/loans', { method: 'POST', ...json(input) })
export const returnLoan = (id: number) => request<Loan>(`/loans/${id}/return`, { method: 'PATCH' })

// ---------- Proveedores ----------
export const getSuppliers = () => request<Supplier[]>('/suppliers')
export const saveSupplier = (id: number | null, input: SupplierInput) =>
  request<Supplier>(id ? `/suppliers/${id}` : '/suppliers', { method: id ? 'PUT' : 'POST', ...json(input) })
export const addSupplierProduct = (supplierId: number, product_id: number, reference_price: number | null) =>
  request<Supplier>(`/suppliers/${supplierId}/products`, { method: 'POST', ...json({ product_id, reference_price }) })
export const updateSupplierPrice = (supplierId: number, productId: number, reference_price: number | null) =>
  request<Supplier>(`/suppliers/${supplierId}/products/${productId}`, { method: 'PATCH', ...json({ reference_price }) })
export const removeSupplierProduct = (supplierId: number, productId: number) =>
  request<Supplier>(`/suppliers/${supplierId}/products/${productId}`, { method: 'DELETE' })

// ---------- Usuarios ----------
export const getUsers = () => request<User[]>('/users')
export const createUser = (input: UserCreateInput) => request<User>('/users', { method: 'POST', ...json(input) })
export const updateUser = (id: number, input: UserUpdateInput) => request<User>(`/users/${id}`, { method: 'PUT', ...json(input) })

// ---------- Configuración de la empresa ----------
/** Sin sesión: no pasa por el renovador de tokens. */
export async function getPublicSettings(): Promise<PublicSettings> {
  const res = await fetch('/settings/public')
  if (!res.ok) throw await errorFromResponse(res)
  return (await res.json()) as PublicSettings
}
export const getSettings = () => request<CompanySettings>('/settings')
export const updateSettings = (input: CompanySettingsInput) => request<CompanySettings>('/settings', { method: 'PUT', ...json(input) })
export const getRules = () => request<{ coordinator_auto_approve: boolean }>('/settings/rules')
export const updateRules = (input: { coordinator_auto_approve: boolean }) => request<{ coordinator_auto_approve: boolean }>('/settings/rules', { method: 'PUT', ...json(input) })
export const uploadLogo = (data_url: string) => request<CompanySettings>('/settings/logo', { method: 'PUT', ...json({ data_url }) })
export const deleteLogo = () => request<CompanySettings>('/settings/logo', { method: 'DELETE' })

// ---------- Restablecer contraseña con enlace de un solo uso ----------
/** Solo Coordinator. El token se muestra una vez: el enlace no se guarda en ningún lado. */
export const createPasswordReset = (userId: number) => request<{ token: string; expires_at: string }>(`/users/${userId}/password-reset`, { method: 'POST' })

/** Sin sesión: quien abre el enlace todavía no puede entrar. */
export async function checkPasswordReset(token: string): Promise<{ full_name: string; email: string }> {
  const res = await fetch(`/auth/password-reset/${encodeURIComponent(token)}`)
  if (!res.ok) throw await errorFromResponse(res)
  return (await res.json()) as { full_name: string; email: string }
}
export async function completePasswordReset(token: string, new_password: string): Promise<void> {
  const res = await fetch('/auth/password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, new_password }) })
  if (!res.ok) throw await errorFromResponse(res)
}

// ---------- Importar inventario (solo Coordinator) ----------
export type ImportKind = 'products' | 'stock' | 'machines' | 'suppliers'
export type ImportRowStatus = 'new' | 'existing' | 'error'

export interface ImportRow {
  row: number
  key: string | null
  status: ImportRowStatus
  messages: string[]
  /** Solo en filas que ya existen: campo → [valor actual, valor del archivo] */
  changes: Record<string, [string | number | boolean | null, string | number | boolean | null]>
  values: Record<string, string | number | boolean | null>
}

export interface ImportSheet {
  kind: ImportKind
  title: string
  columns: { key: string; header: string }[]
  /** Error de toda la hoja (por ejemplo, módulo desactivado) */
  error: string | null
  unknown_columns: string[]
  rows: ImportRow[]
  counts: Record<ImportRowStatus, number>
}

export interface ImportPreview {
  sheets: ImportSheet[]
  new_categories: string[]
  can_confirm: boolean
}

export interface ImportSummary {
  products_created: number
  products_updated: number
  machines_created: number
  machines_updated: number
  suppliers_created: number
  suppliers_updated: number
  categories_created: number
  skipped: number
  stock_rows: number
  movement_id: number | null
}

export interface ImportUpload {
  filename: string
  data_base64: string
}

/** El archivo no se puede leer (formato, tamaño, hojas): el backend ya da el mensaje en español. */
export class ImportFileError extends Error {}

/** Vista previa con errores al confirmar: el archivo cambió o los datos de la BD cambiaron. */
export class ImportHasErrors extends Error {
  preview: ImportPreview
  constructor(preview: ImportPreview) {
    super('El archivo tiene errores')
    this.preview = preview
  }
}

async function importRequest<T>(endpoint: string, body: object): Promise<T> {
  const res = await apiFetch(endpoint, { method: 'POST', ...json(body) })
  if (res.ok) return (await res.json()) as T
  if (res.status === 400) {
    const data = (await res.clone().json().catch(() => null)) as { detail?: { code?: string; message?: string; preview?: ImportPreview } } | null
    const detail = data?.detail
    if (detail?.code === 'import_file') throw new ImportFileError(detail.message ?? 'No se pudo leer el archivo.')
    if (detail?.code === 'import_has_errors' && detail.preview) throw new ImportHasErrors(detail.preview)
  }
  throw await errorFromResponse(res)
}

export const previewImport = (upload: ImportUpload) => importRequest<ImportPreview>('/imports/preview', upload)
export const confirmImport = (upload: ImportUpload, update_rows: Partial<Record<ImportKind, number[]>>) =>
  importRequest<ImportSummary>('/imports/confirm', { ...upload, update_rows })

/** Descarga un archivo con la sesión (un enlace normal no llevaría el token). El nombre lo da el servidor. */
export async function downloadFile(endpoint: string, fallbackName: string): Promise<string> {
  const res = await apiFetch(endpoint)
  if (!res.ok) throw await errorFromResponse(res)
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')
  const filename = match?.[1] ?? fallbackName
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return filename
}

export const downloadImportTemplate = () => downloadFile('/imports/template', 'plantilla-inventario.xlsx')

// ---------- Exportar (cualquier rol) ----------
export type ExportFormat = 'xlsx' | 'csv'
export type InventoryExportKind = 'products' | 'stock' | 'machines' | 'suppliers'

/** Zona horaria del navegador: las fechas del archivo salen igual que en pantalla. */
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

export function exportInventory(format: ExportFormat, kind?: InventoryExportKind) {
  const params = new URLSearchParams({ format, tz: browserTimeZone() })
  if (format === 'csv' && kind) params.set('kind', kind)
  return downloadFile(`/exports/inventory?${params}`, `inventario.${format}`)
}

export function exportMovements(format: ExportFormat, filters: { dateFrom?: string; dateTo?: string; type?: MovementType; status?: MovementStatus }) {
  const params = new URLSearchParams({ format, tz: browserTimeZone() })
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.type) params.set('type_filter', filters.type)
  if (filters.status) params.set('status_filter', filters.status)
  return downloadFile(`/exports/movements?${params}`, `movimientos.${format}`)
}
