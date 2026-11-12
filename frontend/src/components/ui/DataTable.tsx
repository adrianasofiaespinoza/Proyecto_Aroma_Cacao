import type { ReactNode } from 'react'
import { ConnectionError } from './ConnectionError'
import { EmptyState } from './EmptyState'
import { LoadingRows } from './LoadingRows'
import { cx } from './cx'

export interface Column<R> {
  key: string
  header: ReactNode
  render?: (row: R) => ReactNode
  align?: 'right'
  width?: number | string
  /** Papel de la columna en la vista de tarjetas (< 640px del contenedor). */
  mobile?: 'title' | 'subtitle' | 'badge' | 'meta' | 'wide' | 'hidden'
  mobileLabel?: string
}

export interface DataTableProps<R> {
  columns: Column<R>[]
  rows?: R[]
  rowKey?: keyof R & string
  rowTone?: (row: R) => 'danger' | 'pending' | 'selected' | 'muted' | null | undefined
  onRowClick?: (row: R) => void
  actions?: ((row: R) => ReactNode) | null
  mobileActions?: ((row: R) => ReactNode) | null
  state?: 'ready' | 'loading' | 'empty' | 'error'
  empty?: { icon?: string; title?: string; text?: string; action?: ReactNode }
  onRetry?: () => void
  caption?: string
  loadingLabel?: string
}

export function DataTable<R extends object>({
  columns, rows = [], rowKey = 'id' as keyof R & string, rowTone, onRowClick, actions, mobileActions,
  state = 'ready', empty = {}, onRetry, caption, loadingLabel,
}: DataTableProps<R>) {
  if (state === 'loading') return <div className="bd-dt"><LoadingRows label={loadingLabel ?? 'Cargando…'} /></div>
  if (state === 'error') return <div className="bd-dt"><ConnectionError onRetry={onRetry} /></div>
  if (state === 'empty' || rows.length === 0) {
    return <div className="bd-dt"><EmptyState icon={empty.icon ?? 'inbox'} title={empty.title ?? 'No hay registros'} text={empty.text} action={empty.action} /></div>
  }
  const cell = (c: Column<R>, r: R): ReactNode => (c.render ? c.render(r) : ((r as Record<string, unknown>)[c.key] as ReactNode))
  const keyOf = (r: R) => String((r as Record<string, unknown>)[rowKey])
  const titleCol = columns.find((c) => c.mobile === 'title') ?? columns[0]
  const subCol = columns.find((c) => c.mobile === 'subtitle')
  const badgeCol = columns.find((c) => c.mobile === 'badge')
  const metaCols = columns.filter((c) => !c.mobile || c.mobile === 'meta' || c.mobile === 'wide')
  const rowClick = (r: R) => (onRowClick ? () => onRowClick(r) : undefined)
  return (
    <div className="bd-dt">
      <table className="bd-table">
        {caption && <caption className="bd-sr">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'bd-right' : undefined} style={c.width ? { width: c.width } : undefined}>{c.header}</th>
            ))}
            {actions && <th className="bd-right"><span className="bd-sr">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tone = rowTone?.(r)
            return (
              <tr key={keyOf(r)} className={cx(tone && 'bd-tr-' + tone, onRowClick && 'bd-click')} onClick={rowClick(r)}>
                {columns.map((c) => <td key={c.key} className={c.align === 'right' ? 'bd-right' : undefined}>{cell(c, r)}</td>)}
                {actions && <td><div className="bd-row-actions">{actions(r)}</div></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
      <ul className="bd-cards">
        {rows.map((r) => {
          const tone = rowTone?.(r)
          const ma = (mobileActions ?? actions)?.(r)
          return (
            <li key={keyOf(r)} className={cx('bd-card', tone && 'bd-card-' + tone)} onClick={rowClick(r)}>
              <div className="bd-card-head">
                <div className="bd-card-title">
                  {titleCol && cell(titleCol, r)}
                  {subCol && <div className="bd-card-sub">{cell(subCol, r)}</div>}
                </div>
                {badgeCol && cell(badgeCol, r)}
              </div>
              {metaCols.length > 0 && (
                <dl className="bd-card-meta">
                  {metaCols.filter((c) => c !== titleCol).map((c) => (
                    <div key={c.key} className={c.mobile === 'wide' ? 'bd-wide' : undefined}>
                      <dt>{c.mobileLabel ?? c.header}</dt>
                      <dd>{cell(c, r)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {ma && <div className="bd-card-actions">{ma}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
