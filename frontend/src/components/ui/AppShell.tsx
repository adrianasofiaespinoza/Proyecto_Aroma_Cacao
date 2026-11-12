import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ROLES, can, type Role } from '../../lib/permissions'
import { initials } from '../../lib/format'
import { AlertsPanel, type AlertItem } from './AlertsPanel'
import { BrandMark, type Brand } from './BrandMark'
import { Icon } from './Icon'
import { NotificationBell } from './NotificationBell'
import { useGo } from './navigation'

export interface ShellUser { name: string; role: Role }

export interface NavItem { id: string; label: string; icon: string; href: string; m?: boolean; action?: 'usuarios' }

export const NAV: NavItem[] = [
  { id: 'inicio', label: 'Inicio', icon: 'house-door', href: '/', m: true },
  { id: 'productos', label: 'Productos', icon: 'box-seam', href: '/productos', m: true },
  { id: 'movimientos', label: 'Movimientos', icon: 'arrow-left-right', href: '/movimientos', m: true },
  { id: 'prestamos', label: 'Préstamos', icon: 'tools', href: '/prestamos', m: true },
  { id: 'maquinas', label: 'Máquinas', icon: 'gear-wide-connected', href: '/maquinas' },
  { id: 'proveedores', label: 'Proveedores', icon: 'truck', href: '/proveedores' },
  { id: 'usuarios', label: 'Usuarios', icon: 'people', href: '/usuarios', action: 'usuarios' },
]

export interface AppShellProps {
  brand: Brand
  user: ShellUser
  /** id del NAV activo */
  current?: string
  pendingCount?: number
  alerts?: AlertItem[]
  alertsOpen?: boolean
  onNavigate?: (id: string) => void
  onToggleAlerts?: () => void
  /** Menú que se abre al pulsar el usuario (tema, cerrar sesión). */
  userMenu?: ReactNode
  banner?: ReactNode
  overlay?: ReactNode
  version?: string
  children?: ReactNode
}

export function AppShell({ brand, user, current = 'inicio', pendingCount = 0, alerts = [], alertsOpen, onNavigate, onToggleAlerts, userMenu, banner, overlay, version = 'Bodega v1.0', children }: AppShellProps) {
  const go = useGo()
  const items = NAV.filter((n) => !n.action || can(user.role, n.action))
  const role = ROLES[user.role] ?? ROLES.lectura
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [menuOpen])

  const link = (n: NavItem) => (
    <a
      key={n.id}
      href={n.href}
      className="bd-nav-item"
      aria-current={n.id === current ? 'page' : undefined}
      onClick={(e) => {
        go(n.href)(e)
        onNavigate?.(n.id)
      }}
    >
      <Icon name={n.icon} />
      {n.label}
      {n.id === 'movimientos' && pendingCount > 0 && can(user.role, 'autorizar') && (
        <span className="bd-nav-count" aria-label={`${pendingCount} por autorizar`}>{pendingCount}</span>
      )}
    </a>
  )
  const mobileItems = items.filter((n) => n.m)
  const moreActive = !mobileItems.some((n) => n.id === current)

  return (
    <div className="bd-app">
      <div className="bd-layout">
        <aside className="bd-rail" aria-label="Navegación principal">
          <div className="bd-rail-brand"><BrandMark brand={brand} /></div>
          <nav>{items.map(link)}</nav>
          <div className="bd-rail-foot">{version}</div>
        </aside>
        <div className="bd-main">
          <header className="bd-header">
            <div className="bd-mhead-brand"><BrandMark brand={brand} layout="row" /></div>
            <div className="bd-header-ctx"><Icon name="building" /><b>{brand.name}</b><span>·</span><span>Bodega de mantenimiento</span></div>
            <div className="bd-header-right">
              <NotificationBell count={alerts.length} open={alertsOpen} onToggle={onToggleAlerts} />
              <div className="bd-usermenu" ref={menuRef}>
                <button type="button" className="bd-user bd-focusable" aria-haspopup="menu" aria-expanded={menuOpen ? 'true' : 'false'} onClick={() => setMenuOpen((o) => !o)}>
                  <span className="bd-avatar" aria-hidden="true">{initials(user.name)}</span>
                  <span className="bd-user-text">
                    <span className="bd-user-name">{user.name}</span><br />
                    <span className="bd-role"><Icon name={role.icon} />{role.label}</span>
                  </span>
                  <span className="bd-sr">{user.name}, {role.label}. Abrir menú de usuario</span>
                </button>
                {menuOpen && userMenu && (
                  <div className="bd-usermenu-pop" role="menu" onClick={() => setMenuOpen(false)}>{userMenu}</div>
                )}
              </div>
            </div>
          </header>
          {banner}
          <main className="bd-content">{children}</main>
        </div>
      </div>
      {alertsOpen && <AlertsPanel alerts={alerts} onClose={onToggleAlerts} />}
      <nav className="bd-bottomnav" aria-label="Navegación principal">
        {mobileItems.map(link)}
        <a href="/mas" className="bd-nav-item" aria-current={moreActive ? 'page' : undefined} onClick={go('/mas')}>
          <Icon name="grid-3x3-gap" />Más
        </a>
      </nav>
      {overlay}
    </div>
  )
}
