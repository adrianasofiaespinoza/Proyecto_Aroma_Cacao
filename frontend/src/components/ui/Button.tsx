import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'ok' | 'danger' | 'danger-outline'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: string
  iconRight?: string
  block?: boolean
  loading?: boolean
  as?: 'button' | 'a'
  href?: string
  children?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, block, loading, children, className, as, href, type, disabled, ...rest }: ButtonProps) {
  const classes = cx('bd-btn', 'bd-btn-' + variant, size !== 'md' && 'bd-btn-' + size, block && 'bd-btn-block', loading && 'bd-btn-loading', className)
  const content = (
    <>
      {loading ? <Icon name="arrow-repeat" /> : icon && <Icon name={icon} />}
      {children}
      {iconRight && <Icon name={iconRight} />}
    </>
  )
  if (as === 'a') {
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <a {...anchorProps} href={href} className={classes} aria-busy={loading ? 'true' : undefined} aria-disabled={disabled ? 'true' : undefined}>
        {content}
      </a>
    )
  }
  return (
    <button type={type ?? 'button'} {...rest} disabled={disabled || loading} className={classes} aria-busy={loading ? 'true' : undefined}>
      {content}
    </button>
  )
}
