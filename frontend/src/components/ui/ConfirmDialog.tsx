import { Fragment, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  title: string
  tone?: 'ok' | 'danger' | 'brand'
  icon?: string
  children?: ReactNode
  /** Pares etiqueta/valor con lo que cambia: [['Stock', '4 u. → 2 u.']] */
  consequences?: [ReactNode, ReactNode][]
  confirmLabel?: string
  cancelLabel?: string
  confirmIcon?: string
  onConfirm?: () => void
  onCancel?: () => void
  contained?: boolean
  /** Campo de motivo u otro contenido al pie del cuerpo. */
  reason?: ReactNode
  loading?: boolean
  /** Deshabilita «Confirmar» (p. ej. hasta que se escriba el motivo). */
  confirmDisabled?: boolean
}

export function ConfirmDialog({
  title, tone = 'ok', icon, children, consequences, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', confirmIcon,
  onConfirm, onCancel, contained, reason, loading, confirmDisabled,
}: ConfirmDialogProps) {
  const variant = tone === 'danger' ? 'danger' : tone === 'ok' ? 'ok' : 'primary'
  const modalTone = tone === 'brand' ? undefined : tone
  return (
    <Modal
      title={title}
      tone={modalTone}
      icon={icon ?? (tone === 'danger' ? 'exclamation-octagon-fill' : 'clipboard-check')}
      onClose={onCancel}
      contained={contained}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant} size="lg" icon={confirmIcon} loading={loading} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
      {consequences && (
        <dl className="bd-consequence">
          {consequences.map(([k, v], i) => (
            <Fragment key={i}><dt>{k}</dt><dd>{v}</dd></Fragment>
          ))}
        </dl>
      )}
      {reason}
    </Modal>
  )
}
