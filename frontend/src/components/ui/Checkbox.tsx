import type { InputHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode
}

export function Checkbox({ label, ...rest }: CheckboxProps) {
  return (
    <label className="bd-check">
      <input type="checkbox" {...rest} />
      <span className="bd-check-box"><Icon name="check-lg" /></span>
      {label}
    </label>
  )
}
