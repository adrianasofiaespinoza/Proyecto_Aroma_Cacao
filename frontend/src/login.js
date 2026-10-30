import './style.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { login, tokenStorage } from './services/api.js'

document.addEventListener('DOMContentLoaded', () => {
  // If already authenticated, redirect to dashboard
  if (tokenStorage.isAuthenticated()) {
    window.location.href = 'dashboard.html'
    return
  }

  const form = document.getElementById('login-form')
  const emailInput = document.getElementById('email')
  const passwordInput = document.getElementById('password')
  const rememberMeInput = document.getElementById('remember-me')
  const errorContainer = document.getElementById('login-error')
  const submitButton = document.getElementById('login-submit')

  if (!form) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const email = emailInput?.value.trim()
    const password = passwordInput?.value
    const remember_me = Boolean(rememberMeInput?.checked)

    if (!email || !password) {
      showError('Por favor complete todos los campos.')
      return
    }

    setLoading(true)
    hideError()

    try {
      await login({ email, password, remember_me })
      window.location.href = 'dashboard.html'
    } catch (err) {
      showError(err.message || 'Error al iniciar sesión. Verifique sus credenciales.')
      setLoading(false)
    }
  })

  function showError(msg) {
    if (errorContainer) {
      errorContainer.textContent = msg
      errorContainer.classList.remove('hidden')
    }
  }

  function hideError() {
    if (errorContainer) {
      errorContainer.classList.add('hidden')
      errorContainer.textContent = ''
    }
  }

  function setLoading(loading) {
    if (!submitButton) return
    if (loading) {
      submitButton.disabled = true
      submitButton.innerHTML = '<i class="bi bi-arrow-repeat animate-spin mr-2"></i>Iniciando sesión...'
    } else {
      submitButton.disabled = false
      submitButton.innerHTML = 'Ingresar'
    }
  }
})
