import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppShell } from './AppShell'
import { RoleGate } from './RoleGate'
import { StatusBadge } from './StatusBadge'
import { StockImpact } from './StockImpact'
import { Button } from './Button'

const brand = { name: 'Aroma Cacao S.A.', shortName: 'Aroma Cacao', product: 'Mantenimiento' }

describe('Pendiente nunca parece aplicado', () => {
  it('la insignia Pendiente dice «No aplicado al stock» y lleva el rayado', () => {
    const { container } = render(<StatusBadge status="pendiente" explain />)
    expect(screen.getByText('No aplicado al stock')).toBeInTheDocument()
    expect(container.querySelector('.bd-badge-pendiente')).toHaveClass('bd-hatch')
  })
  it('solo Autorizado dice «Aplicado al stock»', () => {
    render(<StatusBadge status="autorizado" explain />)
    expect(screen.getByText('Aplicado al stock')).toBeInTheDocument()
    expect(screen.queryByText('No aplicado al stock')).not.toBeInTheDocument()
  })
  it('el impacto pendiente avisa «Solo si se autoriza» y el bloqueado «Supera lo disponible»', () => {
    const { rerender } = render(<StockImpact before={4} after={2} />)
    expect(screen.getByText('Solo si se autoriza')).toBeInTheDocument()
    rerender(<StockImpact before={2} after={-2} blocked />)
    expect(screen.getByText('Supera lo disponible')).toBeInTheDocument()
  })
})

describe('Cada rol ve solo lo que puede hacer', () => {
  it('RoleGate no renderiza los botones de escritura para Solo lectura', () => {
    render(
      <RoleGate role="lectura" action="solicitar">
        <Button>Nueva solicitud</Button>
      </RoleGate>,
    )
    expect(screen.queryByRole('button', { name: 'Nueva solicitud' })).not.toBeInTheDocument()
  })
  it('RoleGate sí los muestra al Operador', () => {
    render(
      <RoleGate role="operador" action="solicitar">
        <Button>Nueva solicitud</Button>
      </RoleGate>,
    )
    expect(screen.getByRole('button', { name: 'Nueva solicitud' })).toBeInTheDocument()
  })
  it('Solo lectura no ve Usuarios en la navegación ni el contador de pendientes', () => {
    render(
      <MemoryRouter>
        <AppShell brand={brand} user={{ name: 'Patricia Vera', role: 'lectura' }} pendingCount={4} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('4 por autorizar')).not.toBeInTheDocument()
    expect(screen.getAllByText('Solo lectura').length).toBeGreaterThan(0)
  })
  it('el Coordinador ve Usuarios y el contador de pendientes', () => {
    render(
      <MemoryRouter>
        <AppShell brand={brand} user={{ name: 'Marcela Andrade', role: 'coordinador' }} pendingCount={4} />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link', { name: /Usuarios/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('4 por autorizar').length).toBeGreaterThan(0)
  })
})
