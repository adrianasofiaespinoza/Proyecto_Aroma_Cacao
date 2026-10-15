import './style.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

document.addEventListener('DOMContentLoaded', () => {
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