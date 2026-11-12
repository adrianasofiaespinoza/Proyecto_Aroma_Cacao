import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'

export interface PanelProps {
  title?: ReactNode
  icon?: string
  count?: ReactNode
  actions?: ReactNode
  tone?: 'danger' | 'pending'
  /** Sin relleno interior: para tablas y filtros. */
  flush?: boolean
  children?: ReactNode
  className?: string
}

export function Panel({ title, icon, count, actions, tone, flush, children, className }: PanelProps) {
  return (
    <section className={cx('bd-panel', tone && 'bd-panel-' + tone, flush && 'bd-panel-flush', className)}>
      {(title || actions) && (
        <header className="bd-panel-head">
          {title && <h2 className="bd-panel-title">{icon && <Icon name={icon} />}{title}</h2>}
          {count != null && <span className="bd-panel-count">{count}</span>}
          {actions && <div className="bd-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="bd-panel-body">{children}</div>
    </section>
  )
}
