import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ToastProvider } from '../../components/ui'
import type { ImportPreview, ImportSheet } from '../../api/endpoints'

const preview = vi.fn()
const confirm = vi.fn()

vi.mock('../../api/endpoints', () => {
  class ImportFileError extends Error {}
  class ImportHasErrors extends Error {}
  return {
    ImportFileError,
    ImportHasErrors,
    previewImport: (...a: unknown[]) => preview(...a),
    downloadImportTemplate: vi.fn(),
  }
})
vi.mock('../../api/hooks', () => ({
  useConfirmImport: () => ({ mutateAsync: (...a: unknown[]) => confirm(...a), isPending: false }),
}))

const { ImportPage } = await import('./ImportPage')
const { ImportFileError } = await import('../../api/endpoints')

function sheet(partial: Partial<ImportSheet>): ImportSheet {
  return {
    kind: 'products',
    title: 'Productos',
    columns: [],
    error: null,
    unknown_columns: [],
    rows: [],
    counts: { new: 0, existing: 0, error: 0 },
    ...partial,
  }
}

function renderPage() {
  render(
    <ToastProvider>
      <MemoryRouter>
        <ImportPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function uploadFile(name = 'inventario.xlsx') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await userEvent.upload(input, new File(['contenido'], name))
}

describe('Importar inventario', () => {
  beforeEach(() => {
    preview.mockReset()
    confirm.mockReset()
  })

  it('con errores muestra cada mensaje y no deja importar', async () => {
    const result: ImportPreview = {
      can_confirm: false,
      new_categories: [],
      sheets: [sheet({
        rows: [{ row: 2, key: 'REP-1', status: 'error', messages: ['Unidad: «caja» no existe.'], changes: {}, values: { name: 'Rodamiento' } }],
        counts: { new: 0, existing: 0, error: 1 },
      })],
    }
    preview.mockResolvedValueOnce(result)
    renderPage()
    await uploadFile()
    // La tabla pinta cada fila dos veces: en escritorio y como tarjeta en el celular
    expect((await screen.findAllByText('Unidad: «caja» no existe.'))[0]).toBeInTheDocument()
    expect(screen.getByText('El archivo tiene 1 error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Importar$/ })).toBeDisabled()
  })

  it('lo que ya existe se actualiza solo si se marca', async () => {
    preview.mockResolvedValueOnce({
      can_confirm: true,
      new_categories: ['Lubricantes'],
      sheets: [sheet({
        rows: [
          { row: 2, key: 'NUEVO-1', status: 'new', messages: [], changes: {}, values: { name: 'Grasa' } },
          { row: 3, key: 'REP-1', status: 'existing', messages: ['Ya existe un producto con este código.'], changes: { name: ['Viejo', 'Nuevo'] }, values: { name: 'Nuevo' } },
        ],
        counts: { new: 1, existing: 1, error: 0 },
      })],
    } satisfies ImportPreview)
    confirm.mockResolvedValueOnce({
      products_created: 1, products_updated: 1, machines_created: 0, machines_updated: 0, suppliers_created: 0,
      suppliers_updated: 0, categories_created: 1, skipped: 0, stock_rows: 0, movement_id: null,
    })
    renderPage()
    await uploadFile()
    expect((await screen.findAllByText('Nombre:', { exact: false }))[0]).toBeInTheDocument()
    expect(screen.getByText(/Lubricantes/)).toBeInTheDocument()

    await userEvent.click(screen.getAllByLabelText('Actualizar con los datos del archivo')[0]!)
    await userEvent.click(screen.getByRole('button', { name: /^Importar$/ }))
    // El diálogo resume lo que pasará antes de confirmar
    expect(await screen.findByText('1 nuevo · 1 actualizado')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: /^Importar$/ }).at(-1)!)

    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    expect(confirm.mock.calls[0]![0]).toMatchObject({ upload: { filename: 'inventario.xlsx' }, updateRows: { products: [3] } })
    expect(await screen.findByText('Inventario importado')).toBeInTheDocument()
  })

  it('explica por qué no se pudo leer el archivo', async () => {
    preview.mockRejectedValueOnce(new ImportFileError('El Excel no tiene ninguna hoja reconocida.'))
    renderPage()
    await uploadFile()
    expect(await screen.findByText('El Excel no tiene ninguna hoja reconocida.')).toBeInTheDocument()
  })

  it('rechaza otros formatos sin enviarlos', async () => {
    renderPage()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['x'], 'inventario.xls'), { applyAccept: false })
    expect(await screen.findByText('Formato no admitido')).toBeInTheDocument()
    expect(preview).not.toHaveBeenCalled()
  })
})
