/** Formato local: coma decimal, fechas dd/mm/aaaa, horas de 24 h, unidades abreviadas. */

const nf = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })
const money = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function n(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function fmtNum(value: number | string | null | undefined): string {
  return nf.format(n(value))
}

/** "u" → "u.", "L" → "l". Las demás se dejan como vienen del catálogo. */
export function unitLabel(abbr: string | undefined | null): string {
  if (!abbr) return 'u.'
  if (abbr === 'u') return 'u.'
  if (abbr === 'L') return 'l'
  return abbr
}

export function fmtQty(value: number | string | null | undefined, unit?: string | null): string {
  return `${fmtNum(value)} ${unitLabel(unit)}`
}

export function fmtPrice(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  return `$ ${money.format(n(value))}`
}

const pad = (x: number) => String(x).padStart(2, '0')

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  // El backend guarda fechas sin zona; se interpretan como UTC.
  const iso = /T/.test(value) && !/Z|[+-]\d\d:\d\d$/.test(value) ? value + 'Z' : value
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** dd/mm/aaaa */
export function fmtDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—'
}

/** dd/mm HH:mm */
export function fmtDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—'
}

/** "hoy 08:12", "ayer 16:05" o "dd/mm HH:mm" */
export function fmtRelative(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  const today = new Date()
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (sameDay(d, today)) return `hoy ${hm}`
  if (sameDay(d, yesterday)) return `ayer ${hm}`
  return fmtDateTime(d)
}

/** Fecha larga para el inicio: "Martes 10 de noviembre de 2026" */
export function fmtLongDate(d = new Date()): string {
  const s = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(',', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Días desde hoy hasta una fecha (negativo si ya pasó). Solo fecha, sin hora. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const [y, m, day] = value.split('-').map(Number)
  if (!y || !m || !day) return null
  const target = new Date(y, m - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** Fecha de hoy en formato de <input type="date"> */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function movementCode(id: number): string {
  return `MOV-${String(id).padStart(4, '0')}`
}

/** "Marcela Andrade" → "M. Andrade" */
export function shortName(full: string | null | undefined): string {
  if (!full) return '—'
  const parts = full.trim().split(/\s+/)
  if (parts.length < 2) return full
  return `${parts[0]?.charAt(0)}. ${parts[parts.length - 1]}`
}

export function initials(full: string | null | undefined): string {
  if (!full) return '?'
  return full.trim().split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase()
}
