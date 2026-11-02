import React, { useEffect, useState } from 'react'
import { getAlerts, getLoans, getMovements, getProducts } from '../services/api.js'

const TYPE_LABELS = { ENTRY: 'Entrada', EXIT: 'Salida', ADJUSTMENT: 'Ajuste' }

// El backend guarda fechas UTC sin zona horaria
function formatDate(value) {
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`)
  return date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' })
}

function SummaryCard({ label, value, href, highlight }) {
  return (
    <a href={href} className="bg-card border border-border rounded-xl p-4 hover:bg-accent/30 transition">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-medium ${highlight ? 'text-destructive' : ''}`}>{value}</p>
    </a>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const loadData = async () => {
    setError(null)
    try {
      const [products, alerts, pending, loans] = await Promise.all([
        getProducts(),
        getAlerts(),
        getMovements({ status: 'pending' }),
        getLoans(),
      ])
      setData({ products, alerts, pending, loans })
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        <p>{error}</p>
        <button onClick={loadData} className="text-xs underline text-primary hover:opacity-80 mt-2">Reintentar</button>
      </div>
    )
  }

  if (!data) {
    return (
      <p className="text-center text-muted-foreground py-8">
        <i className="bi bi-arrow-repeat animate-spin mr-2"></i>Cargando resumen...
      </p>
    )
  }

  const productsById = Object.fromEntries(data.products.map((p) => [p.id, p]))
  const activeProducts = data.products.filter((p) => p.status === 'active')
  // Las alertas activas son la fuente de verdad del stock bajo (services/alerts.py)
  const lowStock = data.alerts
    .filter((a) => a.status === 'active' && productsById[a.product_id])
    .map((a) => productsById[a.product_id])
    .sort((a, b) => Number(a.current_stock) - Number(b.current_stock))
  const loanedUnits = data.loans
    .filter((l) => l.status === 'loaned')
    .reduce((total, l) => total + Number(l.quantity), 0)

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Productos activos" value={activeProducts.length} href="productos.html" />
        <SummaryCard label="Stock bajo" value={lowStock.length} href="productos.html" highlight={lowStock.length > 0} />
        <SummaryCard label="Movimientos pendientes" value={data.pending.length} href="movimientos.html" />
        <SummaryCard label="Herramientas prestadas" value={loanedUnits} href="prestamos.html" />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-7 gap-4">
        <div className="2xl:col-span-4 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-medium flex items-center gap-2">
            <i className="bi bi-exclamation-triangle text-destructive"></i>Alertas de stock bajo
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Código</th>
                  <th className="text-left font-medium px-4 py-2">Producto</th>
                  <th className="text-right font-medium px-4 py-2">Stock</th>
                  <th className="text-right font-medium px-4 py-2">Mínimo</th>
                  <th className="text-left font-medium px-4 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lowStock.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-6 text-center text-muted-foreground">
                      <i className="bi bi-check-circle mr-2"></i>Ningún producto está en el mínimo o por debajo.
                    </td>
                  </tr>
                )}
                {lowStock.map((p) => {
                  const depleted = Number(p.current_stock) <= 0
                  return (
                    <tr key={p.id} className="hover:bg-accent/30">
                      <td className="px-4 py-3 font-mono text-xs">{p.internal_code}</td>
                      <td className="px-4 py-3">{p.name}</td>
                      <td className="px-4 py-3 text-right font-medium text-destructive">{p.current_stock}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{p.minimum_stock}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full text-xs px-2 py-0.5 ${depleted ? 'bg-destructive/15 text-destructive' : 'bg-chart-4/30'}`}>
                          {depleted ? 'Agotado' : 'Stock bajo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="2xl:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-medium flex items-center gap-2">
            <i className="bi bi-hourglass-split"></i>Pendientes de autorización
          </div>
          {data.pending.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay movimientos pendientes.</p>
          )}
          <div className="divide-y divide-border">
            {data.pending.slice(0, 6).map((m) => {
              const detail = m.details[0]
              const product = detail && productsById[detail.product_id]
              return (
                <a key={m.id} href="movimientos.html" className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent/30">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full bg-muted text-xs px-2 py-0.5 mr-2">{TYPE_LABELS[m.type] || m.type}</span>
                    <span className="font-medium">{product ? product.name : `Movimiento #${m.id}`}</span>
                    {detail && <span className="text-muted-foreground"> · {detail.quantity}</span>}
                    <div className="text-xs text-muted-foreground truncate">{m.requesting_user_name}</div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(m.date)}</span>
                </a>
              )
            })}
          </div>
          {data.pending.length > 6 && (
            <a href="movimientos.html" className="block px-4 py-2 border-t border-border text-xs text-primary hover:underline">
              Ver los {data.pending.length} pendientes
            </a>
          )}
        </div>
      </div>
    </>
  )
}
