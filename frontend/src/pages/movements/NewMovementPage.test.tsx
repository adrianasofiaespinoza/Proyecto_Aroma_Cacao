import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../components/ui'
import { NewMovementPage } from './NewMovementPage'
import type { Product } from '../../api/types'

vi.mock('../../app/AuthProvider', () => ({
  useSessionUser: () => ({ id: 2, name: 'Luis Cedeño', email: 'l@x.ec', role: 'operador', backendRole: 'Operator' }),
}))

const product: Product = {
  id: 1, internal_code: 'ROD-0412', name: 'Rodamiento rígido de bolas 6205-2RS', brand: 'SKF', model: null, part_number: null,
  current_stock: '4.00', minimum_stock: '10.00', maximum_stock: '40.00', physical_location: 'A-03-2', status: 'active', requires_lot: false, category_id: 1, unit_of_measure_id: 1,
}
const createMovement = vi.fn()
vi.mock('../../api/endpoints', () => ({
  getProducts: () => Promise.resolve([product]),
  getCategories: () => Promise.resolve([{ id: 1, name: 'Rodamientos' }]),
  getUnits: () => Promise.resolve([{ id: 1, name: 'Unidad', abbreviation: 'u' }]),
  getLots: () => Promise.resolve([]),
  getMachines: () => Promise.resolve([]),
  getLoans: () => Promise.resolve([{ id: 9, worker_id: 1, worker_name: 'Jorge', product_id: 1, quantity: '2.00', loan_date: '2026-11-10T08:00:00', return_date: null, status: 'loaned' }]),
  createMovement: (...args: unknown[]) => createMovement(...args),
}))

function renderPage(search = '?tipo=salida&producto=1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/movimientos/nueva${search}`]}>
          <NewMovementPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Nueva solicitud', () => {
  it('exige el motivo en una salida y no envía sin él', async () => {
    renderPage()
    await screen.findByText('Rodamiento rígido de bolas 6205-2RS')
    await userEvent.click(screen.getByRole('button', { name: /Enviar solicitud/ }))
    expect(await screen.findByText('Escribe el motivo: es obligatorio en salidas y ajustes.')).toBeInTheDocument()
    expect(createMovement).not.toHaveBeenCalled()
  })
  it('bloquea una salida mayor a lo disponible (stock − prestado) y lo dice con cifras', async () => {
    renderPage()
    await screen.findByText('Rodamiento rígido de bolas 6205-2RS')
    // stock 4, prestadas 2 → disponible 2
    expect(screen.getByText(/Disponible: 2 u\./)).toBeInTheDocument()
    const plus = screen.getByRole('button', { name: /Sumar a Cantidad/ })
    await userEvent.click(plus)
    await userEvent.click(plus)
    expect(await screen.findByText('Máximo disponible: 2 u.')).toBeInTheDocument()
    expect(screen.getByText('Supera lo disponible')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Motivo/), 'Cambio de rodamiento')
    await userEvent.click(screen.getByRole('button', { name: /Enviar solicitud/ }))
    await waitFor(() => expect(createMovement).not.toHaveBeenCalled())
  })
  it('una entrada no exige motivo y se envía al backend', async () => {
    createMovement.mockResolvedValueOnce({ id: 77 })
    renderPage('?tipo=entrada&producto=1')
    await screen.findByText('Rodamiento rígido de bolas 6205-2RS')
    await userEvent.click(screen.getByRole('button', { name: /Enviar solicitud/ }))
    await waitFor(() => expect(createMovement).toHaveBeenCalledTimes(1))
    expect(createMovement.mock.calls[0]?.[0]).toMatchObject({ type: 'ENTRY', details: [{ product_id: 1, quantity: 1 }] })
  })
})
