import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { InfoTip } from './InfoTip'
import { cx } from './cx'

export interface FieldProps {
  label?: ReactNode
  htmlFor?: string
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  /** Ayuda contextual: ícono (i) junto a la etiqueta que explica el campo. */
  info?: ReactNode
  error?: ReactNode
  className?: string
  children?: ReactNode
}

export function Field({ label, htmlFor, required, optional, hint, info, error, children, className }: FieldProps) {
  return (
    <div className={cx('bd-field', error && 'bd-invalid', className)}>
      {label && (
        <span className="bd-label-row">
          <label className="bd-label" htmlFor={htmlFor}>
            {label}
            {required && <span className="bd-req" aria-hidden="true">*</span>}
            {required && <span className="bd-sr">(obligatorio)</span>}
            {optional && <span className="bd-opt">Opcional</span>}
          </label>
          {info && <InfoTip label={typeof label === 'string' ? `Qué es «${label}»` : 'Más información'}>{info}</InfoTip>}
        </span>
      )}
      {children}
      {error ? (
        <span className="bd-error" role="alert"><Icon name="exclamation-octagon-fill" />{error}</span>
      ) : (
        hint && <span className="bd-hint">{hint}</span>
      )}
    </div>
  )
}
