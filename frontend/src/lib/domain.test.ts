import { describe, expect, it } from 'vitest'
import { available, isLowStock, loanedByProduct, lotState, projectedStock, reasonRequired, uiRole } from './domain'
import type { Loan, Product } from '../api/types'

describe('reglas de movimientos', () => {
  it('el motivo es obligatorio en salidas y ajustes, no en entradas', () => {
    expect(reasonRequired('salida')).toBe(true)
    expect(reasonRequired('ajuste')).toBe(true)
    expect(reasonRequired('entrada')).toBe(false)
  })
  it('proyecta el stock al autorizar', () => {
    expect(projectedStock('entrada', 4, 6)).toBe(10)
    expect(projectedStock('salida', 4, 2)).toBe(2)
    expect(projectedStock('ajuste', 19, 18)).toBe(18)
    // con lote: el stock cambia en la diferencia del lote
    expect(projectedStock('ajuste', 19, 5, 6)).toBe(18)
  })
})

describe('disponible = stock − prestado', () => {
  const product = { id: 1, current_stock: '3.00' } as Product
  const loans = [
    { product_id: 1, status: 'loaned', quantity: '1.00' },
    { product_id: 1, status: 'loaned', quantity: '1.00' },
    { product_id: 1, status: 'returned', quantity: '5.00' },
    { product_id: 2, status: 'loaned', quantity: '9.00' },
  ] as Loan[]
  it('solo cuenta los préstamos sin devolver del producto', () => {
    expect(loanedByProduct(loans).get(1)).toBe(2)
    expect(available(product, loanedByProduct(loans))).toBe(1)
  })
})

describe('estados', () => {
  it('stock bajo = actual ≤ mínimo, solo en productos activos', () => {
    expect(isLowStock({ current_stock: '4', minimum_stock: '10', status: 'active' })).toBe(true)
    expect(isLowStock({ current_stock: '10', minimum_stock: '10', status: 'active' })).toBe(true)
    expect(isLowStock({ current_stock: '11', minimum_stock: '10', status: 'active' })).toBe(false)
    expect(isLowStock({ current_stock: '1', minimum_stock: '10', status: 'inactive' })).toBe(false)
  })
  it('clasifica los lotes por vencimiento', () => {
    const iso = (days: number) => {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    expect(lotState({ expiration_date: iso(-1) })).toBe('vencido')
    expect(lotState({ expiration_date: iso(10) })).toBe('por-vencer')
    expect(lotState({ expiration_date: iso(31) })).toBe('vigente')
    expect(lotState({ expiration_date: null })).toBe('sin-lote')
  })
  it('traduce los roles del backend', () => {
    expect(uiRole('Coordinator')).toBe('coordinador')
    expect(uiRole('Operator')).toBe('operador')
    expect(uiRole('Read-only')).toBe('lectura')
    expect(uiRole('otro')).toBe('lectura')
  })
})
