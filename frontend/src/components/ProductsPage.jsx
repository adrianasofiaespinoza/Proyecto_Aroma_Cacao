import React, { useEffect, useMemo, useState } from 'react'
import ProductTable from './ProductTable.jsx'
import ProductFormModal from './ProductFormModal.jsx'
import { deactivateProduct, getCategories, getProducts, getUnits, tokenStorage } from '../services/api.js'

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]))

export default function ProductsPage() {
  // La interfaz solo oculta acciones; el backend exige Coordinator igualmente
  const canManage = tokenStorage.getUser()?.role === 'Coordinator'

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  // null = cerrado, { product: null } = nuevo, { product } = edición
  const [editing, setEditing] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [productData, categoryData, unitData] = await Promise.all([
        getProducts(),
        getCategories(),
        getUnits(),
      ])
      setProducts(productData)
      setCategories(categoryData)
      setUnits(unitData)
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const categoriesById = useMemo(() => byId(categories), [categories])
  const unitsById = useMemo(() => byId(units), [units])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (categoryFilter && String(p.category_id) !== categoryFilter) return false
      if (!term) return true
      return [p.internal_code, p.name, p.brand, p.model, p.part_number]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    })
  }, [products, search, categoryFilter, statusFilter])

  const handleSaved = (saved, isEdit) => {
    setProducts((list) => (isEdit ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]))
    setEditing(null)
    setNotice(isEdit ? `Producto ${saved.internal_code} actualizado.` : `Producto ${saved.internal_code} creado.`)
  }

  const handleDeactivate = async (product) => {
    if (!window.confirm(`¿Desactivar ${product.internal_code} · ${product.name}? Se conservará su historial.`)) return
    try {
      const saved = await deactivateProduct(product.id)
      setProducts((list) => list.map((p) => (p.id === saved.id ? saved : p)))
      setNotice(`Producto ${saved.internal_code} desactivado.`)
    } catch (err) {
      setNotice(null)
      window.alert(err.message)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-medium">Catálogo de productos</h2>
        {canManage && (
          <button
            onClick={() => setEditing({ product: null })}
            disabled={loading || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm px-4 py-2 hover:opacity-90 transition disabled:opacity-60"
          >
            <i className="bi bi-plus-lg"></i>Nuevo producto
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

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por código, nombre, marca o modelo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg bg-input-background border border-border px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg bg-input-background border border-border px-3 py-2 text-sm"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg bg-input-background border border-border px-3 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Código</th>
                <th className="text-left font-medium px-4 py-2">Nombre</th>
                <th className="text-left font-medium px-4 py-2">Categoría</th>
                <th className="text-right font-medium px-4 py-2">Stock</th>
                <th className="text-right font-medium px-4 py-2">Mínimo</th>
                <th className="text-left font-medium px-4 py-2">Estado</th>
                <th className="text-right font-medium px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <ProductTable
                products={filtered}
                loading={loading}
                error={error}
                onRetry={loadData}
                categoriesById={categoriesById}
                unitsById={unitsById}
                canManage={canManage}
                onEdit={(product) => setEditing({ product })}
                onDeactivate={handleDeactivate}
              />
            </tbody>
          </table>
        </div>
        {!loading && !error && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Mostrando {filtered.length} de {products.length} productos
          </div>
        )}
      </div>

      {editing && (
        <ProductFormModal
          product={editing.product}
          categories={categories}
          units={units}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
