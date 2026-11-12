import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string
  /** Obligatoria: es el nombre accesible del botón. */
  label: string
  variant?: 'outline'
  size?: 'lg'
  children?: ReactNode
}

export function IconButton({ icon, label, variant, size, className, children, type, ...rest }: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      {...rest}
      className={cx('bd-iconbtn', variant === 'outline' && 'bd-iconbtn-outline', size === 'lg' && 'bd-iconbtn-lg', className)}
    >
      <Icon name={icon} />
      {children}
    </button>
  )
}
