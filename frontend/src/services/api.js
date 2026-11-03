// ============================================================
// Aroma Cacao - API Client & Session Management
// ============================================================

const TOKEN_KEY = 'aroma_access_token'
const REFRESH_KEY = 'aroma_refresh_token'
const USER_KEY = 'aroma_user'

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  getUser: () => {
    try {
      const u = localStorage.getItem(USER_KEY)
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  },
  setSession: ({ access_token, refresh_token, user }) => {
    if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },
  isAuthenticated: () => Boolean(localStorage.getItem(TOKEN_KEY)),
}

// FastAPI devuelve detail como texto (400/403/404/409) o como lista de
// errores de validación (422); se convierte siempre a un mensaje legible.
async function errorFromResponse(res, fallback) {
  const err = await res.json().catch(() => ({}))
  let message = fallback
  if (typeof err.detail === 'string') {
    message = err.detail
  } else if (Array.isArray(err.detail) && err.detail.length > 0) {
    message = err.detail
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((l) => l !== 'body').join('.') : ''
        const msg = (d.msg || '').replace(/^Value error, /, '')
        return field ? `${field}: ${msg}` : msg
      })
      .join(' · ')
  }
  const error = new Error(message)
  error.status = res.status
  return error
}

let isRefreshing = false
let refreshSubscribers = []

function onRefreshed(newAccessToken) {
  refreshSubscribers.forEach((callback) => callback(newAccessToken))
  refreshSubscribers = []
}

function addRefreshSubscriber(callback) {
  refreshSubscribers.push(callback)
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : endpoint
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  const token = tokenStorage.getAccessToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const config = {
    ...options,
    headers,
  }

  let response = await fetch(url, config)

  // Automatic token refresh on 401 Unauthorized
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshToken = tokenStorage.getRefreshToken()

    if (!refreshToken) {
      tokenStorage.clearSession()
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html'
      }
      return response
    }

    if (!isRefreshing) {
      isRefreshing = true

      try {
        const refreshRes = await fetch('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (!refreshRes.ok) {
          tokenStorage.clearSession()
          isRefreshing = false
          onRefreshed(null)
          if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html'
          }
          return response
        }

        const data = await refreshRes.json()
        tokenStorage.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })

        isRefreshing = false
        onRefreshed(data.access_token)

        // Retry the original failed request
        headers.set('Authorization', `Bearer ${data.access_token}`)
        return fetch(url, { ...options, headers })
      } catch (err) {
        tokenStorage.clearSession()
        isRefreshing = false
        onRefreshed(null)
        if (!window.location.pathname.endsWith('login.html')) {
          window.location.href = 'login.html'
        }
        throw err
      }
    }

    // Wait for the in-progress refresh to finish
    return new Promise((resolve) => {
      addRefreshSubscriber((newToken) => {
        if (!newToken) {
          resolve(response)
          return
        }
        headers.set('Authorization', `Bearer ${newToken}`)
        resolve(fetch(url, { ...options, headers }))
      })
    })
  }

  return response
}

// ------------------------------------------------------------
// Auth API Endpoints
// ------------------------------------------------------------

export async function login({ email, password, remember_me = false }) {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember_me }),
  })

  if (!res.ok) throw await errorFromResponse(res, 'Error al iniciar sesión')

  const tokenData = await res.json()

  tokenStorage.setSession({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  })

  // Fetch current user info
  try {
    const meRes = await apiFetch('/users/me')
    if (meRes.ok) {
      const user = await meRes.json()
      tokenStorage.setSession({ user })
    }
  } catch {
    // If /users/me fails, continue with tokens
  }

  return tokenData
}

export async function logout() {
  const refreshToken = tokenStorage.getRefreshToken()
  if (refreshToken) {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // Ignore network errors on logout
    }
  }
  tokenStorage.clearSession()
  window.location.href = 'login.html'
}

export async function getMe() {
  const res = await apiFetch('/users/me')
  if (!res.ok) throw new Error('No autenticado')
  const user = await res.json()
  tokenStorage.setSession({ user })
  return user
}

// ------------------------------------------------------------
// Products API Endpoints
// ------------------------------------------------------------

export async function getProducts() {
  const res = await apiFetch('/products')
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar productos')
  return res.json()
}

export async function createProduct(productData) {
  const res = await apiFetch('/products', {
    method: 'POST',
    body: JSON.stringify(productData),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al crear producto')
  return res.json()
}

export async function updateProduct(id, productData) {
  const res = await apiFetch(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al actualizar producto')
  return res.json()
}

export async function deactivateProduct(id) {
  const res = await apiFetch(`/products/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await errorFromResponse(res, 'Error al desactivar producto')
  return res.json()
}

// ------------------------------------------------------------
// Catalogs API Endpoints
// ------------------------------------------------------------

export async function getCategories() {
  const res = await apiFetch('/categories')
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar categorías')
  return res.json()
}

export async function getUnits() {
  const res = await apiFetch('/units')
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar unidades de medida')
  return res.json()
}

// ------------------------------------------------------------
// Movements API Endpoints
// ------------------------------------------------------------

export async function getMovements(params = {}) {
  const query = new URLSearchParams()
  if (params.status) query.append('status_filter', params.status)
  if (params.type) query.append('type_filter', params.type)

  const url = `/movements${query.toString() ? '?' + query.toString() : ''}`
  const res = await apiFetch(url)
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar movimientos')
  return res.json()
}

export async function authorizeMovement(movementId) {
  const res = await apiFetch(`/movements/${movementId}/authorize`, {
    method: 'PATCH',
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al autorizar movimiento')
  return res.json()
}

export async function createMovement(movementData) {
  const res = await apiFetch('/movements', {
    method: 'POST',
    body: JSON.stringify(movementData),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al registrar movimiento')
  return res.json()
}

export async function rejectMovement(movementId) {
  const res = await apiFetch(`/movements/${movementId}/reject`, {
    method: 'PATCH',
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al rechazar movimiento')
  return res.json()
}

// ------------------------------------------------------------
// Users API Endpoints (Coordinator)
// ------------------------------------------------------------

export async function getUsers() {
  const res = await apiFetch('/users')
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar usuarios')
  return res.json()
}

export async function createUser(userData) {
  const res = await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al crear usuario')
  return res.json()
}

export async function updateUser(id, userData) {
  const res = await apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al actualizar usuario')
  return res.json()
}

// ------------------------------------------------------------
// Machines API Endpoints
// ------------------------------------------------------------

export async function getMachines() {
  const res = await apiFetch('/machines')
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar máquinas')
  return res.json()
}

export async function saveMachine(id, machineData) {
  const res = await apiFetch(id ? `/machines/${id}` : '/machines', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(machineData),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al guardar máquina')
  return res.json()
}

export async function addMachineProduct(machineId, productId) {
  const res = await apiFetch(`/machines/${machineId}/products`, {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al asociar repuesto')
  return res.json()
}

export async function removeMachineProduct(machineId, productId) {
  const res = await apiFetch(`/machines/${machineId}/products/${productId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al quitar repuesto')
  return res.json()
}

// ------------------------------------------------------------
// Loans API Endpoints
// ------------------------------------------------------------

export async function getLoans() {
  const res = await apiFetch('/loans')
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar préstamos')
  return res.json()
}

export async function getWorkers() {
  const res = await apiFetch('/workers')
  if (!res.ok) throw await errorFromResponse(res, 'Error al cargar trabajadores')
  return res.json()
}

export async function createLoan(loanData) {
  const res = await apiFetch('/loans', {
    method: 'POST',
    body: JSON.stringify(loanData),
  })
  if (!res.ok) throw await errorFromResponse(res, 'Error al registrar préstamo')
  return res.json()
}

export async function returnLoan(loanId) {
  const res = await apiFetch(`/loans/${loanId}/return`, { method: 'PATCH' })
  if (!res.ok) throw await errorFromResponse(res, 'Error al registrar devolución')
  return res.json()
}
