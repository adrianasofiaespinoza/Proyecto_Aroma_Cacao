import { useState, type FormEvent } from 'react'
import { useSupplierProducts } from '../../api/hooks'
import type { Inventory } from '../../api/useInventory'
import type { Product, Supplier, SupplierProduct } from '../../api/types'
import { Button, CodeTag, DataTable, Field, IconButton, Modal, Notice, Panel, SearchInput, TextInput, useToast, type Column } from '../../components/ui'
import { describeError } from '../../lib/errors'
import { fmtPrice } from '../../lib/format'

interface Offer extends SupplierProduct { product: Product | undefined }

/** Panel de un proveedor: datos de contacto y productos que ofrece con su precio de referencia. */
export function SupplierDetail({ supplier, inv, admin, onEdit }: { supplier: Supplier; inv: Inventory; admin: boolean; onEdit?: () => void }) {
  const toast = useToast()
  const links = useSupplierProducts()
  const [adding, setAdding] = useState(false)
  const [pricing, setPricing] = useState<Offer | null>(null)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Product | null>(null)
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)

  const offers: Offer[] = supplier.product_links.map((l) => ({ ...l, product: inv.productById.get(l.product_id) })).sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? ''))
  const candidates = inv.products.filter((p) => !supplier.product_links.some((l) => l.product_id === p.id)).filter((p) => !q || `${p.internal_code} ${p.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  const parsePrice = () => (price.trim() === '' ? null : Number(price.replace(',', '.')))

  const closeAll = () => { setAdding(false); setPricing(null); setPicked(null); setPrice(''); setQ(''); setError(null) }
  const submitAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!picked) return setError('Elige el producto.')
    const value = parsePrice()
    if (value != null && (Number.isNaN(value) || value < 0)) return setError('El precio debe ser un número de 0 o más.')
    try {
      await links.add.mutateAsync({ supplierId: supplier.id, productId: picked.id, price: value })
      toast.ok(<><b>{picked.name}</b> agregado a {supplier.company_name}.</>)
      closeAll()
    } catch (err) {
      const d = describeError(err)
      setError(`${d.title}. ${d.message}`)
    }
  }
  const submitPrice = async (e: FormEvent) => {
    e.preventDefault()
    if (!pricing) return
    const value = parsePrice()
    if (value != null && (Number.isNaN(value) || value < 0)) return setError('El precio debe ser un número de 0 o más.')
    try {
      await links.update.mutateAsync({ supplierId: supplier.id, productId: pricing.product_id, price: value })
      toast.ok(<><b>Precio actualizado.</b> {pricing.product?.name}: {fmtPrice(value)}</>)
      closeAll()
    } catch (err) {
      const d = describeError(err)
      setError(`${d.title}. ${d.message}`)
    }
  }
  const remove = async (o: Offer) => {
    try {
      await links.remove.mutateAsync({ supplierId: supplier.id, productId: o.product_id })
      toast.ok(<><b>{o.product?.name ?? 'Producto'}</b> quitado de {supplier.company_name}.</>)
    } catch (err) {
      const d = describeError(err)
      toast.danger(<><b>{d.title}</b> {d.message}</>)
    }
  }

  const cols: Column<Offer>[] = [
    { key: 'name', header: 'Producto', mobile: 'title', render: (o) => <><div className="bd-cell-title">{o.product?.name ?? `Producto ${o.product_id}`}</div><div className="bd-cell-sub bd-mono">{o.product?.internal_code}</div></> },
    { key: 'price', header: 'Precio ref.', align: 'right', mobile: 'meta', render: (o) => <b className="bd-num">{fmtPrice(o.reference_price)} <span className="bd-cell-sub">/ {inv.unitOf(o.product)}</span></b> },
  ]
  const phoneHref = supplier.phone ? `tel:${supplier.phone.replace(/[^\d+]/g, '')}` : undefined

  return (
    <Panel title={supplier.company_name} icon="building" flush actions={admin && onEdit ? <Button size="sm" variant="secondary" icon="pencil" onClick={onEdit}>Editar</Button> : undefined}>
      <div className="pv-sup">
        <dl className="bd-dl">
          <div><dt>RUC</dt><dd className="bd-mono">{supplier.ruc ?? '—'}</dd></div>
          <div><dt>Contacto</dt><dd>{supplier.contact_person ?? '—'}</dd></div>
          <div><dt>Teléfono</dt><dd className="bd-num">{supplier.phone ?? '—'}</dd></div>
          <div><dt>Correo</dt><dd>{supplier.email ?? '—'}</dd></div>
          <div style={{ gridColumn: '1 / -1' }}><dt>Dirección</dt><dd>{supplier.address ?? '—'}</dd></div>
        </dl>
        {(phoneHref || supplier.email) && (
          <div className="pv-sup-call bd-show-m bd-grid">
            {phoneHref && <Button variant="secondary" size="lg" icon="telephone" as="a" href={phoneHref}>Llamar</Button>}
            {supplier.email && <Button variant="secondary" size="lg" icon="envelope" as="a" href={`mailto:${supplier.email}`}>Escribir</Button>}
          </div>
        )}
      </div>
      <DataTable
        columns={cols}
        rows={offers}
        rowKey="product_id"
        caption="Productos que ofrece"
        empty={{ icon: 'cash-coin', title: 'Sin productos registrados', text: admin ? 'Agrega los productos que ofrece este proveedor y su precio de referencia.' : undefined }}
        actions={admin ? (o) => <><IconButton icon="pencil" label={`Cambiar precio de ${o.product?.name ?? ''}`} onClick={() => { setPricing(o); setPrice(o.reference_price ?? '') }} /><IconButton icon="x-lg" label={`Quitar ${o.product?.name ?? ''}`} onClick={() => void remove(o)} /></> : null}
        mobileActions={admin ? (o) => <><Button variant="secondary" icon="pencil" onClick={() => { setPricing(o); setPrice(o.reference_price ?? '') }}>Precio</Button><Button variant="danger-outline" icon="x-lg" onClick={() => void remove(o)}>Quitar</Button></> : null}
      />
      {admin && <div style={{ padding: 'var(--space-3) var(--space-6) 0' }}><Button size="sm" variant="secondary" icon="plus-lg" onClick={() => setAdding(true)}>Agregar producto</Button></div>}
      <p className="pv-sup-note">Precios de referencia en USD sin IVA. Se usan para estimar; no generan órdenes de compra.</p>

      {adding && (
        <Modal title={`Agregar producto a ${supplier.company_name}`} icon="cash-coin" onClose={closeAll} footer={<><Button variant="secondary" size="lg" onClick={closeAll}>Cancelar</Button><Button variant="primary" size="lg" icon="check-lg" form="sup-add" type="submit" loading={links.add.isPending}>Agregar</Button></>}>
          <form id="sup-add" onSubmit={submitAdd} noValidate className="bd-stack">
            {error && <Notice tone="danger">{error}</Notice>}
            {picked ? (
              <div className="ns-picked"><span /><div><b>{picked.name}</b><div className="bd-cell-sub"><CodeTag>{picked.internal_code}</CodeTag></div></div><Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Cambiar</Button></div>
            ) : (
              <div className="bd-picker">
                <SearchInput placeholder="Buscar por código o nombre" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                <ul className="bd-picker-list" aria-label="Productos">
                  {candidates.length === 0 && <li><button type="button" disabled>No hay productos sin agregar con ese texto.</button></li>}
                  {candidates.map((p) => <li key={p.id}><button type="button" onClick={() => setPicked(p)}><span><b>{p.name}</b><span className="bd-cell-sub"><CodeTag>{p.internal_code}</CodeTag></span></span></button></li>)}
                </ul>
              </div>
            )}
            <Field label="Precio de referencia" htmlFor="sup-price" optional hint="USD sin IVA, por unidad de medida."><TextInput id="sup-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix="USD" /></Field>
          </form>
        </Modal>
      )}
      {pricing && (
        <Modal title={`Precio de ${pricing.product?.name ?? 'producto'}`} icon="cash-coin" onClose={closeAll} footer={<><Button variant="secondary" size="lg" onClick={closeAll}>Cancelar</Button><Button variant="primary" size="lg" icon="check-lg" form="sup-price-form" type="submit" loading={links.update.isPending}>Guardar</Button></>}>
          <form id="sup-price-form" onSubmit={submitPrice} noValidate className="bd-stack">
            {error && <Notice tone="danger">{error}</Notice>}
            <Field label="Precio de referencia" htmlFor="sup-price2" optional hint="USD sin IVA. Vacío si no se conoce."><TextInput id="sup-price2" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix="USD" autoFocus /></Field>
          </form>
        </Modal>
      )}
    </Panel>
  )
}
