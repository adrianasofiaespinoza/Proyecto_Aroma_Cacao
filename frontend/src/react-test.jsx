
import React from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import ProductTable from './components/ProductTable.jsx'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        Aroma Cacao - React Product Table
      </h1>
      <ProductTable />
    </main>
  </React.StrictMode>
)
