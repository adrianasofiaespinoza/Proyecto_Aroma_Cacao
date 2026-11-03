import React from 'react'
import { createRoot } from 'react-dom/client'
import LoansPage from './components/LoansPage.jsx'

const container = document.getElementById('react-loans')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <LoansPage />
    </React.StrictMode>
  )
}
