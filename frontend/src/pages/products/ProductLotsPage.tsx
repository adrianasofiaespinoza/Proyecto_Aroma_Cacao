import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useCreateLot, useUpdateLot } from '../../api/hooks'
import { useInventory } from '../../api/useInventory'
import type { Lot } from '../../api/types'
import { useSessionUser } from '../../app/AuthProvider'
import { Button, CodeTag, ConnectionError, DataTable, Field, IconButton, LoadingRows, Modal, Notice, PageHeader, Panel, RoleGate, StatusBadge, TextInput, useToast, type Column } from '../../components/ui'
import { lotDaysLabel, lotState } from '../../lib/domain'
import { describeError } from '../../lib/errors'
import { fmtDate, fmtQty, n, todayISO } from '../../lib/format'
import { can } from '../../lib/permissions'

const DAYS_COLOR = { vencido: 'var(--danger-ink)', 'por-vencer': 'var(--pending-ink)', vigente: undefined, 'sin-lote': undefined } as const

export function ProductLotsPage() {
  const { id } = useParams()
  const productId = Number(id)
  const user = useSessionUser()
  const navigate = useNavigate()
  const toast = useToast()
  const inv = useInventory({ machines: false, loans: false })
  const createLot = useCreateLot()
  const updateLot = useUpdateLot()
  const [editing, setEditing] = useState<Lot | 'new' | null>(null)
  const [lotNumber, setLotNumber] = useState('')
  const [expiration, setExpiration] = useState('')
  const [error, setError] = useState<string | null>(null)
  const admin = can(user.role, 'administrar')

  const product = inv.productById.get(productId)
  if (inv.isLoading) return <Panel flush><LoadingRows rows={3} label="Cargando lotes…" /></Panel>
  if (!product) {
    if (inv.offline) return <Panel flush><ConnectionError onRetry={inv.refetch} /></Panel>
    return <Notice tone="danger" title="No se encontró el producto"><Button size="sm" variant="secondary" onClick={() => navigate('/productos')}>Volver a productos</Button></Notice>
  }
  const unit = inv.unitOf(product)
  const lots = [...(inv.lotsByProduct.get(product.id) ?? [])].sort((a, b) => (a.expiration_date ?? '9999').localeCompare(b.expiration_date ?? '9999'))
  const expired = lots.filter((l) => lotState(l) === 'vencido' && n(l.remaining_quantity) > 0)
  const total = lots.reduce((s, l) => s + n(l.remaining_quantity), 0)

  const open = (lot: Lot | 'new') => {
    setEditing(lot)
    setLotNumber(lot === 'new' ? '' : lot.lot_number)
    setExpiration(lot === 'new' ? '' : (lot.expiration_date ?? ''))
    setError(null)
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!lotNumber.trim()) return setError('Escribe el número de lote.')
    if (editing === 'new' && expiration && expiration < todayISO()) return setError('La fecha de vencimiento ya pasó. Un lote nuevo no puede entrar vencido.')
    const input = { lot_number: lotNumber.trim(), expiration_date: expiration || null }
    try {
      if (editing === 'new') {
        await createLot.mutateAsync({ productId: product.id, input })
        toast.ok(<><b>Lote {input.lot_number} registrado.</b> Pide una entrada con ese lote para darle stock.</>)
      } else if (editing) {
        await updateLot.mutateAsync({ lotId: editing.id, input })
        toast.ok(<b>Lote {input.lot_number} actualizado.</b>)
      }
      setEditing(null)
    } catch (err) {
      const d = describeError(err)
      setError(`${d.title}. ${d.message}`)
    }
  }

  const cols: Column<Lot>[] = [
    { key: 'lot', header: 'Lote', mobile: 'title', render: (l) => <CodeTag>{l.lot_number}</CodeTag> },
    { key: 'exp', header: 'Vencimiento', render: (l) => <span className="bd-num">{l.expiration_date ? fmtDate(l.expiration_date) : 'Sin vencimiento'}</span> },
    { key: 'days', header: 'Días', render: (l) => <b className="bd-num" style={{ color: DAYS_COLOR[lotState(l)] }}>{lotDaysLabel(l)}</b> },
    { key: 'left', header: 'Cantidad restante', align: 'right', mobileLabel: 'Restante', render: (l) => <b className="bd-num">{fmtQty(l.remaining_quantity, unit)}</b> },
    { key: 'state', header: 'Estado', mobile: 'badge', render: (l) => <StatusBadge status={lotState(l)} /> },
  ]

  return (
    <>
      <PageHeader
        back="Productos"
        backTo="/productos"
        title={product.name}
        subtitle={[product.internal_code, [product.brand, product.model].filter(Boolean).join(' '), product.physical_location, `${fmtQty(total, unit)} en ${lots.length} ${lots.length === 1 ? 'lote' : 'lotes'}`].filter(Boolean).join(' · ')}
        actions={
          <>
            <RoleGate role={user.role} action="administrar"><Button variant="secondary" icon="plus-lg" onClick={() => open('new')}>Nuevo lote</Button></RoleGate>
            {product.status === 'active' && <RoleGate role={user.role} action="solicitar"><Button variant="primary" icon="box-arrow-in-down" onClick={() => navigate(`/movimientos/nueva?tipo=entrada&producto=${product.id}`)}>Pedir entrada con lote</Button></RoleGate>}
          </>
        }
      />
      {!product.requires_lot && <Notice tone="info">Este producto ya no lleva trazabilidad por lote. Los lotes se conservan solo como historial.</Notice>}
      {expired.map((l) => (
        <Notice key={l.id} tone="danger" title={`Lote ${l.lot_number} vencido el ${fmtDate(l.expiration_date)}`}>
          Quedan {fmtQty(l.remaining_quantity, unit)}. No lo uses en líneas de producto; pide un ajuste para darlo de baja.
        </Notice>
      ))}
      <Panel title="Lotes" icon="layers" count="Primero en vencer, primero en salir" flush>
        <DataTable
          columns={cols}
          rows={lots}
          rowTone={(l) => (lotState(l) === 'vencido' ? 'danger' : n(l.remaining_quantity) === 0 ? 'muted' : null)}
          caption="Lotes del producto"
          empty={{ icon: 'layers', title: 'Este producto no tiene lotes', text: admin ? 'Registra el primero con «Nuevo lote» y luego pide una entrada.' : 'Pídele al coordinador que registre el lote.' }}
          actions={admin ? (l) => <IconButton icon="pencil" label={`Editar lote ${l.lot_number}`} onClick={() => open(l)} /> : null}
          mobileActions={admin ? (l) => <Button variant="secondary" icon="pencil" onClick={() => open(l)}>Editar</Button> : null}
        />
      </Panel>
      <div className="lt-legend"><span><StatusBadge status="vencido" /> fecha pasada</span><span><StatusBadge status="por-vencer" /> vence en 30 días o menos</span><span><StatusBadge status="vigente" /> más de 30 días</span></div>
      {editing && (
        <Modal
          title={editing === 'new' ? 'Nuevo lote' : `Editar lote ${editing.lot_number}`}
          icon="layers"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" size="lg" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" size="lg" icon="check-lg" form="lot-form" type="submit" loading={createLot.isPending || updateLot.isPending}>{editing === 'new' ? 'Registrar lote' : 'Guardar'}</Button>
            </>
          }
        >
          <form id="lot-form" onSubmit={save} noValidate className="bd-stack">
            {error && <Notice tone="danger">{error}</Notice>}
            <Field label="Número de lote" htmlFor="lot-number" required hint="Como viene en la etiqueta del proveedor."><TextInput id="lot-number" className="bd-mono" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} maxLength={30} autoFocus /></Field>
            <Field label="Fecha de vencimiento" htmlFor="lot-exp" optional hint="Déjala vacía si el producto no vence."><TextInput id="lot-exp" type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} /></Field>
            {editing !== 'new' && <Field label="Cantidad restante" hint="Cambia solo con entradas, salidas y ajustes de ese lote."><TextInput readOnlyValue={fmtQty(editing.remaining_quantity, unit)} /></Field>}
          </form>
        </Modal>
      )}
    </>
  )
}
