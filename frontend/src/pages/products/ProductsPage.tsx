import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useInventory } from '../../api/useInventory'
import type { Product } from '../../api/types'
import { useSessionUser } from '../../app/AuthProvider'
import { Button, Chip, CodeTag, DataTable, FilterBar, IconButton, Notice, PageHeader, Panel, RoleGate, SearchInput, Select, StatusBadge, StockMeter, type Column } from '../../components/ui'
import { isLowStock, lotState } from '../../lib/domain'
import { n } from '../../lib/format'
import { can } from '../../lib/permissions'

const ESTADOS = [
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
  { value: 'todos', label: 'Todos' },
]

export function ProductsPage() {
  const user = useSessionUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const inv = useInventory({ machines: false })
  const q = params.get('q') ?? ''
  const cat = params.get('categoria') ?? ''
  const estado = params.get('estado') ?? 'activos'
  const lotes = params.get('lotes') ?? ''
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const admin = can(user.role, 'administrar')

  const low = inv.products.filter(isLowStock)
  const active = inv.products.filter((p) => p.status === 'active')
  const inactive = inv.products.length - active.length
  const expiringProducts = useMemo(
    () => new Set(inv.lots.filter((l) => n(l.remaining_quantity) > 0 && (lotState(l) === 'vencido' || lotState(l) === 'por-vencer')).map((l) => l.product_id)),
    [inv.lots],
  )
  const expiredProducts = useMemo(() => new Set(inv.lots.filter((l) => n(l.remaining_quantity) > 0 && lotState(l) === 'vencido').map((l) => l.product_id)), [inv.lots])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return inv.products
      .filter((p) => (estado === 'activos' ? p.status === 'active' : estado === 'inactivos' ? p.status === 'inactive' : estado === 'stock-bajo' ? isLowStock(p) : true))
      .filter((p) => !cat || String(p.category_id) === cat)
      .filter((p) => !lotes || expiringProducts.has(p.id))
      .filter((p) => !needle || `${p.internal_code} ${p.name} ${p.brand ?? ''} ${p.model ?? ''} ${p.part_number ?? ''} ${p.physical_location ?? ''}`.toLowerCase().includes(needle))
      // Primero lo que necesita atención: stock bajo, luego el resto por código.
      .sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)) || a.internal_code.localeCompare(b.internal_code))
  }, [inv.products, q, cat, estado, lotes, expiringProducts])

  /** Solo se marcan las excepciones; un producto activo y normal no lleva insignia. */
  const stateBadge = (p: Product) => {
    if (p.status !== 'active') return <StatusBadge status="inactivo" />
    if (isLowStock(p)) return <StatusBadge status="stock-bajo" />
    if (expiredProducts.has(p.id)) return <StatusBadge status="vencido" label="Lote vencido" />
    if (expiringProducts.has(p.id)) return <StatusBadge status="por-vencer" />
    return null
  }

  const cols: Column<Product>[] = [
    {
      key: 'name', header: 'Producto', mobile: 'title',
      render: (p) => (
        <>
          <div className="bd-cell-title">{p.name}</div>
          <div className="bd-cell-sub pr-sub">
            <CodeTag>{p.internal_code}</CodeTag>
            <span>{[p.brand, p.model].filter(Boolean).join(' · ') || 'Sin marca'}</span>
            <span>· {inv.categoryById.get(p.category_id)?.name ?? '—'}</span>
          </div>
        </>
      ),
    },
    { key: 'loc', header: 'Ubicación', width: 160, mobileLabel: 'Ubicación', render: (p) => <span className="bd-mono">{p.physical_location ?? '—'}</span> },
    { key: 'stock', header: 'Stock', width: 190, mobile: 'wide', mobileLabel: 'Stock', render: (p) => <StockMeter current={n(p.current_stock)} min={n(p.minimum_stock)} max={n(p.maximum_stock)} unit={inv.unitOf(p)} /> },
    { key: 'state', header: 'Estado', width: 130, mobile: 'badge', render: stateBadge },
  ]

  const openProduct = (p: Product) => navigate(`/productos/${p.id}`)
  const openLots = (p: Product) => navigate(`/productos/${p.id}/lotes`)
  const filtered = !!(q || cat || lotes || estado !== 'activos')

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={inv.isLoading ? 'Cargando…' : `${active.length} activos · ${low.length} con stock bajo · ${inactive} inactivos`}
        actions={<RoleGate role={user.role} action="administrar"><Button variant="primary" icon="plus-lg" onClick={() => navigate('/productos/nuevo')}>Nuevo producto</Button></RoleGate>}
      />
      {user.role === 'lectura' && <Notice tone="info" icon="eye" title="Acceso de solo lectura">Puedes consultar el inventario. Para pedir repuestos, habla con el coordinador.</Notice>}
      <Panel flush>
        <FilterBar>
          <SearchInput placeholder="Buscar por código, nombre o marca" value={q} onChange={(e) => setParam('q', e.target.value)} />
          <div className="pr-filter"><Select aria-label="Categoría" value={cat} onChange={(e) => setParam('categoria', e.target.value)} placeholder="Todas las categorías" options={inv.categories.map((c) => ({ value: String(c.id), label: c.name }))} /></div>
          <div className="pr-filter pr-filter-sm"><Select aria-label="Estado" value={estado === 'stock-bajo' ? 'activos' : estado} onChange={(e) => setParam('estado', e.target.value)} options={ESTADOS} /></div>
          <div className="bd-filter-scroll">
            <Chip icon="exclamation-triangle-fill" count={low.length} pressed={estado === 'stock-bajo'} onClick={() => setParam('estado', estado === 'stock-bajo' ? 'activos' : 'stock-bajo')}>Stock bajo</Chip>
            {expiringProducts.size > 0 && <Chip icon="calendar-x" count={expiringProducts.size} pressed={!!lotes} onClick={() => setParam('lotes', lotes ? '' : 'por-vencer')}>Por vencer</Chip>}
          </div>
        </FilterBar>
        <DataTable
          columns={cols}
          rows={rows}
          rowTone={(p) => (p.status !== 'active' ? 'muted' : isLowStock(p) ? 'danger' : null)}
          caption="Productos"
          state={inv.isLoading ? 'loading' : inv.isError ? 'error' : 'ready'}
          onRetry={inv.refetch}
          loadingLabel="Cargando productos…"
          empty={{
            icon: q ? 'search' : 'box-seam',
            title: q ? `Sin resultados para “${q}”` : 'No hay productos con esos filtros',
            text: q ? 'Prueba con el código interno o parte del nombre.' : admin ? 'Crea el primero con «Nuevo producto».' : undefined,
            action: filtered ? <Button variant="secondary" size="lg" icon="x-lg" onClick={() => setParams({}, { replace: true })}>Quitar filtros</Button> : undefined,
          }}
          onRowClick={openProduct}
          actions={(p) => (
            // Dos huecos fijos: lotes (si aplica) y editar/ver, para que la columna quede alineada.
            <>
              {p.requires_lot
                ? <IconButton icon="layers" label={`Lotes de ${p.name}`} onClick={(e) => { e.stopPropagation(); openLots(p) }} />
                : <span className="bd-iconbtn-slot" aria-hidden="true" />}
              <IconButton icon={admin ? 'pencil' : 'chevron-right'} label={`${admin ? 'Editar' : 'Ver'} ${p.name}`} onClick={(e) => { e.stopPropagation(); openProduct(p) }} />
            </>
          )}
          mobileActions={(p) => (
            <>
              <Button variant="secondary" icon={admin ? 'pencil' : 'eye'} onClick={(e) => { e.stopPropagation(); openProduct(p) }}>{admin ? 'Editar' : 'Ver'}</Button>
              {p.requires_lot && <Button variant="secondary" icon="layers" onClick={(e) => { e.stopPropagation(); openLots(p) }}>Lotes</Button>}
            </>
          )}
        />
      </Panel>
    </>
  )
}
