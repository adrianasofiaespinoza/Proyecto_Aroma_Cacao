import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Ayuda contextual (decisión de la usuaria, 2026-11-27): un ícono (i) junto a un campo difícil.
 * Se abre al pulsarlo (sirve igual en celular, donde no hay «pasar el mouse») y se cierra
 * con Escape, al pulsar fuera o al volver a pulsarlo.
 */
export function InfoTip({ children, label = 'Más información' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <span className="bd-infotip" ref={ref}>
      <button
        type="button"
        className="bd-infotip-btn bd-focusable"
        aria-label={label}
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={id}
        onClick={(e) => {
          // Dentro de un <label>, el clic no debe enfocar el campo
          e.preventDefault()
          setOpen((o) => !o)
        }}
      >
        <Icon name="info-circle" />
      </button>
      {open && <span id={id} role="note" className="bd-infotip-pop">{children}</span>}
    </span>
  )
}
