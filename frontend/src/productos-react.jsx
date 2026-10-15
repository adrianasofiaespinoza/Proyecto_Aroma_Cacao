
import React from 'react'
import { createRoot } from 'react-dom/client'
import ProductTable from './components/ProductTable.jsx'

const container = document.getElementById('react-products')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ProductTable />
    </React.StrictMode>
  )
}
