import type { ReactNode } from 'react'
import { Icon } from './Icon'

export interface SegmentedProps {
  options: { value: string; label: ReactNode; icon?: string }[]
  value?: string
  onChange?: (v: string) => void
  label?: string
}

export function Segmented({ options, value, onChange, label }: SegmentedProps) {
  return (
    <div className="bd-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value ? 'true' : 'false'} onClick={() => onChange?.(o.value)}>
          {o.icon && <Icon name={o.icon} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
