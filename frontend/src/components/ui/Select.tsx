import type { SelectHTMLAttributes } from 'react'
import { Icon } from './Icon'
import { cx } from './cx'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: (string | { value: string; label: string })[]
  placeholder?: string
}

export function Select({ options, placeholder, className, ...rest }: SelectProps) {
  return (
    <div className="bd-select-wrap">
      <select className={cx('bd-select', className)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      <Icon name="chevron-down" />
    </div>
  )
}
