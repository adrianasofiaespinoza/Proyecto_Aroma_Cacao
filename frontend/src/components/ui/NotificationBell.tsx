import { IconButton } from './IconButton'

export interface NotificationBellProps {
  count?: number
  open?: boolean
  onToggle?: () => void
}

export function NotificationBell({ count = 0, open, onToggle }: NotificationBellProps) {
  return (
    <IconButton
      icon={count ? 'bell-fill' : 'bell'}
      label={count ? `Alertas: ${count} activas` : 'Alertas: ninguna activa'}
      className="bd-bell"
      aria-expanded={open ? 'true' : 'false'}
      onClick={onToggle}
    >
      {count > 0 && <span className="bd-bell-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </IconButton>
  )
}
