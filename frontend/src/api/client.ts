/**
 * Cliente HTTP: agrega el Bearer token, renueva el access token ante un 401
 * (una sola renovación aunque haya varias peticiones en vuelo) y convierte
 * las respuestas de error en ApiError con mensajes de bodega.
 */
import { errorFromResponse, networkError } from '../lib/errors'
import type { User } from './types'

const TOKEN_KEY = 'aroma_access_token'
const REFRESH_KEY = 'aroma_refresh_token'
const USER_KEY = 'aroma_user'

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_KEY),
  getUser: (): User | null => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  },
  setSession: ({ access_token, refresh_token, user }: { access_token?: string; refresh_token?: string; user?: User }) => {
    if (access_token) localStorage.setItem(TOKEN_KEY, access_token)
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },
  isAuthenticated: (): boolean => Boolean(localStorage.getItem(TOKEN_KEY)),
}

type SessionListener = () => void
const sessionListeners = new Set<SessionListener>()
/** Avisa a la app cuando la sesión se cierra por un refresh fallido. */
export function onSessionLost(listener: SessionListener): () => void {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}
function sessionLost() {
  tokenStorage.clearSession()
  sessionListeners.forEach((l) => l())
}

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access_token: string; refresh_token: string }
    tokenStorage.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
    return data.access_token
  } catch {
    return null
  }
}

async function rawFetch(url: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers ?? {})
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  try {
    return await fetch(url, { ...init, headers })
  } catch {
    throw networkError()
  }
}

/** fetch con sesión. Devuelve la Response; lanza ApiError si no hay conexión. */
export async function apiFetch(endpoint: string, init: RequestInit = {}): Promise<Response> {
  let response = await rawFetch(endpoint, init, tokenStorage.getAccessToken())
  const isAuthCall = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/refresh')
  if (response.status !== 401 || isAuthCall) return response

  if (!refreshing) {
    refreshing = refreshAccessToken().finally(() => {
      refreshing = null
    })
  }
  const newToken = await refreshing
  if (!newToken) {
    sessionLost()
    return response
  }
  response = await rawFetch(endpoint, init, newToken)
  return response
}

/** Petición JSON tipada: lanza ApiError en cualquier estado que no sea 2xx. */
export async function request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(endpoint, init)
  if (!res.ok) throw await errorFromResponse(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })
