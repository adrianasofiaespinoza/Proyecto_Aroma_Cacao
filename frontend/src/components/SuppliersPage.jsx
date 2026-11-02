import React, { useEffect, useMemo, useState } from 'react'
import Modal, { ErrorBox, Notice, inputClass } from './Modal.jsx'
import {
  addSupplierProduct,
  getProducts,
  getSuppliers,
  removeSupplierProduct,
  saveSupplier,
  tokenStorage,
  updateSupplierProductPrice,
} from '../services/api.js'

const formatPrice = (value) => (value == null ? '—' : `$${Number(value).toFixed(2)}`)

export default function SuppliersPage() {
  // La interfaz solo oculta acciones; el backend exige Coordinator igualmente
  const canManage = tokenStorage.getUser()?.role === 'Coordinator'

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [productsOf, setProductsOf] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [supplierData, productData] = await Promise.all([getSuppliers(), getProducts()])
      setSuppliers(supplierData)
      setProducts(productData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return suppliers
    return suppliers.filter((s) =>
      [s.company_name, s.ruc, s.contact_person, s.email].filter(Boolean).some((v) => v.toLowerCase().includes(term)),
    )
  }, [suppliers, search])

  const replaceSupplier = (saved) =>
    setSuppliers((list) =>
      list.some((s) => s.id === saved.id) ? list.map((s) => (s.id === saved.id ? saved : s)) : [...list, saved],
    )

  const handleSaved = (saved, isEdit) => {
    replaceSupplier(saved)
    setEditing(null)
    setNotice(isEdit ? `Proveedor ${saved.company_name} actualizado.` : `Proveedor ${saved.company_name} registrado.`)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-medium">Proveedores</h2>
        {canManage && (
          <button
            onClick={() => setEditing({ supplier: null })}
            disabled={loading || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm px-4 py-2 hover:opacity-90 transition disabled:opacity-60"
          >
            <i className="bi bi-plus-lg"></i>Nuevo proveedor
          </button>
        )}
      </div>

      <Notice message={notice} onClose={() => setNotice(null)} />

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, RUC, contacto o correo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg bg-input-background border border-border px-3 py-2 text-sm"
        />
      </div>

      {loading && (
        <p className="text-center text-muted-foreground py-8"><i className="bi bi-arrow-repeat animate-spin mr-2"></i>Cargando proveedores...</p>
      )}
      {!loading && error && (
        <div className="text-center text-destructive py-6">
          <p>{error}</p>
          <button onClick={loadData} className="text-xs underline text-primary hover:opacity-80 mt-2">Reintentar</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-6">
          {suppliers.length === 0 ? 'Todavía no hay proveedores registrados.' : 'No hay proveedores que coincidan con la búsqueda.'}
        </p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-medium">{s.company_name}</h3>
                {canManage && (
                  <button onClick={() => setEditing({ supplier: s })} className="text-muted-foreground hover:text-foreground" title="Editar proveedor">
                    <i className="bi bi-pencil"></i>
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-3">{s.ruc ? `RUC ${s.ruc}` : 'Sin RUC'}</p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4 flex-1">
                {s.contact_person && <li><i className="bi bi-person mr-2"></i>{s.contact_person}</li>}
                {s.phone && <li><i className="bi bi-telephone mr-2"></i>{s.phone}</li>}
                {s.email && <li className="break-all"><i className="bi bi-envelope mr-2"></i>{s.email}</li>}
                {s.address && <li><i className="bi bi-geo-alt mr-2"></i>{s.address}</li>}
              </ul>
              <button
                onClick={() => setProductsOf(s.id)}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-border text-sm px-3 py-1.5 hover:bg-accent"
              >
                <i className="bi bi-box"></i>Ver productos ({s.product_links.length})
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <SupplierFormModal supplier={editing.supplier} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}

      {productsOf && (
        <SupplierProductsModal
          supplier={suppliers.find((s) => s.id === productsOf)}
          products={products}
          canManage={canManage}
          onClose={() => setProductsOf(null)}
          onChanged={replaceSupplier}
        />
      )}
    </>
  )
}

const FIELDS = ['company_name', 'ruc', 'contact_person', 'phone', 'email', 'address']

function SupplierFormModal({ supplier, onClose, onSaved }) {
  const isEdit = Boolean(supplier)
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, supplier?.[k] || ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.company_name.trim()) return setError('El nombre o razón social es obligatorio.')
    if (form.ruc.trim() && !/^\d{1,20}$/.test(form.ruc.trim())) return setError('El RUC solo puede contener dígitos.')

    setSaving(true)
    setError(null)
    try {
      // Campos vacíos se envían como null
      const payload = Object.fromEntries(FIELDS.map((k) => [k, form[k].trim() || null]))
      onSaved(await saveSupplier(supplier?.id, payload), isEdit)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title={isEdit ? `Editar ${supplier.company_name}` : 'Nuevo proveedor'}
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar proveedor'}
            </button>
          </>
        }
      >
        <div>
          <label className="text-sm font-medium block mb-1.5">Nombre / razón social *</label>
          <input type="text" maxLength={100} value={form.company_name} onChange={set('company_name')} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">RUC</label>
            <input type="text" inputMode="numeric" maxLength={20} placeholder="1790012345001" value={form.ruc} onChange={set('ruc')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Contacto</label>
            <input type="text" maxLength={100} value={form.contact_person} onChange={set('contact_person')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Teléfono</label>
            <input type="tel" maxLength={20} value={form.phone} onChange={set('phone')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Correo</label>
            <input type="email" maxLength={100} value={form.email} onChange={set('email')} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Dirección</label>
          <input type="text" maxLength={150} value={form.address} onChange={set('address')} className={inputClass} />
        </div>
        <ErrorBox message={error} />
      </Modal>
    </form>
  )
}

function SupplierProductsModal({ supplier, products, canManage, onClose, onChanged }) {
  const [selected, setSelected] = useState('')
  const [price, setPrice] = useState('')
  const [editingPrice, setEditingPrice] = useState(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(null)

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]))
  const linkedIds = supplier.product_links.map((l) => l.product_id)
  const available = products.filter((p) => p.status === 'active' && !linkedIds.includes(p.id))

  const run = async (action) => {
    setWorking(true)
    setError(null)
    try {
      onChanged(await action())
      setSelected('')
      setPrice('')
      setEditingPrice(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  const priceOrNull = (value) => (value.trim() === '' ? null : value.trim())

  return (
    <Modal
      title={`Productos de ${supplier.company_name}`}
      onClose={onClose}
      size="max-w-2xl"
      footer={<button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cerrar</button>}
    >
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Código</th>
              <th className="text-left font-medium px-3 py-2">Producto</th>
              <th className="text-right font-medium px-3 py-2">Precio ref.</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {supplier.product_links.length === 0 && (
              <tr><td colSpan="4" className="px-3 py-4 text-center text-muted-foreground">Sin productos asociados.</td></tr>
            )}
            {supplier.product_links.map((link) => {
              const p = productsById[link.product_id]
              const isEditing = editingPrice?.productId === link.product_id
              return (
                <tr key={link.product_id}>
                  <td className="px-3 py-2 font-mono text-xs">{p?.internal_code || `#${link.product_id}`}</td>
                  <td className="px-3 py-2">{p?.name}{p && p.status !== 'active' && <span className="text-xs text-muted-foreground"> (inactivo)</span>}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="number" min="0" step="0.01" autoFocus
                        value={editingPrice.value}
                        onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                        className="w-24 rounded-lg bg-input-background border border-border px-2 py-1 text-sm text-right"
                      />
                    ) : formatPrice(link.reference_price)}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button
                            disabled={working}
                            onClick={() => run(() => updateSupplierProductPrice(supplier.id, link.product_id, priceOrNull(editingPrice.value)))}
                            className="text-muted-foreground hover:text-foreground p-1" title="Guardar precio"
                          >
                            <i className="bi bi-check-lg"></i>
                          </button>
                          <button onClick={() => setEditingPrice(null)} className="text-muted-foreground hover:text-foreground p-1" title="Cancelar">
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingPrice({ productId: link.product_id, value: link.reference_price ?? '' })}
                            className="text-muted-foreground hover:text-foreground p-1" title="Editar precio"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            disabled={working}
                            onClick={() => run(() => removeSupplierProduct(supplier.id, link.product_id))}
                            className="text-muted-foreground hover:text-destructive p-1" title="Quitar producto"
                          >
                            <i className="bi bi-x-circle"></i>
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div>
          <label className="text-sm font-medium block mb-1.5">Asociar nuevo producto</label>
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className={inputClass}>
              <option value="">Seleccione un producto...</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.internal_code} · {p.name}</option>
              ))}
            </select>
            <input
              type="number" min="0" step="0.01" placeholder="Precio ref."
              value={price} onChange={(e) => setPrice(e.target.value)}
              className="w-full sm:w-32 rounded-lg bg-input-background border border-border px-3 py-2 text-sm"
            />
            <button
              disabled={!selected || working}
              onClick={() => run(() => addSupplierProduct(supplier.id, Number(selected), priceOrNull(price)))}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60 shrink-0"
            >
              Asociar
            </button>
          </div>
        </div>
      )}
      <ErrorBox message={error} />
    </Modal>
  )
}
