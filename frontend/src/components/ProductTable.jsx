import React from 'react'

export default function ProductTable({
  products,
  loading,
  error,
  onRetry,
  categoriesById,
  unitsById,
  canManage,
  onEdit,
  onDeactivate,
  onLots,
}) {
  if (loading) {
    return (
      <tr>
        <td colSpan="7" className="px-4 py-8 text-center text-muted-foreground">
          <i className="bi bi-arrow-repeat animate-spin mr-2"></i>
          Cargando catálogo de productos desde la base de datos...
        </td>
      </tr>
    )
  }

  if (error) {
    return (
      <tr>
        <td colSpan="7" className="px-4 py-6 text-center text-destructive">
          <div className="flex flex-col items-center gap-2">
            <span>{error}</span>
            <button
              onClick={onRetry}
              className="text-xs underline text-primary hover:opacity-80"
            >
              Reintentar
            </button>
          </div>
        </td>
      </tr>
    )
  }

  if (products.length === 0) {
    return (
      <tr>
        <td colSpan="7" className="px-4 py-6 text-center text-muted-foreground">
          No se encontraron productos con los filtros seleccionados.
        </td>
      </tr>
    )
  }

  return (
    <>
      {products.map((product) => {
        const isActive = product.status === 'active'
        const isLowStock = isActive && Number(product.current_stock) <= Number(product.minimum_stock)
        const unit = unitsById[product.unit_of_measure_id]

        return (
          <tr key={product.id} className="hover:bg-accent/30 transition-colors">
            <td className="px-4 py-3 font-mono text-xs">{product.internal_code}</td>
            <td className="px-4 py-3">
              <div className="font-medium">
                {product.name}
                {product.requires_lot && (
                  <span className="ml-2 inline-flex rounded-full bg-muted text-xs font-normal px-2 py-0.5">Lotes</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {[product.brand, product.model].filter(Boolean).join(' - ')}
                {(product.brand || product.model) && ' · '}
                {product.physical_location || 'Sin ubicación'}
              </div>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {categoriesById[product.category_id]?.name || '—'}
            </td>
            <td
              className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                isLowStock ? 'text-destructive' : ''
              }`}
            >
              {product.current_stock}
              {unit && <span className="ml-1 text-xs text-muted-foreground">{unit.abbreviation}</span>}
              {isLowStock && (
                <i
                  className="bi bi-exclamation-triangle-fill ml-1 text-xs text-destructive"
                  title="Stock en el mínimo o por debajo de él"
                ></i>
              )}
            </td>
            <td className="px-4 py-3 text-right text-muted-foreground">
              {product.minimum_stock}
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex rounded-full text-xs px-2 py-0.5 ${
                  isActive
                    ? 'bg-chart-2/20 text-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isActive ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td className="px-4 py-3 text-right whitespace-nowrap">
              {product.requires_lot && (
                <button
                  onClick={() => onLots(product)}
                  className="text-muted-foreground hover:text-foreground p-1 transition"
                  title="Ver lotes"
                >
                  <i className="bi bi-layers"></i>
                </button>
              )}
              {canManage && (
                <>
                  <button
                    onClick={() => onEdit(product)}
                    className="text-muted-foreground hover:text-foreground p-1 transition"
                    title="Editar producto"
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                  {isActive && (
                    <button
                      onClick={() => onDeactivate(product)}
                      className="text-muted-foreground hover:text-destructive p-1 transition"
                      title="Desactivar producto"
                    >
                      <i className="bi bi-slash-circle"></i>
                    </button>
                  )}
                </>
              )}
            </td>
          </tr>
        )
      })}
    </>
  )
}
