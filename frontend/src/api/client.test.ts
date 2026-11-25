import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, migrateLegacyKeys, tokenStorage } from './client'

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('apiFetch() con varias pestañas', () => {
  it('no cierra la sesión si otra pestaña renovó primero con el mismo refresh token', async () => {
    tokenStorage.setSession({ access_token: 'viejo', refresh_token: 'refresh-viejo' })
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('Authorization')
      if (url === '/auth/refresh') {
        // Mientras tanto, la otra pestaña ya guardó la sesión nueva
        tokenStorage.setSession({ access_token: 'nuevo', refresh_token: 'refresh-nuevo' })
        return json(401, { detail: 'Refresh token revoked' })
      }
      return auth === 'Bearer nuevo' ? json(200, { ok: true }) : json(401, { detail: 'Invalid or expired access token' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await apiFetch('/products')
    expect(res.status).toBe(200)
    expect(tokenStorage.getAccessToken()).toBe('nuevo')
  })

  it('reintenta con el token que guardó otra pestaña sin pedir otra renovación', async () => {
    tokenStorage.setSession({ access_token: 'viejo', refresh_token: 'r' })
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('Authorization')
      if (auth === 'Bearer viejo') {
        tokenStorage.setSession({ access_token: 'nuevo' })
        return json(401)
      }
      return json(200)
    })
    vi.stubGlobal('fetch', fetchMock)

    expect((await apiFetch('/products')).status).toBe(200)
    expect(fetchMock.mock.calls.some(([url]) => url === '/auth/refresh')).toBe(false)
  })

  it('cierra la sesión si la renovación falla y nadie más renovó', async () => {
    tokenStorage.setSession({ access_token: 'viejo', refresh_token: 'refresh-viejo' })
    vi.stubGlobal('fetch', vi.fn(async () => json(401)))

    expect((await apiFetch('/products')).status).toBe(401)
    expect(tokenStorage.getAccessToken()).toBeNull()
  })
})

describe('claves de sesión sin el nombre de la empresa', () => {
  it('copia una vez la sesión guardada con las claves aroma_* y las borra', () => {
    localStorage.setItem('aroma_access_token', 'acceso')
    localStorage.setItem('aroma_refresh_token', 'renovar')
    localStorage.setItem('aroma_user', JSON.stringify({ id: 1 }))
    migrateLegacyKeys()
    expect(tokenStorage.getAccessToken()).toBe('acceso')
    expect(tokenStorage.getRefreshToken()).toBe('renovar')
    expect(tokenStorage.getUser()).toEqual({ id: 1 })
    expect(localStorage.getItem('aroma_access_token')).toBeNull()
  })

  it('no pisa una sesión nueva con una antigua', () => {
    tokenStorage.setSession({ access_token: 'nuevo' })
    localStorage.setItem('aroma_access_token', 'viejo')
    migrateLegacyKeys()
    expect(tokenStorage.getAccessToken()).toBe('nuevo')
    expect(localStorage.getItem('aroma_access_token')).toBeNull()
  })
})
