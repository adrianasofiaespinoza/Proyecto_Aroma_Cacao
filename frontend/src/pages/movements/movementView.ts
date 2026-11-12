/** Lectura de un movimiento con sus productos, lotes y máquinas resueltos para la interfaz. */
import type { Inventory } from '../../api/useInventory'
import type { Lot, Machine, Movement, MovementDetail, Product } from '../../api/types'
import { projectedStock, uiStatus, uiType, type UiMovementStatus, type UiMovementType } from '../../lib/domain'
import { fmtQty, movementCode, n } from '../../lib/format'

export interface MovementLineView {
  detail: MovementDetail
  product: Product | undefined
  lot: Lot | undefined
  machine: Machine | undefined
  qty: number
  unit: string
  /** Stock actual del producto (o disponible, en salidas). */
  before: number
  /** Stock que quedaría (o quedó) al autorizar. */
  after: number
  /** Una salida que supera lo disponible: siempre se rechaza. */
  blocked: boolean
  /** Quedará por debajo del mínimo al autorizar. */
  belowMin: boolean
  qtyLabel: string
}

export interface MovementView {
  m: Movement
  code: string
  type: UiMovementType
  status: UiMovementStatus
  lines: MovementLineView[]
  first: MovementLineView | undefined
  /** «Rodamiento 6205-2RS · 2 u.» (+ «y 2 más») */
  summary: string
}

export function lineView(inv: Inventory, type: UiMovementType, status: UiMovementStatus, d: MovementDetail): MovementLineView {
  const product = inv.productById.get(d.product_id)
  const lot = d.lot_id != null ? inv.lotById.get(d.lot_id) : undefined
  const machine = d.machine_id != null ? inv.machineById.get(d.machine_id) : undefined
  const qty = n(d.quantity)
  const unit = inv.unitOf(product)
  const stock = product ? n(product.current_stock) : 0
  const avail = product ? inv.availableOf(product) : 0
  const before = type === 'salida' ? avail : stock
  const after = status === 'pendiente' ? projectedStock(type, before, qty, lot ? n(lot.remaining_quantity) : undefined) : before
  const blocked = status === 'pendiente' && type === 'salida' && qty > avail
  const belowMin = status === 'pendiente' && !!product && after <= n(product.minimum_stock) && type !== 'entrada'
  const qtyLabel = type === 'ajuste' ? `contado ${fmtQty(qty, unit)}` : fmtQty(qty, unit)
  return { detail: d, product, lot, machine, qty, unit, before, after, blocked, belowMin, qtyLabel }
}

export function movementView(inv: Inventory, m: Movement): MovementView {
  const type = uiType(m)
  const status = uiStatus(m)
  const lines = m.details.map((d) => lineView(inv, type, status, d))
  const first = lines[0]
  const name = first?.product?.name ?? `Producto ${first?.detail.product_id ?? ''}`
  const extra = lines.length > 1 ? ` y ${lines.length - 1} más` : ''
  return { m, code: movementCode(m.id), type, status, lines, first, summary: first ? `${name} · ${first.qtyLabel}${extra}` : 'Sin líneas' }
}

export function machineLabel(machine: Machine | undefined): string {
  return machine ? `${machine.identification_code} · ${machine.name}` : '—'
}
