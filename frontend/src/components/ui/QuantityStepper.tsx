import { useState } from 'react'
import { Icon } from './Icon'

export interface QuantityStepperProps {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  /** Paso de los botones: 1 para unidades, 0.5 para kg o litros, por ejemplo. */
  step?: number
  unit?: string
  onChange?: (n: number) => void
  id?: string
  label?: string
}

export function QuantityStepper({ value, defaultValue = 1, min = 0, max, step = 1, unit = 'u.', onChange, id, label = 'Cantidad' }: QuantityStepperProps) {
  const [inner, setInner] = useState(defaultValue)
  const [text, setText] = useState<string | null>(null)
  const v = value ?? inner
  const clamp = (x: number) => Math.max(min, max != null ? Math.min(max, x) : x)
  const set = (x: number) => {
    const c = clamp(Number.isFinite(x) ? Math.round(x * 100) / 100 : min)
    setInner(c)
    onChange?.(c)
  }
  return (
    <div className="bd-stepper">
      <button type="button" aria-label={'Restar a ' + label} onClick={() => set(v - step)}><Icon name="dash-lg" /></button>
      <input
        id={id}
        inputMode="decimal"
        value={text ?? String(v)}
        aria-label={label}
        onChange={(e) => {
          setText(e.target.value)
          const parsed = parseFloat(e.target.value.replace(',', '.'))
          if (!Number.isNaN(parsed)) set(parsed)
        }}
        onBlur={() => setText(null)}
      />
      <span className="bd-stepper-unit">{unit}</span>
      <button type="button" aria-label={'Sumar a ' + label} onClick={() => set(v + step)}><Icon name="plus-lg" /></button>
    </div>
  )
}
