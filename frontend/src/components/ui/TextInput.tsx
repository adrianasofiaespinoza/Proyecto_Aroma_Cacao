import type { InputHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string
  suffix?: string
  /** Muestra un valor que no se edita (p. ej. el stock actual). */
  readOnlyValue?: ReactNode
}

export function TextInput({ icon, suffix, readOnlyValue, className, ...rest }: TextInputProps) {
  if (readOnlyValue != null) {
    return <div className="bd-input bd-readonly" aria-readonly="true"><Icon name="lock" />{readOnlyValue}</div>
  }
  if (!icon && !suffix) return <input className={cx('bd-input', className)} {...rest} />
  return (
    <div className="bd-input-wrap">
      {icon && <Icon name={icon} />}
      <input className={cx('bd-input', icon && 'bd-has-icon', suffix && 'bd-has-suffix', className)} {...rest} />
      {suffix && <span className="bd-input-suffix">{suffix}</span>}
    </div>
  )
}
