import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth, useSessionUser } from './AuthProvider'
import { THEMES, useTheme } from './ThemeProvider'
import { AppShell, ConnectionError, Icon, type AlertItem } from '../components/ui'
import { useAlerts, useLots, useMovements, useProducts } from '../api/hooks'
import { can } from '../lib/permissions'
import { lotDaysLabel, lotState } from '../lib/domain'
import { fmtDate, fmtQty, fmtRelative, movementCode, unitLabel } from '../lib/format'
import { useUnits } from '../api/hooks'
import { isConnectionError } from '../lib/errors'
import { APP_NAME, APP_VERSION } from '../config/tenant'

function currentNavId(pathname: string): string {
  const first = pathname.split('/')[1] ?? ''
  return first === '' ? 'inicio' : first
}

/** Alertas de la campana: stock bajo, solicitudes por autorizar y lotes por vencer. */
function useShellAlerts(role: string): { alerts: AlertItem[]; pendingCount: number; offline: boolean; retry: () => void } {
  const alerts = useAlerts()
  const products = useProducts()
  const units = useUnits()
  const pending = useMovements({ status: 'pending' })
  const lots = useLots()

  const list = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = []
    const pendingList = pending.data ?? []
    if (pendingList.length && can(role as never, 'autorizar')) {
      const oldest = [...pendingList].sort((a, b) => a.date.localeCompare(b.date))[0]
      out.push({
        tone: 'pending',
        title: `${pendingList.length} ${pendingList.length === 1 ? 'solicitud' : 'solicitudes'} por autorizar`,
        meta: oldest ? `La más antigua: ${fmtRelative(oldest.date)} · ${movementCode(oldest.id)}` : undefined,
        href: '/movimientos?estado=pendiente',
      })
    }
    const byId = new Map((products.data ?? []).map((p) => [p.id, p]))
    const unitById = new Map((units.data ?? []).map((u) => [u.id, u.abbreviation]))
    for (const a of alerts.data ?? []) {
      if (a.status !== 'active') continue
      const p = byId.get(a.product_id)
      if (!p) continue
      const u = unitLabel(unitById.get(p.unit_of_measure_id))
      out.push({
        tone: 'danger',
        title: `${p.name} bajo mínimo`,
        meta: `${fmtQty(p.current_stock, u)} · mínimo ${fmtQty(p.minimum_stock, u)}${p.physical_location ? ` · ${p.physical_location}` : ''}`,
        href: `/productos?estado=stock-bajo`,
      })
    }
    for (const lot of lots.data ?? []) {
      const state = lotState(lot)
      if (state !== 'por-vencer' && state !== 'vencido') continue
      const p = byId.get(lot.product_id)
      if (!p || Number(lot.remaining_quantity) <= 0) continue
      const u = unitLabel(unitById.get(p.unit_of_measure_id))
      out.push({
        tone: state === 'vencido' ? 'danger' : 'info',
        icon: state === 'vencido' ? 'calendar-x' : 'calendar-event',
        title: `${p.name} lote ${lot.lot_number} ${state === 'vencido' ? 'vencido' : `vence el ${fmtDate(lot.expiration_date)}`}`,
        meta: `Quedan ${fmtQty(lot.remaining_quantity, u)} · ${lotDaysLabel(lot)}`,
        href: `/productos/${p.id}/lotes`,
      })
    }
    return out
  }, [alerts.data, products.data, units.data, pending.data, lots.data, role])

  const offline = [alerts, products, pending, lots].some((q) => q.isError && isConnectionError(q.error))
  const retry = () => {
    alerts.refetch()
    products.refetch()
    pending.refetch()
    lots.refetch()
  }
  return { alerts: list, pendingCount: pending.data?.length ?? 0, offline, retry }
}

export function AppLayout({ children }: { children: ReactNode }) {
  const user = useSessionUser()
  const { logout } = useAuth()
  const { tenant, theme, setTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const { alerts, pendingCount, offline, retry } = useShellAlerts(user.role)

  const userMenu = (
    <>
      <div className="bd-usermenu-head"><b>{user.name}</b><small>{user.email}</small></div>
      <div className="bd-usermenu-sec">Tema</div>
      {THEMES.map((t) => (
        <button key={t.value} type="button" role="menuitemradio" aria-checked={theme === t.value ? 'true' : 'false'} className="bd-usermenu-item" onClick={() => setTheme(t.value)}>
          <Icon name={t.icon} />{t.label}
          {theme === t.value && <Icon name="check-lg" className="bd-check-mark" />}
        </button>
      ))}
      <div className="bd-usermenu-sep" />
      <button
        type="button"
        role="menuitem"
        className="bd-usermenu-item bd-usermenu-danger"
        onClick={() => {
          void logout().then(() => navigate('/login', { replace: true }))
        }}
      >
        <Icon name="box-arrow-right" />Cerrar sesión
      </button>
    </>
  )

  return (
    <AppShell
      brand={{ name: tenant.name, shortName: tenant.shortName, product: tenant.product, logoSrc: tenant.logoSrc }}
      user={{ name: user.name, role: user.role }}
      current={currentNavId(location.pathname)}
      pendingCount={pendingCount}
      alerts={alerts}
      alertsOpen={alertsOpen}
      onToggleAlerts={() => setAlertsOpen((o) => !o)}
      onNavigate={() => setAlertsOpen(false)}
      userMenu={userMenu}
      version={`${APP_NAME} ${APP_VERSION}`}
      banner={offline ? <ConnectionError variant="banner" onRetry={retry} /> : undefined}
    >
      {children}
    </AppShell>
  )
}
