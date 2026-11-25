import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('can()', () => {
  it('el Coordinador puede todo', () => {
    for (const a of ['ver', 'solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios', 'reglas'] as const) expect(can('coordinador', a)).toBe(true)
    // La marca, la moneda y los módulos son del equipo de desarrollo, no de la empresa
    expect(can('coordinador', 'configurar')).toBe(false)
  })
  it('el Operador pide y presta, pero no autoriza ni administra', () => {
    expect(can('operador', 'solicitar')).toBe(true)
    expect(can('operador', 'prestar')).toBe(true)
    expect(can('operador', 'autorizar')).toBe(false)
    expect(can('operador', 'administrar')).toBe(false)
    expect(can('operador', 'usuarios')).toBe(false)
    expect(can('operador', 'configurar')).toBe(false)
  })
  it('Solo lectura únicamente consulta', () => {
    expect(can('lectura', 'ver')).toBe(true)
    for (const a of ['solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios', 'configurar', 'reglas'] as const) expect(can('lectura', a)).toBe(false)
  })
  it('soporte configura y solo consulta lo demás', () => {
    for (const a of ['ver', 'configurar', 'reglas'] as const) expect(can('soporte', a)).toBe(true)
    for (const a of ['solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios'] as const) expect(can('soporte', a)).toBe(false)
  })
  it('sin rol no puede nada', () => {
    expect(can(undefined, 'ver')).toBe(false)
  })
})
