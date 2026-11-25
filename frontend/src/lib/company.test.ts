import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_ACCENT, DEFAULT_BRAND, colorErrors, contrast, deriveTheme, mix, themeCss } from './company'
import { fmtDate, fmtDateTime, fmtPrice, setFormatSettings } from './format'
import { describeDetail } from './errors'
import { visibleNav } from '../components/ui'
import { pageTitle } from '../app/ThemeProvider'

describe('colores de la empresa', () => {
  it('calcula el contraste como WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('mezcla dos colores', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mix('#0b6e4f', '#ffffff', 0)).toBe('#0b6e4f')
  })

  it('acepta la paleta por defecto y rechaza un principal claro o un acento oscuro', () => {
    expect(colorErrors(DEFAULT_BRAND, DEFAULT_ACCENT)).toEqual({})
    expect(colorErrors('#f5e663', DEFAULT_ACCENT).brand).toMatch(/muy claro/)
    expect(colorErrors(DEFAULT_BRAND, '#10202a').accent).toMatch(/muy oscuro/)
    expect(colorErrors('verde', DEFAULT_ACCENT).brand).toMatch(/#0b6e4f/)
  })

  it('los tonos calculados se leen en los dos temas', () => {
    for (const [brand, accent] of [['#1d4e7a', '#e3b341'], ['#7a1d3a', '#4fd1c5'], ['#333333', '#ffcc00']] as const) {
      const { claro, oscuro } = deriveTheme(brand, accent)
      expect(contrast(claro['on-brand'], claro.brand)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(claro['brand-ink'], claro['brand-tint'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(claro['nav-ink-muted'], claro['nav-active-bg'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(claro.accent, claro['nav-bg'])).toBeGreaterThanOrEqual(3)
      expect(contrast(oscuro.brand, oscuro.surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(oscuro.ink, oscuro['surface-raised'])).toBeGreaterThanOrEqual(7)
      expect(contrast(oscuro['ink-muted'], oscuro['surface-raised'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(oscuro['neutral-ink'], oscuro['neutral-tint'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(oscuro['brand-ink'], oscuro['brand-tint'])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(oscuro['nav-ink-muted'], oscuro['nav-active-bg'])).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('con la paleta por defecto no sobrescribe tokens.css', () => {
    expect(themeCss(DEFAULT_BRAND, DEFAULT_ACCENT)).toBe('')
    const css = themeCss('#1d4e7a', '#e3b341')
    expect(css).toContain('--brand: #1d4e7a;')
    expect(css).toContain('[data-theme="oscuro"]')
    // El oscuro también tiñe los fondos con el color de la empresa
    expect(css).toMatch(/\[data-theme="oscuro"\] \{[^}]*--surface: #/)
  })
})

describe('formato según la configuración', () => {
  afterEach(() => setFormatSettings({ currency: 'USD', date_format: 'dd/mm/aaaa' }))
  const d = new Date(2026, 10, 4, 9, 5)

  it('usa el formato de fecha configurado', () => {
    expect(fmtDate(d)).toBe('04/11/2026')
    setFormatSettings({ date_format: 'mm/dd/aaaa' })
    expect(fmtDate(d)).toBe('11/04/2026')
    expect(fmtDateTime(d)).toBe('11/04 09:05')
    setFormatSettings({ date_format: 'aaaa-mm-dd' })
    expect(fmtDate(d)).toBe('2026-11-04')
  })

  it('usa la moneda configurada', () => {
    expect(fmtPrice(12.5)).toMatch(/\$/)
    setFormatSettings({ currency: 'EUR' })
    expect(fmtPrice(12.5)).toMatch(/€/)
    expect(fmtPrice(12.5)).toMatch(/12,50/)
    setFormatSettings({ currency: 'MXN' })
    expect(fmtPrice(1234.5)).toMatch(/1,234\.50/)
    expect(fmtPrice(null)).toBe('—')
  })
})

describe('módulos y errores nuevos', () => {
  it('oculta del menú los módulos desactivados y Usuarios a quien no es coordinador', () => {
    const ids = (role: Parameters<typeof visibleNav>[0], modules?: Parameters<typeof visibleNav>[1]) => visibleNav(role, modules).map((n) => n.id)
    expect(ids('coordinador')).toContain('usuarios')
    expect(ids('operador')).not.toContain('usuarios')
    // Configuración y Exportar están en el menú del usuario, no en el lateral (decisión de la usuaria)
    expect(ids('coordinador')).not.toContain('configuracion')
    const sinPrestamos = ids('coordinador', { loans: false, machines: true, suppliers: false })
    expect(sinPrestamos).not.toContain('prestamos')
    expect(sinPrestamos).not.toContain('proveedores')
    expect(sinPrestamos).toContain('maquinas')
  })

  it('traduce un módulo desactivado y los préstamos pendientes', () => {
    expect(describeDetail('The Loans module is disabled in this installation', 403)).toMatchObject({ code: 'MODULO_DESACTIVADO', title: 'El módulo Préstamos está desactivado' })
    expect(describeDetail('Cannot disable the Loans module: 3 tools are still on loan', 409).message).toMatch(/Quedan 3 préstamos/)
  })

  it('explica por qué una autoaprobación quedó pendiente', () => {
    const why = describeDetail("Insufficient stock for product 'Rodamiento'. Current: 4, Loaned: 0, Available: 4, Requested: 10")
    expect(why.code).toBe('STOCK_INSUFICIENTE')
  })
})

describe('título de la pestaña', () => {
  it('usa el subtítulo y el nombre corto de la empresa', () => {
    expect(pageTitle({ product: 'Mantenimiento', shortName: 'Aroma Cacao' })).toBe('Sistema de mantenimiento · Aroma Cacao')
    expect(pageTitle({ product: '', shortName: 'Mi empresa' })).toBe('Sistema de bodega · Mi empresa')
  })
})
