import React, { useEffect, useMemo, useState } from 'react'
import Modal, { ErrorBox, inputClass } from './Modal.jsx'
import {
  authorizeMovement,
  createMovement,
  getLoans,
  getMachines,
  getMovements,
  getProducts,
  rejectMovement,
  tokenStorage,
} from '../services/api.js'

const TYPE_LABELS = { ENTRY: 'Entrada', EXIT: 'Salida', ADJUSTMENT: 'Ajuste' }

const STATUS_STYLES = {
  pending: { label: 'Pendiente', className: 'bg-chart-4/30' },
  authorized: { label: 'Autorizado', className: 'bg-chart-2/20' },
  rejected: { label: 'Rechazado', className: 'bg-destructive/15 text-destructive' },
}

const FILTERS = [
  { key: 'all', label: 'Todos', match: () => true },
  { key: 'pending', label: 'Pendientes', match: (m) => m.status === 'pending' },
  { key: 'ENTRY', label: 'Entradas', match: (m) => m.type === 'ENTRY' },
  { key: 'EXIT', label: 'Salidas', match: (m) => m.type === 'EXIT' },
  { key: 'ADJUSTMENT', label: 'Ajustes', match: (m) => m.type === 'ADJUSTMENT' },
]

// El backend guarda fechas UTC sin zona horaria
function formatDate(value) {
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`)
  return date.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
}

// Cantidad prestada por producto (préstamos activos)
function loanedTotals(loans) {
  const totals = {}
  loans.filter((l) => l.status === 'loaned').forEach((l) => {
    totals[l.product_id] = (totals[l.product_id] || 0) + Number(l.quantity)
  })
  return totals
}

// Stock resultante si se autorizara el detalle (misma regla que el backend)
// En ADJUSTMENT, quantity es lo contado en bodega y se suma lo prestado
function resultingStock(type, current, quantity, loanedQty = 0) {
  if (type === 'ENTRY') return current + quantity
  if (type === 'EXIT') return current - quantity
  return quantity + loanedQty
}

function TypeBadge({ type }) {
  return <span className="inline-flex rounded-full bg-muted text-xs px-2 py-0.5">{TYPE_LABELS[type] || type}</span>
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { label: status, className: 'bg-muted' }
  return <span className={`inline-flex rounded-full text-xs px-2 py-0.5 ${style.className}`}>{style.label}</span>
}

export default function MovementsPage() {
  const role = tokenStorage.getUser()?.role
  // La interfaz solo oculta acciones; el backend valida el rol igualmente
  const canRequest = role === 'Operator' || role === 'Coordinator'
  const canAuthorize = role === 'Coordinator'

  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [machines, setMachines] = useState([])
  const [loaned, setLoaned] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [reviewing, setReviewing] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [movementData, productData, machineData, loanData] = await Promise.all([
        getMovements(),
        getProducts(),
        getMachines(),
        getLoans(),
      ])
      setMovements(movementData)
      setProducts(productData)
      setMachines(machineData)
      setLoaned(loanedTotals(loanData))
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const productsById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const machinesById = useMemo(() => Object.fromEntries(machines.map((m) => [m.id, m])), [machines])
  const pendingCount = movements.filter((m) => m.status === 'pending').length
  const activeFilter = FILTERS.find((f) => f.key === filter)
  const visible = movements.filter(activeFilter.match)

  const productLabel = (id) => {
    const product = productsById[id]
    return product ? `${product.internal_code} · ${product.name}` : `Producto #${id}`
  }

  const handleCreated = (movement) => {
    setCreating(false)
    setMovements((list) => [movement, ...list])
    setNotice(`Solicitud #${movement.id} registrada como pendiente de autorización.`)
  }

  const handleReviewed = async (movement) => {
    setReviewing(null)
    setNotice(
      movement.status === 'authorized'
        ? `Movimiento #${movement.id} autorizado; el inventario fue actualizado.`
        : `Movimiento #${movement.id} rechazado; el inventario no cambió.`,
    )
    // Recargar para reflejar el stock actualizado
    await loadData()
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-medium">Movimientos de inventario</h2>
        {canRequest && (
          <button
            onClick={() => setCreating(true)}
            disabled={loading || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm px-4 py-2 hover:opacity-90 transition disabled:opacity-60"
          >
            <i className="bi bi-plus-lg"></i>Nuevo movimiento
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-chart-2/10 border border-chart-2/30 p-3 text-sm mb-4">
          <span><i className="bi bi-check-circle-fill mr-2"></i>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground" aria-label="Cerrar aviso">
            <i className="bi bi-x"></i>
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? 'rounded-lg bg-primary text-primary-foreground text-sm px-3 py-1.5'
                : 'rounded-lg border border-border text-sm px-3 py-1.5 hover:bg-accent'
            }
          >
            {f.label}
            {f.key === 'pending' && pendingCount > 0 && (
              <span className="ml-1 text-xs bg-chart-4/30 rounded-full px-1.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Tipo</th>
                <th className="text-left font-medium px-4 py-2">Producto</th>
                <th className="text-right font-medium px-4 py-2">Cantidad</th>
                <th className="text-left font-medium px-4 py-2">Fecha</th>
                <th className="text-left font-medium px-4 py-2">Solicitante</th>
                <th className="text-left font-medium px-4 py-2">Estado</th>
                <th className="text-right font-medium px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">
                    <i className="bi bi-arrow-repeat animate-spin mr-2"></i>Cargando movimientos...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-destructive">
                    <div className="flex flex-col items-center gap-2">
                      <span>{error}</span>
                      <button onClick={loadData} className="text-xs underline text-primary hover:opacity-80">
                        Reintentar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !error && visible.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-muted-foreground">
                    No hay movimientos para este filtro.
                  </td>
                </tr>
              )}
              {!loading && !error && visible.map((movement) => {
                const isPending = movement.status === 'pending'
                const [first, ...rest] = movement.details
                return (
                  <tr key={movement.id} className={isPending ? 'bg-chart-4/10 hover:bg-chart-4/20' : 'hover:bg-accent/30'}>
                    <td className="px-4 py-3"><TypeBadge type={movement.type} /></td>
                    <td className="px-4 py-3">
                      {first && productLabel(first.product_id)}
                      {rest.length > 0 && <span className="text-xs text-muted-foreground"> +{rest.length} más</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{first?.quantity}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(movement.date)}</td>
                    <td className="px-4 py-3">{movement.requesting_user_name || `Usuario #${movement.requesting_user_id}`}</td>
                    <td className="px-4 py-3"><StatusBadge status={movement.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {isPending && canAuthorize ? (
                        <button
                          onClick={() => setReviewing(movement)}
                          className="inline-flex items-center gap-1 rounded-lg bg-chart-2/20 text-foreground text-xs px-2.5 py-1 hover:bg-chart-2/30"
                        >
                          <i className="bi bi-check-lg"></i>Revisar
                        </button>
                      ) : (
                        <button onClick={() => setReviewing(movement)} className="text-muted-foreground" title="Ver detalle">
                          <i className="bi bi-eye"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && !error && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Mostrando {visible.length} de {movements.length} movimientos
          </div>
        )}
      </div>

      {creating && (
        <NewMovementModal
          products={products.filter((p) => p.status === 'active')}
          machines={machines}
          loaned={loaned}
          role={role}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}

      {reviewing && (
        <ReviewMovementModal
          movement={reviewing}
          productsById={productsById}
          machinesById={machinesById}
          loaned={loaned}
          productLabel={productLabel}
          canAuthorize={canAuthorize}
          onClose={() => setReviewing(null)}
          onReviewed={handleReviewed}
        />
      )}
    </>
  )
}

function NewMovementModal({ products, machines, loaned, role, onClose, onCreated }) {
  const [form, setForm] = useState({
    type: 'ENTRY',
    product_id: '',
    machine_id: '',
    quantity: '',
    reason: '',
    work_order_number: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const reasonRequired = form.type === 'EXIT' || form.type === 'ADJUSTMENT'
  const selected = products.find((p) => String(p.id) === form.product_id)
  // Máquinas con este repuesto asociado primero
  const sortedMachines = [...machines].sort((a, b) => {
    const id = Number(form.product_id)
    return Number(b.product_ids.includes(id)) - Number(a.product_ids.includes(id))
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const quantity = Number(form.quantity)

    if (!form.product_id) return setError('Seleccione un producto.')
    if (form.quantity === '' || Number.isNaN(quantity) || quantity < 0) {
      return setError('Ingrese una cantidad válida.')
    }
    if (form.type !== 'ADJUSTMENT' && quantity <= 0) {
      return setError('La cantidad debe ser mayor que cero para entradas y salidas.')
    }
    if (reasonRequired && !form.reason.trim()) {
      return setError('El motivo es obligatorio para salidas y ajustes.')
    }

    setSaving(true)
    setError(null)
    try {
      const movement = await createMovement({
        type: form.type,
        reason: form.reason.trim() || null,
        work_order_number: form.work_order_number.trim() || null,
        details: [{
          product_id: Number(form.product_id),
          quantity: form.quantity,
          machine_id: form.type === 'EXIT' && form.machine_id ? Number(form.machine_id) : null,
        }],
      })
      onCreated(movement)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title="Nuevo movimiento"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Registrando...' : 'Registrar movimiento'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Tipo</label>
            <select value={form.type} onChange={set('type')} className={inputClass}>
              <option value="ENTRY">Entrada</option>
              <option value="EXIT">Salida</option>
              <option value="ADJUSTMENT">Ajuste</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium block mb-1.5">Producto</label>
            <select value={form.product_id} onChange={set('product_id')} className={inputClass}>
              <option value="">Seleccione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.internal_code} · {p.name} (Stock: {p.current_stock}{loaned[p.id] ? `, prestado: ${loaned[p.id]}` : ''})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">
              {form.type === 'ADJUSTMENT' ? 'Contado en bodega' : 'Cantidad'}
            </label>
            <input type="number" min="0" step="0.01" value={form.quantity} onChange={set('quantity')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Orden de trabajo</label>
            <input type="text" maxLength={30} placeholder="Opcional" value={form.work_order_number} onChange={set('work_order_number')} className={inputClass} />
          </div>
        </div>
        {form.type === 'EXIT' && (
          <div>
            <label className="text-sm font-medium block mb-1.5">Máquina destino (opcional)</label>
            <select value={form.machine_id} onChange={set('machine_id')} className={inputClass}>
              <option value="">No aplica</option>
              {sortedMachines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.identification_code} · {m.name}
                  {m.product_ids.includes(Number(form.product_id)) ? ' (compatible)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {form.type === 'ADJUSTMENT' && (
          <p className="text-xs text-muted-foreground">
            Registre solo lo contado físicamente en bodega, sin las herramientas prestadas; el sistema las suma.
            {selected && form.quantity !== '' && (
              <>
                {' '}Contado: {Number(form.quantity)} · Prestado: {loaned[selected.id] || 0} ·{' '}
                <strong>Stock resultante: {(Number(form.quantity) + (loaned[selected.id] || 0)).toFixed(2)}</strong>
              </>
            )}
          </p>
        )}
        {form.type === 'EXIT' && selected &&
          Number(form.quantity) > Number(selected.current_stock) - (loaned[selected.id] || 0) && (
          <ErrorBox message={`La cantidad supera lo disponible (${Number(selected.current_stock) - (loaned[selected.id] || 0)}; stock ${selected.current_stock}${loaned[selected.id] ? `, prestado ${loaned[selected.id]}` : ''}). La solicitud no podrá autorizarse.`} />
        )}
        <div>
          <label className="text-sm font-medium block mb-1.5">
            Motivo {reasonRequired ? '*' : '(opcional)'}
          </label>
          <textarea rows="2" maxLength={150} value={form.reason} onChange={set('reason')} className={inputClass}></textarea>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-chart-4/10 border border-chart-4/30 p-3 text-sm">
          <i className="bi bi-info-circle-fill mt-0.5"></i>
          <span>
            La solicitud quedará <strong>pendiente</strong> y el stock no cambiará hasta que un Coordinador la autorice
            {role === 'Coordinator' ? ' (puede autorizarla usted mismo desde la lista).' : '.'}
          </span>
        </div>
        <ErrorBox message={error} />
      </Modal>
    </form>
  )
}

function ReviewMovementModal({ movement, productsById, machinesById, loaned, productLabel, canAuthorize, onClose, onReviewed }) {
  const [working, setWorking] = useState(null)
  const [error, setError] = useState(null)
  const isPending = movement.status === 'pending'
  const canAct = isPending && canAuthorize

  const insufficient = movement.type === 'EXIT' && movement.details.some((d) => {
    const product = productsById[d.product_id]
    // Lo prestado no puede salir (misma regla que el backend)
    return product && Number(d.quantity) > Number(product.current_stock) - (loaned[d.product_id] || 0)
  })

  const run = async (action) => {
    setWorking(action)
    setError(null)
    try {
      const result = action === 'authorize' ? await authorizeMovement(movement.id) : await rejectMovement(movement.id)
      onReviewed(result)
    } catch (err) {
      setError(err.message)
      setWorking(null)
    }
  }

  return (
    <Modal
      title={canAct ? `Revisar movimiento #${movement.id}` : `Movimiento #${movement.id}`}
      onClose={onClose}
      size="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            {canAct ? 'Cancelar' : 'Cerrar'}
          </button>
          {canAct && (
            <>
              <button
                onClick={() => run('reject')}
                disabled={Boolean(working)}
                className="rounded-lg border border-destructive text-destructive px-4 py-2 text-sm hover:bg-destructive/10 disabled:opacity-60"
              >
                {working === 'reject' ? 'Rechazando...' : 'Rechazar'}
              </button>
              <button
                onClick={() => run('authorize')}
                disabled={Boolean(working) || insufficient}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60"
              >
                {working === 'authorize' ? 'Autorizando...' : 'Autorizar'}
              </button>
            </>
          )}
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Tipo</dt><dd><TypeBadge type={movement.type} /></dd>
        <dt className="text-muted-foreground">Estado</dt><dd><StatusBadge status={movement.status} /></dd>
        <dt className="text-muted-foreground">Fecha</dt><dd>{formatDate(movement.date)}</dd>
        <dt className="text-muted-foreground">Solicitante</dt><dd>{movement.requesting_user_name || `Usuario #${movement.requesting_user_id}`}</dd>
        {movement.authorizing_user_id && (
          <>
            <dt className="text-muted-foreground">{movement.status === 'rejected' ? 'Rechazado por' : 'Autorizado por'}</dt>
            <dd>{movement.authorizing_user_name || `Usuario #${movement.authorizing_user_id}`}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Motivo</dt><dd>{movement.reason || '—'}</dd>
        <dt className="text-muted-foreground">Orden de trabajo</dt><dd>{movement.work_order_number || '—'}</dd>
      </dl>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Producto</th>
              <th className="text-right font-medium px-3 py-2">Cantidad</th>
              {isPending && <th className="text-right font-medium px-3 py-2">Stock actual</th>}
              {isPending && <th className="text-right font-medium px-3 py-2">Resultante</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {movement.details.map((detail) => {
              const product = productsById[detail.product_id]
              const current = product ? Number(product.current_stock) : null
              const after = current == null ? null : resultingStock(movement.type, current, Number(detail.quantity), loaned[detail.product_id] || 0)
              return (
                <tr key={detail.id}>
                  <td className="px-3 py-2">
                    {productLabel(detail.product_id)}
                    {detail.machine_id && (
                      <div className="text-xs text-muted-foreground">
                        <i className="bi bi-gear-wide-connected mr-1"></i>
                        {machinesById[detail.machine_id]?.name || `Máquina #${detail.machine_id}`}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{detail.quantity}</td>
                  {isPending && (
                    <td className="px-3 py-2 text-right">
                      {product?.current_stock ?? '—'}
                      {loaned[detail.product_id] > 0 && (
                        <div className="text-xs text-muted-foreground">prestado: {loaned[detail.product_id]}</div>
                      )}
                    </td>
                  )}
                  {isPending && (
                    <td className={`px-3 py-2 text-right font-medium ${after != null && after < 0 ? 'text-destructive' : ''}`}>
                      {after == null ? '—' : after.toFixed(2)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canAct && insufficient && (
        <ErrorBox message="La cantidad solicitada excede lo disponible (stock menos herramientas prestadas). Esta salida no puede autorizarse; puede rechazarla o esperar una entrada o una devolución." />
      )}
      <ErrorBox message={error} />
    </Modal>
  )
}
