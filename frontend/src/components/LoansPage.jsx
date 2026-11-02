import React, { useEffect, useMemo, useState } from 'react'
import Modal, { ErrorBox, Notice, TableStatusRow, inputClass } from './Modal.jsx'
import { createLoan, getLoans, getProducts, getWorkers, returnLoan, tokenStorage } from '../services/api.js'

const FILTERS = [
  { key: 'all', label: 'Todos', match: () => true },
  { key: 'loaned', label: 'Prestados', match: (l) => l.status === 'loaned' },
  { key: 'returned', label: 'Devueltos', match: (l) => l.status === 'returned' },
]

// El backend guarda fechas UTC sin zona horaria
function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`)
  return date.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
}

export default function LoansPage() {
  const role = tokenStorage.getUser()?.role
  // La interfaz solo oculta acciones; el backend valida el rol igualmente
  const canManage = role === 'Operator' || role === 'Coordinator'

  const [loans, setLoans] = useState([])
  const [products, setProducts] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [filter, setFilter] = useState('loaned')
  const [creating, setCreating] = useState(false)
  const [returning, setReturning] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [loanData, productData, workerData] = await Promise.all([getLoans(), getProducts(), getWorkers()])
      setLoans(loanData)
      setProducts(productData)
      setWorkers(workerData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const productsById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])

  // Disponible = stock - préstamos activos (misma regla que el backend)
  const loanedByProduct = useMemo(() => {
    const totals = {}
    loans.filter((l) => l.status === 'loaned').forEach((l) => {
      totals[l.product_id] = (totals[l.product_id] || 0) + Number(l.quantity)
    })
    return totals
  }, [loans])

  const activeCount = loans.filter((l) => l.status === 'loaned').length
  const visible = loans.filter(FILTERS.find((f) => f.key === filter).match)

  const productLabel = (id) => {
    const p = productsById[id]
    return p ? `${p.internal_code} · ${p.name}` : `Producto #${id}`
  }

  const handleCreated = async (loan) => {
    setCreating(false)
    setNotice(`Préstamo #${loan.id} registrado para ${loan.worker_name}.`)
    await loadData()
  }

  const handleReturn = async (loan) => {
    setReturning(loan.id)
    setActionError(null)
    try {
      const saved = await returnLoan(loan.id)
      setLoans((list) => list.map((l) => (l.id === saved.id ? saved : l)))
      setNotice(`Devolución del préstamo #${saved.id} registrada.`)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setReturning(null)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-medium">Préstamos de herramientas</h2>
        {canManage && (
          <button
            onClick={() => setCreating(true)}
            disabled={loading || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm px-4 py-2 hover:opacity-90 transition disabled:opacity-60"
          >
            <i className="bi bi-plus-lg"></i>Nuevo préstamo
          </button>
        )}
      </div>

      <Notice message={notice} onClose={() => setNotice(null)} />
      {actionError && <div className="mb-4"><ErrorBox message={actionError} /></div>}

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
            {f.key === 'loaned' && activeCount > 0 && (
              <span className="ml-1 text-xs bg-chart-4/30 rounded-full px-1.5">{activeCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Herramienta</th>
                <th className="text-right font-medium px-4 py-2">Cant.</th>
                <th className="text-left font-medium px-4 py-2">Trabajador</th>
                <th className="text-left font-medium px-4 py-2">Préstamo</th>
                <th className="text-left font-medium px-4 py-2">Devolución</th>
                <th className="text-left font-medium px-4 py-2">Estado</th>
                <th className="text-right font-medium px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <TableStatusRow
                colSpan="7" loading={loading} error={error} onRetry={loadData}
                empty={visible.length === 0} emptyText="No hay préstamos para este filtro."
              />
              {!loading && !error && visible.map((loan) => {
                const isLoaned = loan.status === 'loaned'
                return (
                  <tr key={loan.id} className={isLoaned ? 'bg-chart-4/10 hover:bg-chart-4/20' : 'hover:bg-accent/30'}>
                    <td className="px-4 py-3">{productLabel(loan.product_id)}</td>
                    <td className="px-4 py-3 text-right">{loan.quantity}</td>
                    <td className="px-4 py-3">{loan.worker_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(loan.loan_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(loan.return_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full text-xs px-2 py-0.5 ${isLoaned ? 'bg-chart-4/30' : 'bg-chart-2/20'}`}>
                        {isLoaned ? 'Prestado' : 'Devuelto'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isLoaned && canManage && (
                        <button
                          onClick={() => handleReturn(loan)}
                          disabled={returning === loan.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-chart-2/20 text-foreground text-xs px-2.5 py-1 hover:bg-chart-2/30 disabled:opacity-60"
                        >
                          <i className="bi bi-box-arrow-in-down"></i>{returning === loan.id ? 'Registrando...' : 'Devolver'}
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
            Mostrando {visible.length} de {loans.length} préstamos
          </div>
        )}
      </div>

      {creating && (
        <NewLoanModal
          products={products.filter((p) => p.status === 'active')}
          loanedByProduct={loanedByProduct}
          workers={workers}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}

function NewLoanModal({ products, loanedByProduct, workers, onClose, onCreated }) {
  const [form, setForm] = useState({ product_id: '', quantity: '1', worker_name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const availableOf = (p) => Number(p.current_stock) - (loanedByProduct[p.id] || 0)
  const selected = products.find((p) => String(p.id) === form.product_id)
  const isNewWorker =
    form.worker_name.trim() !== '' &&
    !workers.some((w) => w.full_name.toLowerCase() === form.worker_name.trim().toLowerCase())

  const handleSubmit = async (e) => {
    e.preventDefault()
    const quantity = Number(form.quantity)
    if (!form.product_id) return setError('Seleccione una herramienta.')
    if (!(quantity > 0)) return setError('La cantidad debe ser mayor que cero.')
    if (!form.worker_name.trim()) return setError('Indique el trabajador.')
    if (selected && quantity > availableOf(selected)) {
      return setError(`Solo hay ${availableOf(selected)} disponibles para préstamo.`)
    }

    setSaving(true)
    setError(null)
    try {
      onCreated(await createLoan({
        product_id: Number(form.product_id),
        quantity: form.quantity,
        worker_name: form.worker_name.trim(),
      }))
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title="Nuevo préstamo"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60">
              {saving ? 'Registrando...' : 'Registrar préstamo'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium block mb-1.5">Herramienta</label>
            <select value={form.product_id} onChange={set('product_id')} className={inputClass}>
              <option value="">Seleccione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id} disabled={availableOf(p) <= 0}>
                  {p.internal_code} · {p.name} (Disponible: {availableOf(p)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Cantidad</label>
            <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={set('quantity')} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Trabajador</label>
          <input
            type="text"
            list="loan-workers"
            maxLength={100}
            placeholder="Escriba el nombre o seleccione uno existente"
            value={form.worker_name}
            onChange={set('worker_name')}
            className={inputClass}
          />
          <datalist id="loan-workers">
            {workers.map((w) => <option key={w.id} value={w.full_name} />)}
          </datalist>
          <p className="text-xs text-muted-foreground mt-1.5">
            El trabajador no necesita una cuenta en el sistema.
            {isNewWorker && ' Se registrará como trabajador nuevo.'}
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-chart-4/10 border border-chart-4/30 p-3 text-sm">
          <i className="bi bi-info-circle-fill mt-0.5"></i>
          <span>El préstamo no modifica el stock registrado; reduce la cantidad disponible hasta su devolución.</span>
        </div>
        <ErrorBox message={error} />
      </Modal>
    </form>
  )
}
