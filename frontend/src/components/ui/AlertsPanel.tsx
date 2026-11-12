import { Button } from './Button'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { cx } from './cx'
import { useGo } from './navigation'

export interface AlertItem {
  tone?: 'danger' | 'pending' | 'info'
  title: string
  meta?: string
  href?: string
  icon?: string
}

export interface AlertsPanelProps {
  alerts?: AlertItem[]
  onClose?: () => void
  /** Destino de «Ver todas las alertas». */
  allHref?: string
}

const ALERT_ICON = { danger: 'exclamation-triangle-fill', pending: 'hourglass-split', info: 'calendar-event' } as const

export function AlertsPanel({ alerts = [], onClose, allHref = '/' }: AlertsPanelProps) {
  const go = useGo()
  const open = (href: string) => (e: React.MouseEvent) => {
    go(href)(e)
    onClose?.()
  }
  return (
    <div className="bd-alerts" role="dialog" aria-label="Alertas activas">
      <div className="bd-alerts-head">
        Alertas activas · {alerts.length}
        {onClose && <IconButton icon="x-lg" label="Cerrar alertas" onClick={onClose} />}
      </div>
      {alerts.length ? (
        <ul>
          {alerts.map((a, i) => (
            <li key={i}>
              <a href={a.href ?? '#'} className={cx('bd-alert', 'bd-alert-' + (a.tone ?? 'info'), 'bd-focusable')} onClick={open(a.href ?? allHref)}>
                <Icon name={a.icon ?? ALERT_ICON[a.tone ?? 'info']} />
                <span><b>{a.title}</b><small>{a.meta}</small></span>
                <Icon name="chevron-right" className="bd-chev" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="bell" title="Sin alertas" text="Todo el stock está sobre el mínimo y no hay solicitudes esperando." />
      )}
      <div className="bd-alerts-foot">
        <Button variant="ghost" size="sm" as="a" href={allHref} onClick={open(allHref)}>Ver todas las alertas</Button>
      </div>
    </div>
  )
}
