import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router'

/** Devuelve un onClick que navega sin recargar la página (enlaces con href real para accesibilidad). */
export function useGo() {
  const navigate = useNavigate()
  return (to: string) => (e: MouseEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }
}
