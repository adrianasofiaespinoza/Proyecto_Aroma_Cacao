import React, { useEffect, useState } from 'react'
import { getProducts } from '../services/api.js'

export default function ProductTable() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProducts()
      setProducts(data)
    } catch (err) {
      setError(err.message || 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

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
              onClick={loadProducts}
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
          No se encontraron productos registrados en el inventario.
        </td>
      </tr>
    )
  }

  return (
    <>
      {products.map((product) => {
        const isLowStock = Number(product.current_stock) <= Number(product.minimum_stock)
        const isActive = product.status === 'active'

        return (
          <tr key={product.id} className="hover:bg-accent/30 transition-colors">
            <td className="px-4 py-3 font-mono text-xs">{product.internal_code}</td>
            <td className="px-4 py-3">
              <div className="font-medium">{product.name}</div>
              {product.brand && (
                <div className="text-xs text-muted-foreground">
                  {product.brand} {product.model ? `- ${product.model}` : ''}
                </div>
              )}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {product.physical_location || 'Sin ubicación'}
            </td>
            <td
              className={`px-4 py-3 text-right font-medium ${
                isLowStock ? 'text-destructive' : ''
              }`}
            >
              {product.current_stock}
              {isLowStock && (
                <i
                  className="bi bi-exclamation-triangle-fill ml-1 text-xs text-destructive"
                  title="Stock en nivel crítico o inferior al mínimo"
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
            <td className="px-4 py-3 text-right">
              <button
                onClick={() => {
                  document
                    .getElementById('modalProducto')
                    ?.classList.remove('hidden')
                }}
                className="text-muted-foreground hover:text-foreground p-1 transition"
                title="Editar producto"
              >
                <i className="bi bi-pencil"></i>
              </button>
            </td>
          </tr>
        )
      })}
    </>
  )
}
