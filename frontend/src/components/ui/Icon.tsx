import type { CSSProperties } from 'react'
import { ICONS } from '../../lib/icons'
import { EXTRA_ICONS } from '../../lib/icons-extra'
import { cx } from './cx'

export interface IconProps {
  name: string
  size?: number
  /** Con etiqueta, el ícono es informativo (role="img"); sin ella es decorativo. */
  label?: string
  className?: string
  style?: CSSProperties
}

const ALL: Record<string, string> = { ...(ICONS as Record<string, string>), ...EXTRA_ICONS }

export function Icon({ name, size, label, className, style }: IconProps) {
  const path = ALL[name] ?? ''
  return (
    <svg
      className={cx('bd-icon', className)}
      viewBox="0 0 16 16"
      width={size ?? 16}
      height={size ?? 16}
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      style={style}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  )
}
