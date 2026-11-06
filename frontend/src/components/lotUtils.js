// Fecha local en formato YYYY-MM-DD, comparable con expiration_date
const today = () => new Date().toLocaleDateString('en-CA')

// Un lote vence al terminar su fecha (misma regla que el backend)
export const isLotExpired = (lot) => Boolean(lot.expiration_date) && lot.expiration_date < today()

export function daysToExpire(lot) {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((new Date(`${lot.expiration_date}T00:00:00`) - new Date(`${today()}T00:00:00`)) / msPerDay)
}

export function formatExpiration(lot) {
  if (!lot.expiration_date) return 'Sin vencimiento'
  return new Date(`${lot.expiration_date}T00:00:00`).toLocaleDateString('es-EC', { dateStyle: 'short' })
}

export function lotOptionLabel(lot) {
  const state = isLotExpired(lot) ? 'VENCIDO' : `vence: ${formatExpiration(lot)}`
  return `${lot.lot_number} · ${state} · quedan ${lot.remaining_quantity}`
}
