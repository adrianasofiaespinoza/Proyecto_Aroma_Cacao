import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useCreateLoan, useReturnLoan, useWorkers } from '../api/hooks'
import { useInventory } from '../api/useInventory'
import type { Loan } from '../api/types'
import { useSessionUser } from '../app/AuthProvider'
import { Button, ConfirmDialog, DataTable, Field, FilterBar, Notice, PageHeader, Panel, QuantityStepper, SearchInput, Segmented, Select, TextInput, useToast, type Column } from '../components/ui'
import { describeError } from '../lib/errors'
import { fmtDateTime, fmtNum, fmtQty, fmtRelative, n } from '../lib/format'
import { can } from '../lib/permissions'

export function LoansPage() {
  const user = useSessionUser()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const estado = params.get('estado') ?? 'prestado'
  const q = params.get('q') ?? ''
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const inv = useInventory({ machines: false })
  const workers = useWorkers()
  const createLoan = useCreateLoan()
  const returnLoan = useReturnLoan()
  const lender = can(user.role, 'prestar')

  const [toolId, setToolId] = useState('')
  const [worker, setWorker] = useState('')
  const [qty, setQty] = useState(1)
  const [tried, setTried] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [returning, setReturning] = useState<Loan | null>(null)

  const loaned = inv.loans.filter((l) => l.status === 'loaned')
  const oldest = [...loaned].sort((a, b) => a.loan_date.localeCompare(b.loan_date))[0]
  const tools = useMemo(() => inv.products.filter((p) => p.status === 'active' && !p.requires_lot).sort((a, b) => a.name.localeCompare(b.name)), [inv.products])
  const tool = toolId ? inv.productById.get(Number(toolId)) : undefined
  const toolStock = tool ? n(tool.current_stock) : 0
  const toolLent = tool ? (inv.loanedByProduct.get(tool.id) ?? 0) : 0
  const toolAvail = toolStock - toolLent
  const toolUnit = inv.unitOf(tool)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return inv.loans
      // El filtro está en español; el backend guarda 'loaned' / 'returned'.
      .filter((l) => estado === 'todos' || l.status === (estado === 'devuelto' ? 'returned' : 'loaned'))
      .filter((l) => !needle || `${inv.productById.get(l.product_id)?.name ?? ''} ${inv.productById.get(l.product_id)?.internal_code ?? ''} ${l.worker_name ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => b.loan_date.localeCompare(a.loan_date))
  }, [inv.loans, inv.productById, estado, q])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    setFormError(null)
    if (!tool || !worker.trim() || qty <= 0 || qty > toolAvail) return
    try {
      await createLoan.mutateAsync({ product_id: tool.id, quantity: qty, worker_name: worker.trim() })
      toast.ok(<><b>Préstamo registrado.</b> {tool.name} · {fmtQty(qty, toolUnit)} a {worker.trim()}.</>)
      setToolId('')
      setWorker('')
      setQty(1)
      setTried(false)
      setParam('estado', 'prestado')
    } catch (err) {
      const d = describeError(err)
      setFormError(`${d.title}. ${d.message}`)
    }
  }
  const doReturn = async () => {
    if (!returning) return
    const p = inv.productById.get(returning.product_id)
    try {
      await returnLoan.mutateAsync(returning.id)
      toast.ok(<><b>Devolución registrada.</b> {p?.name ?? 'La herramienta'} vuelve a estar disponible.</>)
      setReturning(null)
    } catch (err) {
      setReturning(null)
      const d = describeError(err)
      toast.danger(<><b>{d.title}</b> {d.message}</>)
    }
  }

  /** Lo que queda en bodega de esa herramienta ahora: stock − prestado. */
  const availCell = (l: Loan) => {
    const p = inv.productById.get(l.product_id)
    if (!p) return '—'
    const stock = n(p.current_stock)
    const lent = inv.loanedByProduct.get(p.id) ?? 0
    return <span className="bd-num"><b>{fmtNum(stock - lent)}</b> de {fmtNum(stock)}</span>
  }
  const cols: Column<Loan>[] = [
    { key: 'tool', header: 'Herramienta', mobile: 'title', render: (l) => { const p = inv.productById.get(l.product_id); return <><div className="bd-cell-title">{p?.name ?? `Producto ${l.product_id}`}</div><div className="bd-cell-sub"><span className="bd-mono">{p?.internal_code}</span> · {fmtQty(l.quantity, inv.unitOf(p))}</div></> } },
    { key: 'worker', header: 'Trabajador', width: 130, mobile: 'wide', render: (l) => l.worker_name ?? '—' },
    { key: 'avail', header: 'En bodega', width: 95, mobile: 'meta', render: availCell },
    {
      key: 'out', header: 'Prestado', width: 165, mobile: 'meta',
      render: (l) => <><div className="bd-num">{fmtDateTime(l.loan_date)}</div>{l.return_date && <div className="bd-cell-sub bd-num"><b>Devuelto</b> {fmtDateTime(l.return_date)}</div>}</>,
    },
  ]
  // Sin columna de estado: las devueltas se ven atenuadas, con su fecha de devolución y sin botón.

  const list = (
    <Panel flush>
      <FilterBar>
        <SearchInput placeholder="Buscar herramienta o trabajador" value={q} onChange={(e) => setParam('q', e.target.value)} />
        <Segmented label="Estado" value={estado} onChange={(v) => setParam('estado', v)} options={[{ value: 'prestado', label: `Prestadas · ${loaned.length}` }, { value: 'devuelto', label: 'Devueltas' }, { value: 'todos', label: 'Todas' }]} />
      </FilterBar>
      <DataTable
        columns={cols}
        rows={rows}
        rowTone={(l) => (l.status === 'returned' ? 'muted' : null)}
        caption="Préstamos"
        state={inv.isLoading ? 'loading' : inv.isError ? 'error' : 'ready'}
        onRetry={inv.refetch}
        loadingLabel="Cargando préstamos…"
        empty={{ icon: 'tools', title: estado === 'prestado' ? 'No hay herramientas fuera de bodega' : 'No hay préstamos con esos filtros', text: estado === 'prestado' ? 'Todo está en su sitio.' : undefined }}
        actions={lender ? (l) => (l.status === 'loaned' ? <Button size="sm" variant="secondary" icon="arrow-counterclockwise" onClick={() => setReturning(l)}>Devolver</Button> : null) : null}
        mobileActions={lender ? (l) => (l.status === 'loaned' ? <Button variant="primary" icon="arrow-counterclockwise" onClick={() => setReturning(l)}>Registrar devolución</Button> : null) : null}
      />
    </Panel>
  )

  const form = lender && (
    <Panel title="Nuevo préstamo" icon="tools">
      <form onSubmit={submit} noValidate className="bd-stack">
        {formError && <Notice tone="danger">{formError}</Notice>}
        <Field label="Herramienta" htmlFor="tool" required error={tried && !tool ? 'Elige la herramienta.' : undefined} hint="Los productos con lotes no se prestan.">
          <Select id="tool" value={toolId} onChange={(e) => { setToolId(e.target.value); setQty(1) }} placeholder="Elige una" options={tools.map((p) => ({ value: String(p.id), label: `${p.internal_code} · ${p.name}` }))} />
        </Field>
        {tool && (
          <div className="pr-calc">
            <div><small>Stock</small><b>{fmtNum(toolStock)}</b></div><span>−</span>
            <div><small>Prestado</small><b>{fmtNum(toolLent)}</b></div><span>=</span>
            <div className="pr-calc-res"><small>Disponible</small><b>{fmtNum(toolAvail)}</b></div>
          </div>
        )}
        <Field label="Trabajador" htmlFor="worker" required hint="Escribe el nombre completo. No necesita cuenta en el sistema." error={tried && !worker.trim() ? 'Escribe el nombre del trabajador.' : undefined}>
          <TextInput id="worker" icon="person-badge" value={worker} onChange={(e) => setWorker(e.target.value)} list="workers" maxLength={100} autoComplete="off" />
          <datalist id="workers">{(workers.data ?? []).map((w) => <option key={w.id} value={w.full_name} />)}</datalist>
        </Field>
        <Field label="Cantidad" htmlFor="qty" required hint={tool ? `Máximo ${fmtQty(toolAvail, toolUnit)}` : undefined} error={tool && qty > toolAvail ? `Solo hay ${fmtQty(toolAvail, toolUnit)} disponibles.` : tried && qty <= 0 ? 'La cantidad debe ser mayor que cero.' : undefined}>
          <QuantityStepper id="qty" value={qty} min={0} max={tool ? Math.max(toolAvail, 0) : undefined} unit={toolUnit} onChange={setQty} />
        </Field>
        <p className="bd-muted" style={{ margin: 0 }}>Se registra con la fecha y hora de ahora.</p>
        <Button variant="primary" size="lg" block icon="check-lg" type="submit" loading={createLoan.isPending} disabled={!!tool && toolAvail <= 0}>Registrar préstamo</Button>
      </form>
    </Panel>
  )

  const returningProduct = returning ? inv.productById.get(returning.product_id) : undefined
  const rStock = returningProduct ? n(returningProduct.current_stock) : 0
  const rLent = returningProduct ? (inv.loanedByProduct.get(returningProduct.id) ?? 0) : 0

  return (
    <>
      <PageHeader
        title="Préstamos de herramientas"
        subtitle={inv.isLoading ? 'Cargando…' : `${loaned.length} ${loaned.length === 1 ? 'herramienta' : 'herramientas'} fuera de bodega${oldest ? ` · la más antigua desde ${fmtRelative(oldest.loan_date)}` : ''}`}
      />
      {lender ? <div className="pr-split">{list}{form}</div> : list}
      {returning && (
        <ConfirmDialog
          tone="ok"
          icon="arrow-counterclockwise"
          title="¿Registrar la devolución?"
          confirmLabel="Sí, ya está en bodega"
          confirmIcon="check-lg"
          loading={returnLoan.isPending}
          onCancel={() => setReturning(null)}
          onConfirm={() => void doReturn()}
          consequences={[
            ['Herramienta', `${returningProduct?.name ?? ''} · ${returningProduct?.internal_code ?? ''}`],
            ['Trabajador', returning.worker_name ?? '—'],
            ['Cantidad', fmtQty(returning.quantity, inv.unitOf(returningProduct))],
            ['Disponible', `${fmtNum(rStock - rLent)} → ${fmtNum(rStock - rLent + n(returning.quantity))} de ${fmtNum(rStock)}`],
          ]}
        >
          <p style={{ margin: 0 }}>Confirma que la herramienta está físicamente en la bodega y en buen estado.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
