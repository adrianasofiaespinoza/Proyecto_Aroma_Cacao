import React, { useEffect } from 'react'

// Modal con el mismo estilo que las maquetas HTML (.modal-backdrop)
export default function Modal({ title, onClose, children, footer, size = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`bg-card border border-border rounded-xl w-full ${size} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-medium">{title}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground" aria-label="Cerrar">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-border">{footer}</div>
        )}
      </div>
    </div>
  )
}

export function ErrorBox({ message }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm">
      <i className="bi bi-exclamation-triangle-fill text-destructive mt-0.5"></i>
      <span>{message}</span>
    </div>
  )
}

export const inputClass =
  'w-full rounded-lg bg-input-background border border-border px-3 py-2 text-sm disabled:opacity-60'
