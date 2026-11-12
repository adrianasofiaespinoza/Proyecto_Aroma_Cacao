import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { cx } from './cx'

export interface ModalProps {
  open?: boolean
  title: string
  icon?: string
  tone?: 'ok' | 'danger'
  children?: ReactNode
  footer?: ReactNode
  onClose?: () => void
  /** Dentro del contenedor actual en vez de la ventana (para maquetas). */
  contained?: boolean
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo modal: bloquea el foco dentro, cierra con Escape y devuelve el foco
 * al elemento que lo abrió. Por debajo de 600px se vuelve hoja inferior (CSS).
 */
export function Modal({ open = true, title, icon, tone, children, footer, onClose, contained }: ModalProps) {
  const box = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement
    const el = box.current
    const first = el?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? el)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab' || !el) return
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) return
      const firstNode = nodes[0]!
      const lastNode = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault()
        lastNode.focus()
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault()
        firstNode.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [open, onClose])

  if (!open) return null
  const node = (
    <div
      className={cx('bd-overlay', contained && 'bd-overlay-contained')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div ref={box} className={cx('bd-modal', tone && 'bd-modal-' + tone)} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="bd-modal-head">
          {icon && <Icon name={icon} />}
          <h2 className="bd-modal-title">{title}</h2>
          {onClose && <IconButton icon="x-lg" label="Cerrar" onClick={onClose} />}
        </div>
        <div className="bd-modal-body">{children}</div>
        {footer && <div className="bd-modal-foot">{footer}</div>}
      </div>
    </div>
  )
  return contained ? node : createPortal(node, document.body)
}
