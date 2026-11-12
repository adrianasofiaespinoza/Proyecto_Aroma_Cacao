import { apiFetch, json, request, tokenStorage } from './client'
import { errorFromResponse } from '../lib/errors'
import type {
  Alert, Category, Loan, LoanInput, Lot, LotInput, Machine, MachineInput, Movement, MovementInput, MovementStatus, MovementType,
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
