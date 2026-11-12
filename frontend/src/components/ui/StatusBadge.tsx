import { Icon } from './Icon'
import { cx } from './cx'

export type Status =
  | 'pendiente' | 'autorizado' | 'rechazado'
  | 'prestado' | 'devuelto'
  | 'activo' | 'inactivo' | 'stock-bajo'
  | 'vencido' | 'por-vencer' | 'vigente' | 'sin-lote'
  | 'solo-lectura'

export interface StatusBadgeProps {
  status: Status
  label?: string
  detail?: string
  /** Agrega el texto que explica el efecto en stock («No aplicado al stock»). */
  explain?: boolean
  size?: 'lg'
}

export const STATUS_META: Record<Status, { label: string; icon: string; sub?: string }> = {
  pendiente: { label: 'Pendiente', icon: 'hourglass-split', sub: 'No aplicado al stock' },
  autorizado: { label: 'Autorizado', icon: 'check-circle-fill', sub: 'Aplicado al stock' },
  rechazado: { label: 'Rechazado', icon: 'x-octagon-fill', sub: 'Sin efecto en stock' },
  prestado: { label: 'Prestado', icon: 'arrow-right' },
  devuelto: { label: 'Devuelto', icon: 'check-lg' },
  activo: { label: 'Activo', icon: 'check-lg' },
  inactivo: { label: 'Inactivo', icon: 'slash-circle' },
  'stock-bajo': { label: 'Stock bajo', icon: 'exclamation-triangle-fill' },
  vencido: { label: 'Vencido', icon: 'calendar-x' },
  'por-vencer': { label: 'Por vencer', icon: 'hourglass-split' },
  vigente: { label: 'Vigente', icon: 'calendar-event' },
  'sin-lote': { label: 'Sin lote', icon: 'dash-lg' },
  'solo-lectura': { label: 'Solo lectura', icon: 'eye' },
}

export function StatusBadge({ status, label, detail, explain, size }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? { label: status, icon: 'info-circle-fill' }
  const sub = detail ?? (explain ? meta.sub : undefined)
  return (
    <span className={cx('bd-badge', 'bd-badge-' + status, status === 'pendiente' && 'bd-hatch', size === 'lg' && 'bd-badge-lg')}>
      <Icon name={meta.icon} />
      {label ?? meta.label}
      {sub && <span className="bd-badge-sub">{sub}</span>}
    </span>
  )
}
