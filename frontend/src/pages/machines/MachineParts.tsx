import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMachineProducts } from '../../api/hooks'
import type { Inventory } from '../../api/useInventory'
import type { Machine, Product } from '../../api/types'
import { Button, CodeTag, DataTable, IconButton, Modal, SearchInput, StatusBadge, StockMeter, useToast, type Column } from '../../components/ui'
import { isLowStock } from '../../lib/domain'
import { describeError } from '../../lib/errors'
import { n } from '../../lib/format'

/** Tabla de repuestos compatibles de una máquina, con vincular y quitar para el Coordinador. */
export function MachineParts({ machine, inv, admin, canRequest }: { machine: Machine; inv: Inventory; admin: boolean; canRequest: boolean }) {
  const navigate = useNavigate()
  const toast = useToast()
  const links = useMachineProducts()
  const [linking, setLinking] = useState(false)
  const [q, setQ] = useState('')
  const parts = machine.product_ids.map((id) => inv.productById.get(id)).filter((p): p is Product => !!p).sort((a, b) => a.name.localeCompare(b.name))
  const candidates = inv.products.filter((p) => p.status === 'active' && !machine.product_ids.includes(p.id)).filter((p) => !q || `${p.internal_code} ${p.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40)

  const link = async (p: Product) => {
    try {
      await links.add.mutateAsync({ machineId: machine.id, productId: p.id })
      toast.ok(<><b>{p.name}</b> vinculado a {machine.identification_code}.</>)
      setLinking(false)
    } catch (err) {
      const d = describeError(err)
      toast.danger(<><b>{d.title}</b> {d.message}</>)
    }
  }
  const unlink = async (p: Product) => {
    try {
      await links.remove.mutateAsync({ machineId: machine.id, productId: p.id })
      toast.ok(<><b>{p.name}</b> ya no está vinculado a {machine.identification_code}.</>)
    } catch (err) {
      const d = describeError(err)
      toast.danger(<><b>{d.title}</b> {d.message}</>)
    }
  }

  const cols: Column<Product>[] = [
    { key: 'name', header: 'Repuesto', mobile: 'title', render: (p) => <><div className="bd-cell-title">{p.name}</div><div className="bd-cell-sub"><span className="bd-mono">{p.internal_code}</span>{p.part_number ? ` · ${p.part_number}` : ''}</div></> },
    { key: 'stock', header: 'Stock', width: 160, mobile: 'wide', render: (p) => <StockMeter current={n(p.current_stock)} min={n(p.minimum_stock)} max={n(p.maximum_stock)} unit={inv.unitOf(p)} /> },
    { key: 'st', header: '', mobile: 'badge', render: (p) => (isLowStock(p) ? <StatusBadge status="stock-bajo" /> : p.status !== 'active' ? <StatusBadge status="inactivo" /> : null) },
  ]
  return (
    <>
      <DataTable
        columns={cols}
        rows={parts}
        rowTone={(p) => (isLowStock(p) ? 'danger' : null)}
        caption="Repuestos compatibles"
        empty={{ icon: 'box-seam', title: 'Sin repuestos vinculados', text: admin ? 'Usa «Vincular repuesto» para asociar los productos que usa esta máquina.' : undefined }}
        actions={admin ? (p) => <IconButton icon="x-lg" label={`Quitar ${p.name} de ${machine.identification_code}`} onClick={() => void unlink(p)} /> : null}
        mobileActions={(p) => (
          <>
            {canRequest && p.status === 'active' && <Button variant="secondary" icon="box-arrow-up" onClick={() => navigate(`/movimientos/nueva?tipo=salida&producto=${p.id}&maquina=${machine.id}`)}>Pedir salida</Button>}
            {admin && <Button variant="danger-outline" icon="x-lg" onClick={() => void unlink(p)}>Quitar</Button>}
          </>
        )}
      />
      {admin && (
        <div style={{ padding: 'var(--space-3) var(--space-6)' }}>
          <Button size="sm" variant="secondary" icon="plus-lg" onClick={() => setLinking(true)}>Vincular repuesto</Button>
        </div>
      )}
      {linking && (
        <Modal title={`Vincular repuesto a ${machine.identification_code}`} icon="box-seam" onClose={() => setLinking(false)}>
          <div className="bd-picker">
            <SearchInput placeholder="Buscar por código o nombre" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <ul className="bd-picker-list" aria-label="Productos">
              {candidates.length === 0 && <li><button type="button" disabled>No hay productos activos sin vincular con ese texto.</button></li>}
              {candidates.map((p) => (
                <li key={p.id}><button type="button" onClick={() => void link(p)}><span><b>{p.name}</b><span className="bd-cell-sub"><CodeTag>{p.internal_code}</CodeTag></span></span><span className="bd-muted">Vincular</span></button></li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  )
}
