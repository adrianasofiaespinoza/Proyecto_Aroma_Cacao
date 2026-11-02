import React from 'react'
import { createRoot } from 'react-dom/client'
import ProductsPage from './components/ProductsPage.jsx'

const container = document.getElementById('react-products')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ProductsPage />
    </React.StrictMode>
  )
}
