import type React from 'react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useMovements } from '../api/hooks'
import { useInventory } from '../api/useInventory'
import { useSessionUser } from '../app/AuthProvider'
import { Button, CodeTag, KpiStrip, PageHeader, Panel, RoleGate, StatusBadge, TypeTag, type KpiItem } from '../components/ui'
import { isLowStock, lotState } from '../lib/domain'
import { fmtDateTime, fmtLongDate, n } from '../lib/format'
import { can } from '../lib/permissions'
import { movementView, type MovementView } from './movements/movementView'

/** El inicio es un resumen: lo demás está en «Ver todas». */
const PENDING_LIMIT = 3
const LOW_LIMIT = 5

function PendingList({ items, review, onOpen }: { items: MovementView[]; review: boolean; onOpen: (id: number) => void }) {
  return (
    <ul className="db-pend">
      {items.map((v) => (
        <li key={v.m.id} className="bd-hatch">
          <div className="db-pend-top"><TypeTag type={v.type} /><CodeTag>{v.code}</CodeTag><span className="db-pend-time">{fmtDateTime(v.m.date)}</span></div>
          <div className="db-pend-item"><b>{v.first?.product?.name ?? 'Producto'}</b> · {v.first?.qtyLabel}{v.lines.length > 1 ? ` y ${v.lines.length - 1} más` : ''}</div>
          <div className="db-pend-by">{v.m.requesting_user_name ?? '—'}{v.first?.machine ? ` → ${v.first.machine.name}` : ''}</div>
          {review ? (
            <Button variant="secondary" size="sm" iconRight="chevron-right" onClick={() => onOpen(v.m.id)}>Revisar</Button>
          ) : (
            <StatusBadge status="pendiente" />
          )}
        </li>
      ))}
    </ul>
  )
}

export function DashboardPage() {
  const user = useSessionUser()
  const navigate = useNavigate()
  const inv = useInventory()
  const pending = useMovements({ status: 'pending' })
  const all = useMovements()

  const reviewer = can(user.role, 'autorizar')
  const requester = can(user.role, 'solicitar')

  const low = useMemo(
    () => inv.products.filter(isLowStock).sort((a, b) => n(a.current_stock) / Math.max(n(a.minimum_stock), 1) - n(b.current_stock) / Math.max(n(b.minimum_stock), 1)),
    [inv.products],
  )
  const active = inv.products.filter((p) => p.status === 'active')
  const categoriesUsed = new Set(active.map((p) => p.category_id)).size
  const loaned = inv.loans.filter((l) => l.status === 'loaned')
  const workers = new Set(loaned.map((l) => l.worker_id)).size
  const expiring = inv.lots.filter((l) => n(l.remaining_quantity) > 0 && ['vencido', 'por-vencer'].includes(lotState(l)))
  const expired = expiring.filter((l) => lotState(l) === 'vencido').length
  const pendingViews = useMemo(() => (pending.data ?? []).map((m) => movementView(inv, m)).sort((a, b) => a.m.date.localeCompare(b.m.date)), [pending.data, inv])
  const mine = pendingViews.filter((v) => v.m.requesting_user_id === user.id)
  const now = new Date()
  const monthMoves = (all.data ?? []).filter((m) => {
    const d = new Date(m.date)
    return m.status === 'authorized' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthIn = monthMoves.filter((m) => m.type === 'ENTRY').length
  const monthOut = monthMoves.filter((m) => m.type === 'EXIT').length

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      title="Inicio"
      subtitle={fmtLongDate()}
      actions={actions}
    />
  )

  const kpiActive: KpiItem = { label: 'Productos activos', value: active.length, icon: 'box-seam', hint: `En ${categoriesUsed} ${categoriesUsed === 1 ? 'categoría' : 'categorías'}`, href: '/productos' }
  const kpiMonth: KpiItem = { label: 'Movimientos del mes', value: monthMoves.length, icon: 'arrow-left-right', hint: `${monthIn} ${monthIn === 1 ? 'entrada' : 'entradas'} · ${monthOut} ${monthOut === 1 ? 'salida' : 'salidas'}`, href: '/movimientos?estado=autorizado' }
  const kpiLoans: KpiItem = { label: 'Herramientas prestadas', value: loaned.length, icon: 'tools', hint: `${workers} ${workers === 1 ? 'trabajador' : 'trabajadores'}`, href: '/prestamos' }
  const kpiLots: KpiItem = { label: 'Lotes ≤ 30 días', value: expiring.length, icon: 'calendar-x', tone: expired ? 'danger' : expiring.length ? 'info' : undefined, hint: expired ? `${expired} ya ${expired === 1 ? 'vencido' : 'vencidos'}` : 'Ninguno vencido', href: '/productos?lotes=por-vencer' }

  const lowBody = inv.isLoading ? (
    <p className="bd-muted" style={{ margin: 0 }}>Cargando alertas…</p>
  ) : inv.isError ? (
    <p className="bd-muted" style={{ margin: 0 }}>No se pudieron cargar las alertas. <Button size="sm" variant="ghost" onClick={inv.refetch}>Reintentar</Button></p>
  ) : low.length ? (
    <div className="db-low" role="table" aria-label="Productos con stock igual o menor al mínimo">
      <div className="db-low-head" role="row"><span role="columnheader">Producto</span><span role="columnheader">Ubicación</span></div>
      {low.slice(0, LOW_LIMIT).map((p) => (
        <button key={p.id} type="button" className="db-low-row" role="row" onClick={() => navigate(`/productos/${p.id}`)}>
          <span role="cell"><b>{p.name}</b><small><span className="bd-mono">{p.internal_code}</span>{p.brand ? ` · ${p.brand}` : ''}</small></span>
          <span role="cell" className="bd-mono">{p.physical_location ?? '—'}</span>
        </button>
      ))}
    </div>
  ) : (
    <p className="bd-muted" style={{ margin: 0 }}>Todo el stock está sobre el mínimo.</p>
  )
  const lowPanel = (
    <Panel title="Alertas de stock bajo" icon="exclamation-triangle-fill" tone="danger" count={`${low.length} productos`} actions={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('/productos?estado=stock-bajo')}>Ver productos</Button>}>
      {lowBody}
    </Panel>
  )

  if (!reviewer) {
    return (
      <>
        {header()}
        {requester && (
          <div className="db-actions">
            <Button variant="primary" size="xl" icon="box-arrow-up" onClick={() => navigate('/movimientos/nueva?tipo=salida')}>Pedir salida</Button>
            <Button variant="secondary" size="xl" icon="box-arrow-in-down" onClick={() => navigate('/movimientos/nueva?tipo=entrada')}>Pedir entrada</Button>
            <Button variant="secondary" size="xl" icon="tools" onClick={() => navigate('/prestamos')}>Prestar herramienta</Button>
            <Button variant="secondary" size="xl" icon="arrow-counterclockwise" onClick={() => navigate('/prestamos?estado=prestado')}>Devolver</Button>
          </div>
        )}
        {requester && (
          <Panel title="Mis solicitudes" icon="file-earmark-text" tone="pending" count={`${mine.length} ${mine.length === 1 ? 'pendiente' : 'pendientes'}`} actions={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('/movimientos')}>Ver todas</Button>}>
            {mine.length ? <PendingList items={mine.slice(0, PENDING_LIMIT)} review={false} onOpen={(id) => navigate(`/movimientos/${id}`)} /> : <p className="bd-muted" style={{ margin: 0 }}>No tienes solicitudes esperando revisión.</p>}
          </Panel>
        )}
        <KpiStrip items={[kpiActive, kpiLoans, kpiLots]} />
        {lowPanel}
      </>
    )
  }

  return (
    <>
      {header(<RoleGate role={user.role} action="solicitar"><Button variant="primary" icon="plus-lg" onClick={() => navigate('/movimientos/nueva')}>Nueva solicitud</Button></RoleGate>)}
      <KpiStrip items={[kpiActive, kpiMonth, kpiLoans, kpiLots]} />
      <div className="bd-split db-split">
        {lowPanel}
        <Panel title="Por autorizar" icon="hourglass-split" tone="pending" count={`${pendingViews.length} solicitudes`} actions={<Button size="sm" variant="ghost" iconRight="chevron-right" onClick={() => navigate('/movimientos?estado=pendiente')}>Ver todas</Button>}>
          {pending.isLoading ? (
            <p className="bd-muted" style={{ margin: 0 }}>Cargando solicitudes…</p>
          ) : pendingViews.length ? (
            <PendingList items={pendingViews.slice(0, PENDING_LIMIT)} review onOpen={(id) => navigate(`/movimientos/${id}`)} />
          ) : (
            <p className="bd-muted" style={{ margin: 0 }}>No hay solicitudes esperando revisión.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
