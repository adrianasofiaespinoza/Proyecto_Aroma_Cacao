import { cx } from './cx'
import { fmtNum } from '../../lib/format'

export interface StockMeterProps {
  current: number
  min: number
  max: number
  unit?: string
}

/**
 * Cantidad, barra de llenado y, debajo, la leyenda en palabras «Mín. X · Máx. Y».
 * Sin marcas ni símbolos sobre la barra: en rojo cuando el stock está en el mínimo o por debajo.
 */
export function StockMeter({ current, min, max, unit = 'u.' }: StockMeterProps) {
  const low = current <= min
  const top = Math.max(max || 0, current, min) || 1
  const pct = Math.min(100, (current / top) * 100)
  const legend = max > 0 ? `Mín. ${fmtNum(min)} · Máx. ${fmtNum(max)}` : `Mín. ${fmtNum(min)}`
  return (
    <div className={cx('bd-meter', low && 'bd-meter-low')} title={`Actual ${fmtNum(current)} · mínimo ${fmtNum(min)} · máximo ${fmtNum(max)}`}>
      <span className="bd-meter-val">{fmtNum(current)} {unit}</span>
      <div className="bd-meter-bar" aria-hidden="true">
        <div className="bd-meter-fill" style={{ width: pct + '%' }} />
      </div>
      <span className="bd-meter-lbl">{legend}</span>
    </div>
  )
}
