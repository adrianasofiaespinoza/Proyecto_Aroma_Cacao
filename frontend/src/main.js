import './style.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { logout, tokenStorage } from './services/api.js'

document.addEventListener('DOMContentLoaded', () => {
  // 1. Session verification on protected pages
  const isLoginPage = window.location.pathname.endsWith('login.html') || window.location.pathname === '/'

  if (!isLoginPage && !tokenStorage.isAuthenticated()) {
    window.location.href = 'login.html'
    return
  }

  // 2. Populate user info in header if available
  const user = tokenStorage.getUser()
  if (user) {
    const userNameElements = document.querySelectorAll('.user-display-name')
    const userRoleElements = document.querySelectorAll('.user-display-role')
    const userAvatarElements = document.querySelectorAll('.user-display-avatar')

    userNameElements.forEach((el) => {
      el.textContent = user.full_name || user.username
    })

    userRoleElements.forEach((el) => {
      el.textContent = user.role
    })

    if (user.full_name) {
      const initials = user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
      userAvatarElements.forEach((el) => {
        el.textContent = initials
      })
    }
  }

  // 3. Logout handlers
  document.querySelectorAll('a[href="login.html"]').forEach((link) => {
    if (link.textContent.toLowerCase().includes('cerrar')) {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        logout()
      })
    }
  })

  // 4. Sidebar mobile toggle
  const trigger = document.getElementById('mobile-menu-trigger')
  const sidebar = document.getElementById('mobile-sidebar')
  const overlay = document.getElementById('mobile-sidebar-overlay')
  const closeBtn = document.getElementById('mobile-sidebar-close')

  const openSidebar = () => {
    sidebar?.classList.remove('-translate-x-full')
    overlay?.classList.remove('hidden')
  }
  const closeSidebar = () => {
    sidebar?.classList.add('-translate-x-full')
    overlay?.classList.add('hidden')
  }

  trigger?.addEventListener('click', openSidebar)
  closeBtn?.addEventListener('click', closeSidebar)
  overlay?.addEventListener('click', closeSidebar)

  // 5. Modal targets
  document.querySelectorAll('[data-modal-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.modalTarget)?.classList.remove('hidden')
    })
  })
  document.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-backdrop')?.classList.add('hidden')
    })
  })
})