import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useCreateMovement } from '../../api/hooks'
import { useInventory } from '../../api/useInventory'
import type { Product } from '../../api/types'
import { useSessionUser } from '../../app/AuthProvider'
import {
  Button, CodeTag, Field, Icon, MovementFlow, Notice, PageHeader, Panel, QuantityStepper, SearchInput, Segmented, Select, StockImpact, Textarea, TextInput, useToast,
} from '../../components/ui'
import { TYPE_TO_BACKEND, isLowStock, lotDaysLabel, lotState, projectedStock, reasonRequired, type UiMovementType } from '../../lib/domain'
import { describeError, isApiError } from '../../lib/errors'
import { fmtDate, fmtQty, n } from '../../lib/format'
import { can } from '../../lib/permissions'

const TYPE_OPTIONS = [
  { value: 'entrada', label: 'Entrada', icon: 'box-arrow-in-down' },
  { value: 'salida', label: 'Salida', icon: 'box-arrow-up' },
  { value: 'ajuste', label: 'Ajuste', icon: 'sliders' },
]

function ProductPicker({ products, onPick, unitOf, availableOf }: { products: Product[]; onPick: (p: Product) => void; unitOf: (p: Product) => string; availableOf: (p: Product) => number }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const active = products.filter((p) => p.status === 'active')
    const found = needle ? active.filter((p) => `${p.internal_code} ${p.name} ${p.brand ?? ''} ${p.physical_location ?? ''}`.toLowerCase().includes(needle)) : active
    return found.slice(0, 40)
  }, [products, q])
  return (
    <div className="bd-picker">
      <SearchInput placeholder="Buscar por código o nombre" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <ul className="bd-picker-list" aria-label="Productos">
        {list.length === 0 && <li><button type="button" disabled>No hay productos activos con ese texto.</button></li>}
        {list.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p)}>
              <span><b>{p.name}</b><span className="bd-cell-sub"><CodeTag>{p.internal_code}</CodeTag>{p.physical_location ? ` · ${p.physical_location}` : ''}</span></span>
              <span className="bd-num">{fmtQty(availableOf(p), unitOf(p))}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function NewMovementPage() {
  const user = useSessionUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const inv = useInventory()
  const create = useCreateMovement()

  const [type, setType] = useState<UiMovementType>(() => (['entrada', 'salida', 'ajuste'].includes(params.get('tipo') ?? '') ? (params.get('tipo') as UiMovementType) : 'salida'))
  const [productId, setProductId] = useState<number | null>(() => (params.get('producto') ? Number(params.get('producto')) : null))
  const [qty, setQty] = useState(1)
  const [lotId, setLotId] = useState('')
  const [machineId, setMachineId] = useState(() => params.get('maquina') ?? '')
  const [ot, setOt] = useState('')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<ReturnType<typeof describeError> | null>(null)

  const product = productId != null ? inv.productById.get(productId) : undefined
  const unit = inv.unitOf(product)
  const lots = product ? (inv.lotsByProduct.get(product.id) ?? []).filter((l) => lotState(l) !== 'vencido' || type === 'ajuste') : []
  const lot = lotId ? inv.lotById.get(Number(lotId)) : undefined
  const stock = product ? n(product.current_stock) : 0
  const avail = product ? inv.availableOf(product) : 0
  const before = type === 'salida' ? avail : stock
  const after = product ? projectedStock(type, before, qty, lot ? n(lot.remaining_quantity) : undefined) : before
  const exceeds = type === 'salida' && !!product && qty > avail
  const lotExceeds = type === 'salida' && !!lot && qty > n(lot.remaining_quantity)
  const needsLot = !!product?.requires_lot
  const reasonMissing = reasonRequired(type) && reason.trim() === ''

  // Al cambiar de producto se limpian lote y cantidad.
  useEffect(() => {
    setLotId('')
    setQty(type === 'ajuste' ? 0 : 1)
  }, [productId, type])

  if (!can(user.role, 'solicitar')) return <Navigate to="/movimientos" replace />

  const errors = {
    product: tried && !product ? 'Elige el producto.' : undefined,
    qty: exceeds ? `Máximo disponible: ${fmtQty(avail, unit)}` : lotExceeds ? `El lote solo tiene ${fmtQty(lot?.remaining_quantity, unit)}.` : tried && type !== 'ajuste' && qty <= 0 ? 'La cantidad debe ser mayor que cero.' : undefined,
    lot: tried && needsLot && !lotId ? 'Este producto lleva lote: elige uno.' : undefined,
    reason: tried && reasonMissing ? 'Escribe el motivo: es obligatorio en salidas y ajustes.' : undefined,
  }
  const invalid = !product || exceeds || lotExceeds || (needsLot && !lotId) || reasonMissing || (type !== 'ajuste' && qty <= 0)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    setServerError(null)
    if (invalid || !product) return
    try {
      const created = await create.mutateAsync({
        type: TYPE_TO_BACKEND[type],
        reason: reason.trim() || null,
        work_order_number: ot.trim() || null,
        details: [{ product_id: product.id, quantity: qty, lot_id: lotId ? Number(lotId) : null, machine_id: machineId ? Number(machineId) : null }],
      })
      toast.ok(<><b>Solicitud enviada.</b> Queda pendiente: el stock no cambia hasta que el coordinador la autorice.</>)
      navigate(`/movimientos/${created.id}`, { replace: true })
    } catch (err) {
      setServerError({ ...describeError(err), code: isApiError(err) ? err.codeLabel : undefined })
    }
  }

  const qtyLabel = type === 'ajuste' ? 'Cantidad contada en bodega' : 'Cantidad'
  const qtyHint = !product ? undefined : type === 'ajuste'
    ? `En el sistema: ${fmtQty(lot ? lot.remaining_quantity : stock, unit)} · diferencia ${(() => { const d = qty - (lot ? n(lot.remaining_quantity) : stock); return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmtQty(Math.abs(d), unit)}` })()}`
    : type === 'salida' ? `Disponible: ${fmtQty(avail, unit)}${inv.loanedByProduct.get(product.id) ? ` (${fmtQty(stock, unit)} en stock, ${fmtQty(inv.loanedByProduct.get(product.id), unit)} prestadas)` : ''}` : `Stock actual: ${fmtQty(stock, unit)}`

  return (
    <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
      <PageHeader back="Movimientos" backTo="/movimientos" title="Nueva solicitud" subtitle="Se enviará al coordinador para su revisión" />
      {serverError && <Notice tone="danger" title={serverError.title} code={serverError.code}>{serverError.message}</Notice>}
      <div className="bd-split">
        <Panel title="Detalle" icon="file-earmark-text">
          <div className="bd-stack">
            <div className="ns-type"><Segmented label="Tipo de movimiento" value={type} onChange={(v) => setType(v as UiMovementType)} options={TYPE_OPTIONS} /></div>
            <Field label="Producto" required error={errors.product}>
              {product ? (
                <div className="ns-picked">
                  <Icon name="box-seam" />
                  <div>
                    <b>{product.name}</b>
                    <div className="bd-cell-sub">
                      <CodeTag>{product.internal_code}</CodeTag>{product.physical_location ? ` · ${product.physical_location}` : ''} · {type === 'salida' ? 'disponible' : 'stock'} {fmtQty(type === 'salida' ? avail : stock, unit)}
                      {isLowStock(product) && <> · <span style={{ color: 'var(--danger-ink)', fontWeight: 600 }}>bajo mínimo</span></>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setProductId(null)}>Cambiar</Button>
                </div>
              ) : inv.isLoading ? (
                <TextInput readOnlyValue="Cargando productos…" />
              ) : (
                <ProductPicker products={inv.products} onPick={(p) => setProductId(p.id)} unitOf={(p) => inv.unitOf(p)} availableOf={inv.availableOf} />
              )}
            </Field>
            {product && needsLot && (
              <Field label="Lote" htmlFor="lot" required error={errors.lot} hint={lots.length === 0 ? 'Este producto no tiene lotes registrados: pide una entrada con lote nuevo desde Productos › Lotes.' : undefined}>
                <Select
                  id="lot"
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                  placeholder="Elige el lote"
                  options={lots.map((l) => ({ value: String(l.id), label: `${l.lot_number} · ${l.expiration_date ? `vence ${fmtDate(l.expiration_date)} (${lotDaysLabel(l)})` : 'sin vencimiento'} · ${fmtQty(l.remaining_quantity, unit)}` }))}
                />
              </Field>
            )}
            <div className="bd-form-grid">
              <Field label={qtyLabel} htmlFor="qty" required hint={qtyHint} error={errors.qty}>
                <QuantityStepper id="qty" value={qty} min={0} unit={unit} step={unit === 'u.' ? 1 : 0.5} onChange={setQty} label={qtyLabel} />
              </Field>
              {type === 'salida' && (
                <Field label="Máquina destino" htmlFor="machine" optional>
                  <Select id="machine" value={machineId} onChange={(e) => setMachineId(e.target.value)} placeholder="Sin máquina" options={inv.machines.map((m) => ({ value: String(m.id), label: `${m.identification_code} · ${m.name}` }))} />
                </Field>
              )}
              <Field label="Orden de trabajo" htmlFor="ot" optional>
                <TextInput id="ot" className="bd-mono" value={ot} onChange={(e) => setOt(e.target.value)} maxLength={30} placeholder="OT-0000" />
              </Field>
            </div>
            <Field label="Motivo" htmlFor="reason" required={reasonRequired(type)} optional={!reasonRequired(type)} error={errors.reason}>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={150} placeholder={type === 'ajuste' ? 'Ej.: conteo cíclico del estante C-02' : type === 'salida' ? 'Ej.: cambio preventivo del rodamiento lado motor' : 'Ej.: compra OC-1187'} />
            </Field>
            <div className="ns-foot">
              <Button variant="secondary" size="lg" onClick={() => navigate('/movimientos')}>Cancelar</Button>
              <Button variant="primary" size="lg" icon="send" type="submit" loading={create.isPending}>Enviar solicitud</Button>
            </div>
          </div>
        </Panel>
        <Panel title="Qué pasa al enviar" icon="info-circle-fill">
          <div className="bd-stack">
            <Notice tone="pending" title="Queda Pendiente">
              El stock no cambia hasta que el coordinador la autorice.
              {type === 'salida' && product ? ` Mientras tanto, ${fmtQty(qty, unit)} siguen contando como disponibles.` : ''}
            </Notice>
            {product && (
              <StockImpact before={before} after={after} unit={unit} status="pendiente" blocked={exceeds} label={type === 'salida' ? 'Disponible' : type === 'ajuste' ? (lot ? 'En el lote' : 'En sistema') : 'Stock actual'} />
            )}
            <MovementFlow status="pendiente" requested={{ by: 'Tú', at: 'al enviar' }} />
          </div>
        </Panel>
      </div>
    </form>
  )
}
