import React from 'react'
import { createRoot } from 'react-dom/client'
import UsersPage from './components/UsersPage.jsx'

const container = document.getElementById('react-users')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <UsersPage />
    </React.StrictMode>
  )
}
