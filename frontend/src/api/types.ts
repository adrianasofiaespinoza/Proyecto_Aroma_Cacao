/** Tipos de las respuestas del backend (backend/app/schemas). Los decimales llegan como string. */

export type BackendRole = 'Coordinator' | 'Operator' | 'Read-only'
export type MovementType = 'ENTRY' | 'EXIT' | 'ADJUSTMENT'
export type MovementStatus = 'pending' | 'authorized' | 'rejected'

export interface User {
  id: number
  username: string
  full_name: string
  email: string
  role: BackendRole
  is_active: boolean
  auth_provider: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface Category { id: number; name: string }
export interface Unit { id: number; name: string; abbreviation: string }

export interface Product {
  id: number
  internal_code: string
  name: string
  brand: string | null
  model: string | null
  part_number: string | null
  current_stock: string
  minimum_stock: string
  maximum_stock: string | null
  physical_location: string | null
  status: 'active' | 'inactive'
  requires_lot: boolean
  category_id: number
  unit_of_measure_id: number
}

export interface ProductInput {
  internal_code: string
  name: string
  brand?: string | null
  model?: string | null
  part_number?: string | null
  current_stock?: number
  minimum_stock: number
  maximum_stock?: number | null
  physical_location?: string | null
  requires_lot?: boolean
  category_id: number
  unit_of_measure_id: number
}

export interface Lot {
  id: number
  product_id: number
  lot_number: string
  expiration_date: string | null
  remaining_quantity: string
}

export interface LotInput { lot_number: string; expiration_date?: string | null }

export interface MovementDetail {
  id: number
  movement_id: number
  product_id: number
  quantity: string
  lot_id: number | null
  machine_id: number | null
}

export interface Movement {
  id: number
  type: MovementType
  date: string
  status: MovementStatus
  requesting_user_id: number
  authorizing_user_id: number | null
  requesting_user_name: string | null
  authorizing_user_name: string | null
  reason: string | null
  work_order_number: string | null
  details: MovementDetail[]
}

export interface MovementLineInput { product_id: number; quantity: number; lot_id?: number | null; machine_id?: number | null }
export interface MovementInput { type: MovementType; reason?: string | null; work_order_number?: string | null; details: MovementLineInput[] }

export interface Alert {
  id: number
  product_id: number
  stock_at_alert: string
  status: 'active' | 'resolved'
  date_generated: string
}

export interface Machine { id: number; name: string; identification_code: string; location: string | null; product_ids: number[] }
export interface MachineInput { name: string; identification_code: string; location?: string | null }

export interface SupplierProduct { product_id: number; reference_price: string | null }
export interface Supplier {
  id: number
  company_name: string
  ruc: string | null
  contact_person: string | null
  phone: string | null
  address: string | null
  email: string | null
  product_links: SupplierProduct[]
}
export interface SupplierInput { company_name: string; ruc?: string | null; contact_person?: string | null; phone?: string | null; address?: string | null; email?: string | null }

export interface Worker { id: number; full_name: string; position: string | null }
export interface Loan {
  id: number
  worker_id: number
  worker_name: string | null
  product_id: number
  quantity: string
  loan_date: string
  return_date: string | null
  status: 'loaned' | 'returned'
}
export interface LoanInput { product_id: number; quantity: number; worker_name: string }

export interface UserCreateInput { username: string; full_name: string; email: string; password: string; role: BackendRole; is_active: boolean }
export interface UserUpdateInput { full_name: string; email: string; role: BackendRole; is_active: boolean }
