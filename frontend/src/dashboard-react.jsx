import React from 'react'
import { createRoot } from 'react-dom/client'
import DashboardPage from './components/DashboardPage.jsx'

const container = document.getElementById('react-dashboard')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <DashboardPage />
    </React.StrictMode>
  )
}
