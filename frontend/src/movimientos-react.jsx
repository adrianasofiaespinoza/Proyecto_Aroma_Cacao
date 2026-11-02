import React from 'react'
import { createRoot } from 'react-dom/client'
import MovementsPage from './components/MovementsPage.jsx'

const container = document.getElementById('react-movements')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <MovementsPage />
    </React.StrictMode>
  )
}
