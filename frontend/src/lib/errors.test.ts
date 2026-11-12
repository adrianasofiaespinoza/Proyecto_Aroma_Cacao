import { describe, expect, it } from 'vitest'
import { errorFromResponse, isApiError, networkError } from './errors'

const response = (status: number, detail: unknown) => new Response(JSON.stringify({ detail }), { status, headers: { 'Content-Type': 'application/json' } })

describe('errorFromResponse()', () => {
  it('traduce la salida que supera lo disponible a STOCK_INSUFICIENTE con las cifras', async () => {
    const err = await errorFromResponse(response(400, "Insufficient stock for product 'Banda en V B-52'. Current: 2.00, Loaned: 0.00, Available: 2.00, Requested: 4.00"))
    expect(isApiError(err)).toBe(true)
    expect(err.code).toBe('STOCK_INSUFICIENTE')
    expect(err.codeLabel).toBe('STOCK_INSUFICIENTE · 400')
    expect(err.title).toBe('La salida supera lo disponible')
    expect(err.message).toContain('4')
    expect(err.message).toContain('2')
    expect(err.message).toContain('El stock no cambió')
    expect(err.stock).toEqual({ product: 'Banda en V B-52', current: 2, loaned: 0, available: 2, requested: 4 })
  })
  it('convierte los errores 422 de validación en un mensaje legible', async () => {
    const err = await errorFromResponse(response(422, [{ loc: ['body', 'reason'], msg: 'Value error, reason is required' }]))
    expect(err.code).toBe('DATOS_INVALIDOS')
    expect(err.message).toBe('reason: reason is required')
  })
  it('un 403 explica que el rol no puede hacerlo', async () => {
    const err = await errorFromResponse(response(403, 'Only Coordinators can authorize movements'))
    expect(err.code).toBe('SIN_PERMISO')
  })
  it('una solicitud ya revisada se reporta como YA_REVISADO', async () => {
    const err = await errorFromResponse(response(400, 'Movement is already authorized'))
    expect(err.code).toBe('YA_REVISADO')
    expect(err.message).toContain('autorizada')
  })
  it('sin conexión se explica en lenguaje de planta', () => {
    const err = networkError()
    expect(err.code).toBe('SIN_CONEXION')
    expect(err.title).toBe('No hay conexión con el servidor')
  })
})
