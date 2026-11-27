import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ToastProvider } from '../components/ui'

const inventory = vi.fn()
const movements = vi.fn()
vi.mock('../api/endpoints', () => ({
  exportInventory: (...a: unknown[]) => inventory(...a),
  exportMovements: (...a: unknown[]) => movements(...a),
}))
vi.mock('../app/ThemeProvider', () => ({
  useModules: () => ({ loans: true, machines: true, suppliers: false }),
}))

const { ExportPage } = await import('./ExportPage')

function renderPage() {
  render(<ToastProvider><MemoryRouter><ExportPage /></MemoryRouter></ToastProvider>)
}

describe('Exportar', () => {
  beforeEach(() => {
    inventory.mockReset().mockResolvedValue('inventario-2026-11-25.xlsx')
    movements.mockReset().mockResolvedValue('movimientos.csv')
  })

  it('descarga el inventario completo en Excel', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Descargar inventario/ }))
    await waitFor(() => expect(inventory).toHaveBeenCalledWith('xlsx', 'products'))
    expect(await screen.findByText(/inventario-2026-11-25\.xlsx/)).toBeInTheDocument()
  })

  it('en CSV pide qué datos y no ofrece los módulos desactivados', async () => {
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'CSV' })[0]!)
    const select = screen.getByLabelText('Datos')
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(['products', 'stock', 'machines'])
    await userEvent.selectOptions(select, 'machines')
    await userEvent.click(screen.getByRole('button', { name: /Descargar inventario/ }))
    await waitFor(() => expect(inventory).toHaveBeenCalledWith('csv', 'machines'))
  })

  it('exporta los movimientos con los filtros y no deja un rango al revés', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-20' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-10' } })
    expect(await screen.findByText('La fecha «Desde» no puede ser posterior a «Hasta».')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar movimientos/ })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-25' } })
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'EXIT')
    await userEvent.click(screen.getAllByRole('button', { name: 'CSV' })[1]!)
    await userEvent.click(screen.getByRole('button', { name: /Descargar movimientos/ }))
    await waitFor(() => expect(movements).toHaveBeenCalledWith('csv', { dateFrom: '2026-11-20', dateTo: '2026-11-25', type: 'EXIT', status: undefined }))
  })
})
