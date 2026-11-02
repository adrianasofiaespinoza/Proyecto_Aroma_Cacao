import React from 'react'
import { createRoot } from 'react-dom/client'
import SuppliersPage from './components/SuppliersPage.jsx'

const container = document.getElementById('react-suppliers')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <SuppliersPage />
    </React.StrictMode>
  )
}
