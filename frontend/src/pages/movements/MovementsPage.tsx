import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMovements } from '../../api/hooks'
import { useInventory } from '../../api/useInventory'
import { useSessionUser } from '../../app/AuthProvider'
import {
  Button, CodeTag, DataTable, FilterBar, IconButton, PageHeader, Panel, RoleGate, SearchInput, Segmented, Select, StatusBadge, TypeTag, type Column,
} from '../../components/ui'
import { STATUS_TO_BACKEND, TYPE_TO_BACKEND, type UiMovementStatus, type UiMovementType } from '../../lib/domain'
import { fmtDateTime } from '../../lib/format'
import { can } from '../../lib/permissions'
import { movementView, type MovementView } from './movementView'

const TYPES: { value: UiMovementType | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'entrada', label: 'Entradas' },
  { value: 'salida', label: 'Salidas' },
  { value: 'ajuste', label: 'Ajustes' },
]

function monthLabel() {
  const s = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function MovementsPage() {
  const user = useSessionUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const reviewer = can(user.role, 'autorizar')
  // Quien autoriza llega a lo que espera su revisión; el resto ve todo su historial.
  const defaultEstado = reviewer ? 'pendiente' : 'todos'
  const estado = (params.get('estado') ?? defaultEstado) as UiMovementStatus | 'todos'
  const tipo = (params.get('tipo') ?? 'todos') as UiMovementType | 'todos'
  const q = params.get('q') ?? ''
  const setParam = (key: string, value: string, fallback = 'todos') => {
    const next = new URLSearchParams(params)
    if (!value || value === fallback) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const inv = useInventory({ loans: true })
  const movements = useMovements({
    ...(estado !== 'todos' ? { status: STATUS_TO_BACKEND[estado] } : {}),
    ...(tipo !== 'todos' ? { type: TYPE_TO_BACKEND[tipo] } : {}),
  })
  const pending = useMovements({ status: 'pending' })

  const rows = useMemo(() => {
    const list = (movements.data ?? []).map((m) => movementView(inv, m))
    const needle = q.trim().toLowerCase()
    const filtered = needle
      ? list.filter((v) =>
          [v.code, v.m.reason, v.m.work_order_number, v.m.requesting_user_name, ...v.lines.map((l) => `${l.product?.internal_code ?? ''} ${l.product?.name ?? ''}`)]
            .join(' ')
            .toLowerCase()
            .includes(needle),
        )
      : list
    return filtered.sort((a, b) => b.m.date.localeCompare(a.m.date))
  }, [movements.data, inv, q])

  const pendingCount = pending.data?.length ?? 0
  const states = [
    { value: 'pendiente', label: `Pendientes · ${pendingCount}` },
    { value: 'autorizado', label: 'Autorizados' },
    { value: 'rechazado', label: 'Rechazados' },
    { value: 'todos', label: 'Todos' },
  ]

  const columns: Column<MovementView>[] = [
    {
      key: 'code', header: 'Movimiento', mobile: 'subtitle', width: 190,
      render: (v) => <div className="mv-id"><TypeTag type={v.type} /><CodeTag>{v.code}</CodeTag><span className="bd-cell-sub bd-num">{fmtDateTime(v.m.date)}</span></div>,
    },
    {
      key: 'detail', header: 'Detalle', mobile: 'title',
      render: (v) => (
        <>
          <div className="bd-cell-title">{v.summary}</div>
          <div className="bd-cell-sub">{[v.first?.lot ? `Lote ${v.first.lot.lot_number}` : '', v.first?.machine ? `→ ${v.first.machine.name}` : ''].filter(Boolean).join(' · ')}</div>
        </>
      ),
    },
    {
      key: 'reason', header: 'Motivo / OT', mobile: 'wide', mobileLabel: 'Motivo',
      render: (v) => <><div>{v.m.reason || <span className="bd-muted">Sin motivo</span>}</div>{v.m.work_order_number && <div className="bd-cell-sub bd-mono">{v.m.work_order_number}</div>}</>,
    },
    { key: 'by', header: 'Solicitó', width: 120, mobile: 'meta', render: (v) => v.m.requesting_user_name ?? '—' },
    // Quien autorizó o rechazó. En «Pendientes» nadie ha revisado aún, así que la columna no se muestra.
    ...(estado === 'pendiente' ? [] : [{ key: 'reviewer', header: 'Revisó', width: 120, mobile: 'meta', render: (v: MovementView) => v.m.authorizing_user_name ?? <span className="bd-muted">—</span> } as Column<MovementView>]),
    { key: 'status', header: 'Estado', mobile: 'badge', render: (v) => <StatusBadge status={v.status} /> },
  ]

  const state = movements.isLoading || inv.isLoading ? 'loading' : movements.isError ? 'error' : 'ready'

  return (
    <>
      <PageHeader
        title="Movimientos"
        subtitle={`${monthLabel()} · ${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'} de autorizar`}
        actions={
          <RoleGate role={user.role} action="solicitar">
            <Button variant="primary" icon="plus-lg" onClick={() => navigate('/movimientos/nueva')}>Nueva solicitud</Button>
          </RoleGate>
        }
      />
      <Panel flush>
        <FilterBar>
          <SearchInput placeholder="Buscar por código, producto u OT" value={q} onChange={(e) => setParam('q', e.target.value)} />
          <div className="pr-filter mv-type"><Select aria-label="Tipo" value={tipo} onChange={(e) => setParam('tipo', e.target.value)} options={TYPES} /></div>
          <Segmented label="Estado" value={estado} onChange={(v) => setParam('estado', v, defaultEstado)} options={states} />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey="code"
          rowTone={(v) => (v.status === 'pendiente' ? 'pending' : null)}
          caption="Movimientos"
          state={state}
          onRetry={() => { void movements.refetch(); inv.refetch() }}
          loadingLabel="Cargando movimientos…"
          empty={{
            icon: 'arrow-left-right',
            title: estado === 'pendiente' ? 'No hay solicitudes pendientes' : 'No hay movimientos con esos filtros',
            text: estado === 'pendiente' ? 'Todo lo solicitado ya fue revisado.' : 'Cambia el tipo o el estado, o limpia la búsqueda.',
          }}
          onRowClick={(v) => navigate(`/movimientos/${v.m.id}`)}
          mobileActions={(v) => (
            <Button variant={v.status === 'pendiente' && reviewer ? 'secondary' : 'ghost'} iconRight="chevron-right" onClick={(e) => { e.stopPropagation(); navigate(`/movimientos/${v.m.id}`) }}>{v.status === 'pendiente' && reviewer ? 'Revisar' : 'Ver detalle'}</Button>
          )}
          actions={(v) =>
            v.status === 'pendiente' && reviewer ? (
              <Button size="sm" variant="secondary" iconRight="chevron-right" onClick={(e) => { e.stopPropagation(); navigate(`/movimientos/${v.m.id}`) }}>Revisar</Button>
            ) : (
              <IconButton icon="chevron-right" label={`Ver ${v.code}`} onClick={(e) => { e.stopPropagation(); navigate(`/movimientos/${v.m.id}`) }} />
            )
          }
        />
      </Panel>
    </>
  )
}
