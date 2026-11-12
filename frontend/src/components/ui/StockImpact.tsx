import { Icon } from './Icon'
import { cx } from './cx'
import { fmtNum } from '../../lib/format'

export interface StockImpactProps {
  before: number
  after: number
  unit?: string
  status?: 'pendiente' | 'autorizado' | 'rechazado'
  /** La salida supera lo disponible: se marca en rojo. */
  blocked?: boolean
  label?: string
}

export function StockImpact({ before, after, unit = 'u.', status = 'pendiente', blocked, label = 'Stock actual' }: StockImpactProps) {
  const note: [string, string] = blocked
    ? ['exclamation-octagon-fill', 'Supera lo disponible']
    : status === 'pendiente'
      ? ['hourglass-split', 'Solo si se autoriza']
      : status === 'autorizado'
        ? ['check-circle-fill', 'Aplicado']
        : ['slash-circle', 'No se aplicó']
  const delta = Math.round((after - before) * 100) / 100
  const deltaLabel = delta > 0 ? '+' + fmtNum(delta) : delta === 0 ? '±0' : '−' + fmtNum(Math.abs(delta))
  return (
    <div className={cx('bd-impact', 'bd-impact-' + status, blocked && 'bd-impact-blocked')}>
      <div className="bd-impact-box"><small>{status === 'autorizado' ? 'Antes' : label}</small><b>{fmtNum(before)} {unit}</b></div>
      <div className="bd-impact-arrow" aria-hidden="true"><span>{deltaLabel}</span><Icon name="arrow-right" /></div>
      <div className="bd-impact-box bd-impact-next">
        <small>{status === 'autorizado' ? 'Ahora' : status === 'rechazado' ? 'Habría quedado' : 'Quedaría'}</small>
        <b>{fmtNum(after)} {unit}</b>
      </div>
      <span className="bd-impact-note" style={{ color: blocked ? 'var(--danger-ink)' : undefined }}><Icon name={note[0]} />{note[1]}</span>
    </div>
  )
}
