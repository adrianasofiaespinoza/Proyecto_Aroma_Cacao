import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  count?: number
  icon?: string
  children?: ReactNode
}

export function Chip({ pressed, count, icon, children, type, ...rest }: ChipProps) {
  return (
    <button type={type ?? 'button'} className="bd-chip" aria-pressed={pressed ? 'true' : 'false'} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
      {count != null && <span className="bd-chip-count">{count}</span>}
    </button>
  )
}
