/**
 * Formato según la configuración de la empresa: moneda y formato de fecha (Configuración),
 * coma o punto decimal según el país de la moneda, horas de 24 h, unidades abreviadas.
 * ThemeProvider llama a setFormatSettings al cargar la configuración.
 */
import { localeFor, type DateFormat } from './company'

let locale = 'es-EC'
let currency = 'USD'
let dateFormat: DateFormat = 'dd/mm/aaaa'
let nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
let money = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function setFormatSettings(settings: { currency?: string; date_format?: DateFormat }): void {
  if (settings.currency) {
    try {
      const nextLocale = localeFor(settings.currency)
      money = new Intl.NumberFormat(nextLocale, { style: 'currency', currency: settings.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
      nf = new Intl.NumberFormat(nextLocale, { maximumFractionDigits: 2 })
      locale = nextLocale
      currency = settings.currency
    } catch {
      /* moneda desconocida para el navegador: se conserva la anterior */
    }
  }
  if (settings.date_format) dateFormat = settings.date_format
}

export const currentCurrency = () => currency
export const currentLocale = () => locale

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
  return money.format(n(value))
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

/** Fecha completa en el formato configurado: dd/mm/aaaa, mm/dd/aaaa o aaaa-mm-dd. */
export function fmtDate(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  const dd = pad(d.getDate())
  const mm = pad(d.getMonth() + 1)
  const yyyy = d.getFullYear()
  if (dateFormat === 'mm/dd/aaaa') return `${mm}/${dd}/${yyyy}`
  if (dateFormat === 'aaaa-mm-dd') return `${yyyy}-${mm}-${dd}`
  return `${dd}/${mm}/${yyyy}`
}

/** Día y mes con la hora, en el orden configurado: dd/mm HH:mm, mm/dd HH:mm o mm-dd HH:mm. */
export function fmtDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  const dd = pad(d.getDate())
  const mm = pad(d.getMonth() + 1)
  const day = dateFormat === 'mm/dd/aaaa' ? `${mm}/${dd}` : dateFormat === 'aaaa-mm-dd' ? `${mm}-${dd}` : `${dd}/${mm}`
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const s = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d).replace(',', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "noviembre de 2026" */
export function fmtMonthYear(d = new Date()): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
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
