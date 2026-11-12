import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { IconButton } from './IconButton'
import { NOTICE_ICON } from './Notice'
import { cx } from './cx'

export interface ToastProps {
  tone?: 'ok' | 'danger'
  children?: ReactNode
  onClose?: () => void
}

export function Toast({ tone = 'ok', children, onClose }: ToastProps) {
  return (
    <div className={cx('bd-toast', 'bd-toast-' + tone)} role="status">
      <Icon name={NOTICE_ICON[tone]} />
      <div>{children}</div>
      {onClose && <IconButton icon="x-lg" label="Cerrar aviso" onClick={onClose} />}
    </div>
  )
}

interface ToastItem { id: number; tone: 'ok' | 'danger'; content: ReactNode }
interface ToastApi {
  /** Muestra un aviso flotante; se cierra solo a los 7 s. */
  show: (content: ReactNode, tone?: 'ok' | 'danger') => void
  ok: (content: ReactNode) => void
  danger: (content: ReactNode) => void
}

const ToastContext = createContext<ToastApi | null>(null)
const TOAST_MS = 7000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback(
    (content: ReactNode, tone: 'ok' | 'danger' = 'ok') => {
      const id = ++seq.current
      setItems((list) => [...list.slice(-2), { id, tone, content }])
      window.setTimeout(() => dismiss(id), TOAST_MS)
    },
    [dismiss],
  )
  const api = useMemo<ToastApi>(() => ({ show, ok: (c) => show(c, 'ok'), danger: (c) => show(c, 'danger') }), [show])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="bd-toasts" aria-live="polite">
        {items.map((t) => (
          <Toast key={t.id} tone={t.tone} onClose={() => dismiss(t.id)}>{t.content}</Toast>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
