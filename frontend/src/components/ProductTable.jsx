
const products = [
  {
    code: 'REP-014',
    name: 'Rodamiento 6205',
    category: 'Repuestos',
    stock: 0,
    minimum: 4,
    status: 'Activo'
  },
  {
    code: 'REP-032',
    name: 'Banda transportadora B-48',
    category: 'Repuestos',
    stock: 1,
    minimum: 2,
    status: 'Activo'
  },
  {
    code: 'MAT-021',
    name: 'Cable eléctrico #12',
    category: 'Materiales',
    stock: 0,
    minimum: 20,
    status: 'Inactivo'
  }
]

export default function ProductTable() {
  return (
    <>
      {products.map((product) => (
        <tr key={product.code} className="hover:bg-accent/30">
          <td className="px-4 py-3">{product.code}</td>
          <td className="px-4 py-3">{product.name}</td>
          <td className="px-4 py-3">{product.category}</td>
          <td className="px-4 py-3 text-right">{product.stock}</td>
          <td className="px-4 py-3 text-right">{product.minimum}</td>
          <td className="px-4 py-3">
            <span className="inline-flex rounded-full bg-chart-2/20 text-foreground text-xs px-2 py-0.5">
              {product.status}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <button
              onClick={() => {
                document.getElementById('modalProducto')?.classList.remove('hidden')
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <i className="bi bi-pencil"></i>
            </button>
          </td>
        </tr>
      ))}
    </>
  )
}
