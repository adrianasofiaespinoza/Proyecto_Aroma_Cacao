import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ToastProvider } from '../components/ui'
import { ResetPasswordPage } from './ResetPasswordPage'
import { ApiError, describeDetail } from '../lib/errors'

const check = vi.fn()
const complete = vi.fn()
vi.mock('../api/endpoints', () => ({
  checkPasswordReset: (...a: unknown[]) => check(...a),
  completePasswordReset: (...a: unknown[]) => complete(...a),
}))
vi.mock('../app/ThemeProvider', () => ({
  useTheme: () => ({ tenant: { name: 'Aroma Cacao S.A.', shortName: 'Aroma Cacao' } }),
}))

function renderAt(url: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/restablecer" element={<ResetPasswordPage />} />
          <Route path="/login" element={<p>Pantalla de login</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('Restablecer contraseña con enlace', () => {
  it('con un enlace válido la persona elige su contraseña y vuelve al login', async () => {
    check.mockResolvedValueOnce({ full_name: 'Luis Cedeño', email: 'l@x.ec' })
    complete.mockResolvedValueOnce('ABCD-EFGH-JKMN')
    renderAt('/restablecer?token=abc123')
    expect(await screen.findByText('Luis Cedeño')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Contraseña nueva/), 'MiClaveNueva1')
    await userEvent.type(screen.getByLabelText(/Repite la contraseña/), 'MiClaveNueva1')
    await userEvent.click(screen.getByRole('button', { name: /Guardar contraseña/ }))
    await waitFor(() => expect(complete).toHaveBeenCalledWith('abc123', 'MiClaveNueva1'))
    // Antes de volver al login ve su código de recuperación y confirma que lo guardó
    expect(await screen.findByText('ABCD-EFGH-JKMN')).toBeInTheDocument()
    const go = screen.getByRole('button', { name: /Ir a iniciar sesión/ })
    expect(go).toBeDisabled()
    await userEvent.click(screen.getByLabelText(/Ya guardé mi código/))
    await userEvent.click(go)
    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument()
  })

  it('no envía si las contraseñas no coinciden', async () => {
    check.mockResolvedValueOnce({ full_name: 'Luis Cedeño', email: 'l@x.ec' })
    complete.mockClear()
    renderAt('/restablecer?token=abc123')
    await screen.findByText('Luis Cedeño')
    await userEvent.type(screen.getByLabelText(/Contraseña nueva/), 'MiClaveNueva1')
    await userEvent.type(screen.getByLabelText(/Repite la contraseña/), 'OtraDistinta1')
    await userEvent.click(screen.getByRole('button', { name: /Guardar contraseña/ }))
    expect(await screen.findByText('No coincide con la contraseña nueva.')).toBeInTheDocument()
    expect(complete).not.toHaveBeenCalled()
  })

  it('explica que un enlace usado o vencido ya no sirve', async () => {
    const detail = 'This password reset link is invalid or has expired'
    check.mockRejectedValueOnce(new ApiError(404, detail, { ...describeDetail(detail, 404) }))
    renderAt('/restablecer?token=viejo')
    expect(await screen.findByText('El enlace ya no sirve')).toBeInTheDocument()
  })

  it('traduce el bloqueo por contraseña inicial', () => {
    expect(describeDetail('Password change required', 403).code).toBe('CAMBIAR_CLAVE')
  })
})
