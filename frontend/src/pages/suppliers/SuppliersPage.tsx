import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSuppliers } from '../../api/hooks'
import { useInventory } from '../../api/useInventory'
import type { Supplier } from '../../api/types'
import { useSessionUser } from '../../app/AuthProvider'
import { Button, DataTable, FilterBar, IconButton, PageHeader, Panel, RoleGate, SearchInput, type Column } from '../../components/ui'
import { can } from '../../lib/permissions'
import { SupplierDetail } from './SupplierDetail'
import { SupplierFormModal } from './SupplierFormModal'

export function SuppliersPage() {
  const user = useSessionUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const inv = useInventory({ lots: false, machines: false, loans: false })
  const suppliers = useSuppliers()
  const admin = can(user.role, 'administrar')
  const q = params.get('q') ?? ''
  const sel = Number(params.get('sel'))
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (suppliers.data ?? [])
      .filter((s) => !needle || `${s.company_name} ${s.ruc ?? ''} ${s.contact_person ?? ''} ${s.product_links.map((l) => inv.productById.get(l.product_id)?.name ?? '').join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) => a.company_name.localeCompare(b.company_name))
  }, [suppliers.data, inv.productById, q])
  const selected = (suppliers.data ?? []).find((s) => s.id === sel) ?? rows[0]

  const cols: Column<Supplier>[] = [
    { key: 'name', header: 'Empresa', mobile: 'title', render: (s) => <><div className="bd-cell-title">{s.company_name}</div><div className="bd-cell-sub bd-mono">{s.ruc ?? ''}</div></> },
    { key: 'contact', header: 'Contacto', mobile: 'wide', render: (s) => <><div>{s.contact_person ?? '—'}</div><div className="bd-cell-sub bd-num">{s.phone ?? ''}</div></> },
    { key: 'products', header: 'Productos', align: 'right', mobile: 'meta', render: (s) => <b className="bd-num">{s.product_links.length}</b> },
  ]

  return (
    <>
      <PageHeader
        title="Proveedores"
        subtitle={suppliers.isLoading ? 'Cargando…' : `${suppliers.data?.length ?? 0} ${suppliers.data?.length === 1 ? 'proveedor' : 'proveedores'}`}
        actions={<RoleGate role={user.role} action="administrar"><Button variant="primary" icon="plus-lg" onClick={() => setEditing('new')}>Nuevo proveedor</Button></RoleGate>}
      />
      <div className="bd-split pv-split">
        <Panel flush>
          <FilterBar><SearchInput placeholder="Buscar por empresa, RUC o producto" value={q} onChange={(e) => setParam('q', e.target.value)} /></FilterBar>
          <DataTable
            columns={cols}
            rows={rows}
            rowTone={(s) => (s.id === selected?.id ? 'selected' : null)}
            caption="Proveedores"
            state={suppliers.isLoading ? 'loading' : suppliers.isError ? 'error' : 'ready'}
            onRetry={() => void suppliers.refetch()}
            loadingLabel="Cargando proveedores…"
            empty={{ icon: 'truck', title: q ? `Sin resultados para “${q}”` : 'No hay proveedores registrados', text: admin && !q ? 'Crea el primero con «Nuevo proveedor».' : undefined }}
            onRowClick={(s) => setParam('sel', String(s.id))}
            actions={admin ? (s) => <IconButton icon="pencil" label={`Editar ${s.company_name}`} onClick={(e) => { e.stopPropagation(); setEditing(s) }} /> : null}
            mobileActions={(s) => <><Button variant="secondary" iconRight="chevron-right" onClick={(e) => { e.stopPropagation(); navigate(`/proveedores/${s.id}`) }}>Ver</Button>{admin && <Button variant="secondary" icon="pencil" onClick={(e) => { e.stopPropagation(); setEditing(s) }}>Editar</Button>}</>}
          />
        </Panel>
        {selected && <div className="bd-hide-m"><SupplierDetail supplier={selected} inv={inv} admin={admin} onEdit={() => setEditing(selected)} /></div>}
      </div>
      {editing && <SupplierFormModal supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(s) => setParam('sel', String(s.id))} />}
    </>
  )
}
