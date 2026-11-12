import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onSessionLost, tokenStorage } from '../api/client'
import * as api from '../api/endpoints'
import type { User } from '../api/types'
import { uiRole } from '../lib/domain'
import type { Role } from '../lib/permissions'

export interface SessionUser {
  id: number
  name: string
  email: string
  role: Role
  backendRole: User['role']
}

interface AuthContextValue {
  user: SessionUser | null
  /** true mientras se comprueba la sesión guardada al arrancar */
  checking: boolean
  login: (input: { email: string; password: string; remember_me: boolean }) => Promise<SessionUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toSession(u: User): SessionUser {
  return { id: u.id, name: u.full_name || u.username, email: u.email, role: uiRole(u.role), backendRole: u.role }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>(() => {
    const saved = tokenStorage.getUser()
    return saved && tokenStorage.isAuthenticated() ? toSession(saved) : null
  })
  const [checking, setChecking] = useState(() => tokenStorage.isAuthenticated())

  // Al arrancar con sesión guardada, se confirma contra el servidor (rol actual, cuenta activa).
  useEffect(() => {
    if (!tokenStorage.isAuthenticated()) return
    let cancelled = false
    api
      .getMe()
      .then((u) => {
        if (cancelled) return
        tokenStorage.setSession({ user: u })
        setUser(toSession(u))
      })
      .catch(() => {
        /* sin conexión o sesión inválida: apiFetch ya cerró la sesión si el refresh falló */
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      onSessionLost(() => {
        setUser(null)
        qc.clear()
      }),
    [qc],
  )

  const login = useCallback(
    async (input: { email: string; password: string; remember_me: boolean }) => {
      const u = toSession(await api.login(input))
      setUser(u)
      return u
    },
    [],
  )

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
    qc.clear()
  }, [qc])

  const value = useMemo(() => ({ user, checking, login, logout }), [user, checking, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

/** Usuario garantizado dentro de las rutas protegidas. */
export function useSessionUser(): SessionUser {
  const { user } = useAuth()
  if (!user) throw new Error('No hay sesión')
  return user
}
