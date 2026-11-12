import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useCreateProduct, useDeactivateProduct, useMovements, useReactivateProduct, useUpdateProduct } from '../../api/hooks'
import { useInventory } from '../../api/useInventory'
import type { Product } from '../../api/types'
import { useSessionUser } from '../../app/AuthProvider'
import { Button, Checkbox, CodeTag, ConfirmDialog, ConnectionError, Field, LoadingRows, Notice, PageHeader, Panel, Select, StatusBadge, StockMeter, TextInput, useToast } from '../../components/ui'
import { isLowStock } from '../../lib/domain'
import { describeError, isApiError } from '../../lib/errors'
import { fmtQty, movementCode, n } from '../../lib/format'
import { can } from '../../lib/permissions'

interface FormState {
  internal_code: string
  name: string
  brand: string
  model: string
  part_number: string
  category_id: string
  unit_of_measure_id: string
  current_stock: string
  minimum_stock: string
  maximum_stock: string
  physical_location: string
  requires_lot: boolean
}

const EMPTY: FormState = { internal_code: '', name: '', brand: '', model: '', part_number: '', category_id: '', unit_of_measure_id: '', current_stock: '0', minimum_stock: '0', maximum_stock: '', physical_location: '', requires_lot: false }

function fromProduct(p: Product): FormState {
  return {
    internal_code: p.internal_code, name: p.name, brand: p.brand ?? '', model: p.model ?? '', part_number: p.part_number ?? '',
    category_id: String(p.category_id), unit_of_measure_id: String(p.unit_of_measure_id), current_stock: p.current_stock,
    minimum_stock: p.minimum_stock, maximum_stock: p.maximum_stock ?? '', physical_location: p.physical_location ?? '', requires_lot: p.requires_lot,
  }
}

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

/** Vista de consulta para Operador y Solo lectura. */
function ProductView({ product }: { product: Product }) {
  const user = useSessionUser()
  const navigate = useNavigate()
  const inv = useInventory({ machines: false })
  const unit = inv.unitOf(product)
  const loaned = inv.loanedByProduct.get(product.id) ?? 0
  return (
    <>
      <PageHeader back="Productos" backTo="/productos" title={product.name} subtitle={[product.internal_code, product.brand, product.physical_location].filter(Boolean).join(' · ')} actions={<StatusBadge status={user.role === 'lectura' ? 'solo-lectura' : product.status === 'active' ? 'activo' : 'inactivo'} size="lg" />} />
      <Panel title="Stock" icon="box-seam">
        <div className="bd-stack">
          <StockMeter current={n(product.current_stock)} min={n(product.minimum_stock)} max={n(product.maximum_stock)} unit={unit} />
          {loaned > 0 && <span className="bd-muted">Prestadas: {fmtQty(loaned, unit)} · disponible {fmtQty(inv.availableOf(product), unit)}</span>}
        </div>
      </Panel>
      <Panel title="Datos" icon="file-earmark-text">
        <dl className="bd-dl">
          <div><dt>Marca · modelo</dt><dd>{[product.brand, product.model].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt>N.º de parte</dt><dd className="bd-mono">{product.part_number ?? '—'}</dd></div>
          <div><dt>Categoría</dt><dd>{inv.categoryById.get(product.category_id)?.name ?? '—'}</dd></div>
          <div><dt>Ubicación</dt><dd className="bd-mono">{product.physical_location ?? '—'}</dd></div>
          <div><dt>Lote</dt><dd>{product.requires_lot ? <Button size="sm" variant="secondary" icon="layers" onClick={() => navigate(`/productos/${product.id}/lotes`)}>Ver lotes</Button> : 'No requiere'}</dd></div>
        </dl>
      </Panel>
      {user.role === 'lectura' ? (
        <Notice tone="info" icon="eye">Tu rol solo permite consultar. Las acciones de editar, desactivar y solicitar no se muestran.</Notice>
      ) : (
        product.status === 'active' && (
          <div className="bd-row">
            <Button variant="primary" icon="box-arrow-up" onClick={() => navigate(`/movimientos/nueva?tipo=salida&producto=${product.id}`)}>Pedir salida</Button>
            <Button variant="secondary" icon="box-arrow-in-down" onClick={() => navigate(`/movimientos/nueva?tipo=entrada&producto=${product.id}`)}>Pedir entrada</Button>
          </div>
        )
      )}
    </>
  )
}

export function ProductFormPage() {
  const { id } = useParams()
  const isNew = id == null
  const productId = Number(id)
  const user = useSessionUser()
  const navigate = useNavigate()
  const toast = useToast()
  const inv = useInventory({ machines: false })
  const product = isNew ? undefined : inv.productById.get(productId)
  const pending = useMovements({ status: 'pending' })
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const deactivate = useDeactivateProduct()
  const reactivate = useReactivateProduct()
  const admin = can(user.role, 'administrar')

  const [form, setForm] = useState<FormState>(EMPTY)
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<ReturnType<typeof describeError> | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)

  useEffect(() => {
    if (product) setForm(fromProduct(product))
  }, [product])

  if (isNew && !admin) return <Navigate to="/productos" replace />
  if (!isNew && inv.isLoading) return <Panel flush><LoadingRows rows={3} label="Cargando el producto…" /></Panel>
  if (!isNew && !product) {
    if (inv.offline) return <Panel flush><ConnectionError onRetry={inv.refetch} /></Panel>
    return <Notice tone="danger" title="No se encontró el producto">Puede que el enlace esté mal. <Button size="sm" variant="secondary" onClick={() => navigate('/productos')}>Volver a productos</Button></Notice>
  }
  if (!admin && product) return <ProductView product={product} />

  const unit = inv.unitOf(product ?? (form.unit_of_measure_id ? { unit_of_measure_id: Number(form.unit_of_measure_id) } : undefined))
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const min = num(form.minimum_stock)
  const max = num(form.maximum_stock)
  const errors = {
    code: tried && !form.internal_code.trim() ? 'Escribe el código interno.' : undefined,
    name: tried && !form.name.trim() ? 'Escribe el nombre.' : undefined,
    category: tried && !form.category_id ? 'Elige la categoría.' : undefined,
    unit: tried && !form.unit_of_measure_id ? 'Elige la unidad.' : undefined,
    min: tried && (min == null || Number.isNaN(min) || min < 0) ? 'El mínimo debe ser 0 o más.' : undefined,
    max: max != null && min != null && !Number.isNaN(max) && max < min ? `El máximo debe ser mayor que el mínimo (${form.minimum_stock}).` : undefined,
    stock: tried && isNew && (num(form.current_stock) ?? -1) < 0 ? 'El stock inicial debe ser 0 o más.' : undefined,
  }
  const invalid = Object.values(errors).some(Boolean) || !form.internal_code.trim() || !form.name.trim() || !form.category_id || !form.unit_of_measure_id || min == null || Number.isNaN(min)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    setServerError(null)
    if (invalid) return
    const base = {
      internal_code: form.internal_code.trim(), name: form.name.trim(), brand: form.brand.trim() || null, model: form.model.trim() || null, part_number: form.part_number.trim() || null,
      minimum_stock: min ?? 0, maximum_stock: max != null && !Number.isNaN(max) ? max : null, physical_location: form.physical_location.trim() || null, requires_lot: form.requires_lot,
      category_id: Number(form.category_id), unit_of_measure_id: Number(form.unit_of_measure_id),
    }
    try {
      if (isNew) {
        const created = await create.mutateAsync({ ...base, current_stock: form.requires_lot ? 0 : (num(form.current_stock) ?? 0) })
        toast.ok(<><b>Producto creado.</b> {created.internal_code} · {created.name}</>)
        navigate(created.requires_lot ? `/productos/${created.id}/lotes` : '/productos', { replace: true })
      } else if (product) {
        await update.mutateAsync({ id: product.id, input: base })
        toast.ok(<><b>Cambios guardados.</b> {base.internal_code} · {base.name}</>)
        navigate('/productos')
      }
    } catch (err) {
      setServerError({ ...describeError(err), code: isApiError(err) ? err.codeLabel : undefined })
    }
  }

  const openPending = product ? (pending.data ?? []).filter((m) => m.details.some((d) => d.product_id === product.id)) : []
  const doDeactivate = async () => {
    if (!product) return
    try {
      await deactivate.mutateAsync(product.id)
      setConfirmOff(false)
      toast.ok(<><b>Producto desactivado.</b> Ya no aparece en nuevas solicitudes; el stock y el historial se conservan.</>)
      navigate('/productos')
    } catch (err) {
      setConfirmOff(false)
      const d = describeError(err)
      toast.danger(<><b>{d.title}</b> {d.message}</>)
    }
  }
  const doReactivate = async () => {
    if (!product) return
    try {
      await reactivate.mutateAsync(product.id)
      toast.ok(<><b>Producto reactivado.</b> Vuelve a estar disponible para solicitudes.</>)
    } catch (err) {
      const d = describeError(err)
      const missing = isApiError(err) && (err.status === 404 || err.status === 405)
      toast.danger(<><b>{missing ? 'Todavía no se puede reactivar' : d.title}</b> {missing ? 'La reactivación llega con la tarea AC-7; aún no está en el servidor.' : d.message}</>)
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
      <PageHeader
        back="Productos"
        backTo="/productos"
        title={isNew ? 'Nuevo producto' : 'Editar producto'}
        subtitle={product ? <span className="bd-row"><CodeTag>{product.internal_code}</CodeTag>{isLowStock(product) && <StatusBadge status="stock-bajo" />}</span> : 'Los campos con * son obligatorios'}
        actions={product ? (product.status === 'active' ? <Button variant="danger-outline" icon="power" onClick={() => setConfirmOff(true)}>Desactivar</Button> : <Button variant="secondary" icon="arrow-counterclockwise" loading={reactivate.isPending} onClick={() => void doReactivate()}>Reactivar</Button>) : undefined}
      />
      {serverError && <Notice tone="danger" title={serverError.title} code={serverError.code}>{serverError.message}</Notice>}
      <Panel title="Identificación" icon="box-seam">
        <div className="bd-form-grid">
          <Field label="Código interno" htmlFor="code" required hint="Único. Prefijo de categoría + número." error={errors.code}><TextInput id="code" className="bd-mono" value={form.internal_code} onChange={(e) => set('internal_code', e.target.value.toUpperCase())} maxLength={30} /></Field>
          <Field label="Nombre" htmlFor="name" required className="bd-span" error={errors.name}><TextInput id="name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} /></Field>
          <Field label="Marca" htmlFor="brand" optional><TextInput id="brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} maxLength={50} /></Field>
          <Field label="Modelo" htmlFor="model" optional><TextInput id="model" value={form.model} onChange={(e) => set('model', e.target.value)} maxLength={50} /></Field>
          <Field label="Número de parte" htmlFor="part" optional><TextInput id="part" className="bd-mono" value={form.part_number} onChange={(e) => set('part_number', e.target.value)} maxLength={50} /></Field>
          <Field label="Categoría" htmlFor="cat" required error={errors.category}><Select id="cat" value={form.category_id} onChange={(e) => set('category_id', e.target.value)} placeholder="Elige una" options={inv.categories.map((c) => ({ value: String(c.id), label: c.name }))} /></Field>
          <Field label="Unidad" htmlFor="unit" required error={errors.unit}><Select id="unit" value={form.unit_of_measure_id} onChange={(e) => set('unit_of_measure_id', e.target.value)} placeholder="Elige una" options={inv.units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.abbreviation})` }))} /></Field>
        </div>
      </Panel>
      <Panel title="Stock y ubicación" icon="geo-alt">
        <div className="bd-form-grid">
          {isNew ? (
            <Field label="Stock inicial" htmlFor="stock" hint={form.requires_lot ? 'Con lotes, el stock entra por cada lote: queda en 0.' : 'Solo al crear. Después cambia con movimientos autorizados.'} error={errors.stock}>
              <TextInput id="stock" inputMode="decimal" value={form.requires_lot ? '0' : form.current_stock} disabled={form.requires_lot} onChange={(e) => set('current_stock', e.target.value)} suffix={unit} />
            </Field>
          ) : (
            <Field label="Stock actual" hint="Solo cambia con movimientos autorizados."><TextInput readOnlyValue={fmtQty(product?.current_stock, unit)} /></Field>
          )}
          <Field label="Mínimo" htmlFor="min" required error={errors.min}><TextInput id="min" inputMode="decimal" value={form.minimum_stock} onChange={(e) => set('minimum_stock', e.target.value)} suffix={unit} /></Field>
          <Field label="Máximo" htmlFor="max" optional error={errors.max}><TextInput id="max" inputMode="decimal" value={form.maximum_stock} onChange={(e) => set('maximum_stock', e.target.value)} suffix={unit} /></Field>
          <Field label="Ubicación física" htmlFor="loc" optional hint="Bodega-estante-nivel, p. ej. A-03-2"><TextInput id="loc" className="bd-mono" value={form.physical_location} onChange={(e) => set('physical_location', e.target.value)} maxLength={100} /></Field>
        </div>
      </Panel>
      <Panel title="Control" icon="sliders">
        <div className="bd-row" style={{ justifyContent: 'space-between' }}>
          <Checkbox label="Requiere lote y fecha de vencimiento" checked={form.requires_lot} onChange={(e) => set('requires_lot', e.target.checked)} />
          {product && <span className="bd-row"><span className="bd-muted">Estado</span><StatusBadge status={product.status === 'active' ? 'activo' : 'inactivo'} />{product.requires_lot && <Button size="sm" variant="ghost" icon="layers" onClick={() => navigate(`/productos/${product.id}/lotes`)}>Lotes</Button>}</span>}
        </div>
      </Panel>
      <div className="pf-foot">
        <Button variant="secondary" size="lg" onClick={() => navigate('/productos')}>Cancelar</Button>
        <Button variant="primary" size="lg" icon="check-lg" type="submit" loading={create.isPending || update.isPending}>{isNew ? 'Crear producto' : 'Guardar cambios'}</Button>
      </div>
      {confirmOff && product && (
        <ConfirmDialog
          tone="danger"
          icon="power"
          title="¿Desactivar este producto?"
          confirmLabel="Sí, desactivar"
          confirmIcon="power"
          loading={deactivate.isPending}
          onCancel={() => setConfirmOff(false)}
          onConfirm={() => void doDeactivate()}
          consequences={[
            ['Producto', `${product.internal_code} · ${product.name}`],
            ['Stock actual', `${fmtQty(product.current_stock, unit)} (se conserva)`],
            ['Solicitudes abiertas', openPending.length ? `${openPending.length} pendiente${openPending.length === 1 ? '' : 's'}: ${openPending.map((m) => movementCode(m.id)).join(', ')}` : 'Ninguna'],
          ]}
        >
          <p style={{ margin: 0 }}>Dejará de aparecer en nuevas solicitudes y sus alertas se cierran. El historial y el stock se conservan, y puedes reactivarlo cuando quieras.</p>
        </ConfirmDialog>
      )}
    </form>
  )
}
