import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'
import { useGo } from './navigation'

export interface KpiItem {
  label: string
  value: ReactNode
  icon?: string
  hint?: string
  tone?: 'danger' | 'pending' | 'info'
  href?: string
}

export interface KpiStripProps {
  items: KpiItem[]
}

export function KpiStrip({ items }: KpiStripProps) {
  const go = useGo()
  return (
    <div className="bd-kpis">
      {items.map((k, i) => {
        const classes = cx('bd-kpi', 'bd-focusable', k.tone && 'bd-kpi-' + k.tone, k.tone === 'pending' && 'bd-hatch')
        const body = (
          <>
            <span className="bd-kpi-label">{k.icon && <Icon name={k.icon} />}{k.label}</span>
            <span className="bd-kpi-value">{k.value}</span>
            {k.hint && <span className="bd-kpi-hint">{k.hint}</span>}
          </>
        )
        return k.href ? (
          <a key={i} href={k.href} className={classes} onClick={go(k.href)}>{body}</a>
        ) : (
          <div key={i} className={classes}>{body}</div>
        )
      })}
    </div>
  )
}
