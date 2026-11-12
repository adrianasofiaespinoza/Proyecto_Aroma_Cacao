import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'

export interface NoticeProps {
  tone?: 'danger' | 'pending' | 'ok' | 'info'
  title?: ReactNode
  children?: ReactNode
  /** Código técnico, aparte del mensaje: «STOCK_INSUFICIENTE · 400». */
  code?: string
  actions?: ReactNode
  icon?: string
}

export const NOTICE_ICON = { danger: 'exclamation-octagon-fill', pending: 'hourglass-split', ok: 'check-circle-fill', info: 'info-circle-fill' } as const

export function Notice({ tone = 'info', title, children, code, actions, icon }: NoticeProps) {
  return (
    <div className={cx('bd-notice', 'bd-notice-' + tone, tone === 'pending' && 'bd-hatch')} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon ?? NOTICE_ICON[tone]} />
      <div>
        {title && <span className="bd-notice-title">{title}</span>}
        {children}
        {code && <span className="bd-notice-code">Código: {code}</span>}
      </div>
      {actions && <div className="bd-notice-actions">{actions}</div>}
    </div>
  )
}
