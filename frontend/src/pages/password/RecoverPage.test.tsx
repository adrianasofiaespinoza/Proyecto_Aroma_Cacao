import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ToastProvider } from '../../components/ui'
import { RecoverPage } from './RecoverPage'
import { ApiError, describeDetail } from '../../lib/errors'

const recover = vi.fn()
vi.mock('../../api/endpoints', () => ({ recoverPassword: (...a: unknown[]) => recover(...a) }))
vi.mock('../../app/ThemeProvider', () => ({ useTheme: () => ({ tenant: { name: 'Aroma Cacao S.A.', shortName: 'Aroma Cacao' } }) }))

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/recuperar']}>
        <Routes>
          <Route path="/recuperar" element={<RecoverPage />} />
          <Route path="/login" element={<p>Pantalla de login</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function fill(code = 'abcd efgh jkmn') {
  await userEvent.type(screen.getByRole('textbox', { name: /Correo/ }), 'luis@x.ec')
  await userEvent.type(screen.getByRole('textbox', { name: /Código de recuperación/ }), code)
  await userEvent.type(screen.getByLabelText(/Contraseña nueva/), 'Recuperada123')
  await userEvent.type(screen.getByLabelText(/Repite la contraseña/), 'Recuperada123')
  await userEvent.click(screen.getByRole('button', { name: /Cambiar contraseña/ }))
}

describe('Recuperar contraseña con el código, sin el coordinador', () => {
  it('cambia la contraseña y muestra el código nuevo antes de volver al login', async () => {
    recover.mockResolvedValueOnce('NNNN-PPPP-QQQQ')
    renderPage()
    await fill()
    await waitFor(() => expect(recover).toHaveBeenCalledWith({ email: 'luis@x.ec', recovery_code: 'abcd efgh jkmn', new_password: 'Recuperada123' }))
    expect(await screen.findByText('NNNN-PPPP-QQQQ')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(/Ya guardé mi código/))
    await userEvent.click(screen.getByRole('button', { name: /Ir a iniciar sesión/ }))
    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument()
  })

  it('explica cuando el correo o el código no coinciden', async () => {
    const detail = 'Invalid email or recovery code'
    recover.mockRejectedValueOnce(new ApiError(400, detail, { ...describeDetail(detail, 400) }))
    renderPage()
    await fill()
    expect(await screen.findByText('El correo o el código no coinciden')).toBeInTheDocument()
  })

  it('no envía un código incompleto', async () => {
    recover.mockClear()
    renderPage()
    await fill('ABCD')
    expect(await screen.findByText(/El código tiene 12 letras y números/)).toBeInTheDocument()
    expect(recover).not.toHaveBeenCalled()
  })

  it('el ícono (i) explica qué es el código', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Qué es «Código de recuperación»/ }))
    expect(screen.getByRole('note')).toHaveTextContent(/cuando elegiste tu contraseña/)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
