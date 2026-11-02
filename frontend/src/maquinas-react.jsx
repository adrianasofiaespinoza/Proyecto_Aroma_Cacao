import React from 'react'
import { createRoot } from 'react-dom/client'
import MachinesPage from './components/MachinesPage.jsx'

const container = document.getElementById('react-machines')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <MachinesPage />
    </React.StrictMode>
  )
}
