import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('can()', () => {
  it('el Coordinador puede todo', () => {
    for (const a of ['ver', 'solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios'] as const) expect(can('coordinador', a)).toBe(true)
  })
  it('el Operador pide y presta, pero no autoriza ni administra', () => {
    expect(can('operador', 'solicitar')).toBe(true)
    expect(can('operador', 'prestar')).toBe(true)
    expect(can('operador', 'autorizar')).toBe(false)
    expect(can('operador', 'administrar')).toBe(false)
    expect(can('operador', 'usuarios')).toBe(false)
  })
  it('Solo lectura únicamente consulta', () => {
    expect(can('lectura', 'ver')).toBe(true)
    for (const a of ['solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios'] as const) expect(can('lectura', a)).toBe(false)
  })
  it('sin rol no puede nada', () => {
    expect(can(undefined, 'ver')).toBe(false)
  })
})
