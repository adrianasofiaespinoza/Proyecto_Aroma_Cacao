/** Traducciones entre lo que guarda el backend y lo que muestra la interfaz. */
import type { Role } from './permissions'
import type { BackendRole, Loan, Lot, Movement, MovementStatus, MovementType, Product } from '../api/types'
import { daysUntil, n } from './format'

export type UiMovementType = 'entrada' | 'salida' | 'ajuste'
export type UiMovementStatus = 'pendiente' | 'autorizado' | 'rechazado'
export type LotState = 'vencido' | 'por-vencer' | 'vigente' | 'sin-lote'

export const ROLE_FROM_BACKEND: Record<BackendRole, Role> = { Coordinator: 'coordinador', Operator: 'operador', 'Read-only': 'lectura' }
export const ROLE_TO_BACKEND: Record<Role, BackendRole> = { coordinador: 'Coordinator', operador: 'Operator', lectura: 'Read-only' }

export function uiRole(role: BackendRole | string | undefined): Role {
  return ROLE_FROM_BACKEND[role as BackendRole] ?? 'lectura'
}

export const TYPE_FROM_BACKEND: Record<MovementType, UiMovementType> = { ENTRY: 'entrada', EXIT: 'salida', ADJUSTMENT: 'ajuste' }
export const TYPE_TO_BACKEND: Record<UiMovementType, MovementType> = { entrada: 'ENTRY', salida: 'EXIT', ajuste: 'ADJUSTMENT' }
export const STATUS_FROM_BACKEND: Record<MovementStatus, UiMovementStatus> = { pending: 'pendiente', authorized: 'autorizado', rejected: 'rechazado' }
export const STATUS_TO_BACKEND: Record<UiMovementStatus, MovementStatus> = { pendiente: 'pending', autorizado: 'authorized', rechazado: 'rejected' }

export const TYPE_LABEL: Record<UiMovementType, string> = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' }

export const uiType = (m: Pick<Movement, 'type'>) => TYPE_FROM_BACKEND[m.type]
export const uiStatus = (m: Pick<Movement, 'status'>) => STATUS_FROM_BACKEND[m.status]

/** El motivo es obligatorio en salidas y ajustes. */
export const reasonRequired = (type: UiMovementType) => type !== 'entrada'

export const isLowStock = (p: Pick<Product, 'current_stock' | 'minimum_stock' | 'status'>) => p.status === 'active' && n(p.current_stock) <= n(p.minimum_stock)

export const EXPIRY_WARNING_DAYS = 30

export function lotState(lot: Pick<Lot, 'expiration_date'>): LotState {
  const days = daysUntil(lot.expiration_date)
  if (days == null) return 'sin-lote'
  if (days < 0) return 'vencido'
  if (days <= EXPIRY_WARNING_DAYS) return 'por-vencer'
  return 'vigente'
}

export function lotDaysLabel(lot: Pick<Lot, 'expiration_date'>): string {
  const days = daysUntil(lot.expiration_date)
  if (days == null) return 'sin vencimiento'
  if (days < 0) return `−${Math.abs(days)} días`
  if (days === 0) return 'vence hoy'
  return `${days} días`
}

/** Cantidad prestada (sin devolver) por producto. */
export function loanedByProduct(loans: Loan[] | undefined): Map<number, number> {
  const map = new Map<number, number>()
  for (const l of loans ?? []) {
    if (l.status !== 'loaned') continue
    map.set(l.product_id, (map.get(l.product_id) ?? 0) + n(l.quantity))
  }
  return map
}

/** Disponible = stock − prestado. Es lo que se valida en una salida. */
export function available(p: Pick<Product, 'id' | 'current_stock'>, loaned: Map<number, number>): number {
  return n(p.current_stock) - (loaned.get(p.id) ?? 0)
}

/** Stock que quedaría al autorizar un movimiento de una sola línea. */
export function projectedStock(type: UiMovementType, before: number, qty: number, lotRemaining?: number): number {
  if (type === 'entrada') return before + qty
  if (type === 'salida') return before - qty
  // Ajuste: con lote, cambia en la diferencia del lote; sin lote, queda en lo contado.
  return lotRemaining != null ? before + (qty - lotRemaining) : qty
}
