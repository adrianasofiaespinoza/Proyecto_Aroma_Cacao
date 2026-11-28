import { describe, expect, it } from 'vitest'
import { can } from './permissions'

describe('can()', () => {
  it('el Coordinador puede todo', () => {
    for (const a of ['ver', 'solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios', 'reglas', 'importar'] as const) expect(can('coordinador', a)).toBe(true)
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
    expect(can('operador', 'importar')).toBe(false)
  })
  it('Solo lectura únicamente consulta', () => {
    expect(can('lectura', 'ver')).toBe(true)
    for (const a of ['solicitar', 'autorizar', 'prestar', 'administrar', 'usuarios', 'configurar', 'reglas', 'importar'] as const) expect(can('lectura', a)).toBe(false)
  })
  it('soporte tiene su panel técnico: configura y administra usuarios, pero no ve la bodega', () => {
    for (const a of ['usuarios', 'configurar', 'reglas', 'sistema'] as const) expect(can('soporte', a)).toBe(true)
    for (const a of ['ver', 'solicitar', 'autorizar', 'prestar', 'administrar', 'importar'] as const) expect(can('soporte', a)).toBe(false)
  })
  it('solo soporte ve el panel técnico', () => {
    for (const r of ['coordinador', 'operador', 'lectura'] as const) expect(can(r, 'sistema')).toBe(false)
  })
  it('sin rol no puede nada', () => {
    expect(can(undefined, 'ver')).toBe(false)
  })
})
