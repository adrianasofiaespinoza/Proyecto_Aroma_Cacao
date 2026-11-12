import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'

export interface EmptyStateProps {
  icon?: string
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  tone?: 'error'
}

export function EmptyState({ icon = 'inbox', title, text, action, tone }: EmptyStateProps) {
  return (
    <div className={cx('bd-empty', tone === 'error' && 'bd-empty-error')} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}
