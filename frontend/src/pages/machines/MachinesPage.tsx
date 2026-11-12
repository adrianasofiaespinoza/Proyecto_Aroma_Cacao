import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useInventory } from '../../api/useInventory'
import type { Machine } from '../../api/types'
import { useSessionUser } from '../../app/AuthProvider'
import { Button, CodeTag, DataTable, FilterBar, IconButton, PageHeader, Panel, RoleGate, SearchInput, type Column } from '../../components/ui'
import { can } from '../../lib/permissions'
import { MachineFormModal } from './MachineFormModal'
import { MachineParts } from './MachineParts'

export function MachinesPage() {
  const user = useSessionUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const inv = useInventory({ loans: false })
  const admin = can(user.role, 'administrar')
  const q = params.get('q') ?? ''
  const sel = Number(params.get('sel'))
  const [editing, setEditing] = useState<Machine | 'new' | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return inv.machines.filter((m) => !needle || `${m.identification_code} ${m.name} ${m.location ?? ''}`.toLowerCase().includes(needle)).sort((a, b) => a.identification_code.localeCompare(b.identification_code))
  }, [inv.machines, q])
  const selected = inv.machineById.get(sel) ?? rows[0]
  const areas = new Set(inv.machines.map((m) => (m.location ?? '').split('·')[0]?.trim()).filter(Boolean)).size
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const cols: Column<Machine>[] = [
    { key: 'code', header: 'Código', mobile: 'subtitle', render: (m) => <CodeTag>{m.identification_code}</CodeTag> },
    { key: 'name', header: 'Nombre', mobile: 'title', render: (m) => <span className="bd-cell-title">{m.name}</span> },
    { key: 'loc', header: 'Ubicación en planta', mobile: 'wide', render: (m) => m.location ?? '—' },
    { key: 'parts', header: 'Repuestos', align: 'right', mobile: 'meta', render: (m) => <b className="bd-num">{m.product_ids.length}</b> },
  ]

  return (
    <>
      <PageHeader
        title="Máquinas"
        subtitle={inv.isLoading ? 'Cargando…' : `${inv.machines.length} ${inv.machines.length === 1 ? 'máquina' : 'máquinas'}${areas ? ` en ${areas} ${areas === 1 ? 'área' : 'áreas'}` : ''}`}
        actions={<RoleGate role={user.role} action="administrar"><Button variant="primary" icon="plus-lg" onClick={() => setEditing('new')}>Nueva máquina</Button></RoleGate>}
      />
      <div className="mq-split">
        <Panel flush>
          <FilterBar><SearchInput placeholder="Buscar por nombre o código" value={q} onChange={(e) => setParam('q', e.target.value)} /></FilterBar>
          <DataTable
            columns={cols}
            rows={rows}
            rowTone={(m) => (m.id === selected?.id ? 'selected' : null)}
            caption="Máquinas"
            state={inv.isLoading ? 'loading' : inv.isError ? 'error' : 'ready'}
            onRetry={inv.refetch}
            loadingLabel="Cargando máquinas…"
            empty={{ icon: 'gear-wide-connected', title: q ? `Sin resultados para “${q}”` : 'No hay máquinas registradas', text: admin && !q ? 'Crea la primera con «Nueva máquina».' : undefined }}
            onRowClick={(m) => setParam('sel', String(m.id))}
            actions={admin ? (m) => <IconButton icon="pencil" label={`Editar ${m.identification_code}`} onClick={(e) => { e.stopPropagation(); setEditing(m) }} /> : null}
            mobileActions={(m) => <><Button variant="secondary" iconRight="chevron-right" onClick={(e) => { e.stopPropagation(); navigate(`/maquinas/${m.id}`) }}>Ver repuestos</Button>{admin && <Button variant="secondary" icon="pencil" onClick={(e) => { e.stopPropagation(); setEditing(m) }}>Editar</Button>}</>}
          />
        </Panel>
        {selected && (
          <Panel title={`${selected.identification_code} · ${selected.name}`} icon="gear-wide-connected" count={selected.location ?? undefined} flush className="bd-hide-m">
            <MachineParts machine={selected} inv={inv} admin={admin} canRequest={can(user.role, 'solicitar')} />
          </Panel>
        )}
      </div>
      {editing && <MachineFormModal machine={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(m) => setParam('sel', String(m.id))} />}
    </>
  )
}
