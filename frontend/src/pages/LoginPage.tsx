import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../app/AuthProvider'
import { useTheme } from '../app/ThemeProvider'
import { Button, Checkbox, Field, IconButton, Notice, TextInput } from '../components/ui'
import { describeError, isApiError } from '../lib/errors'
import { APP_NAME, APP_VERSION } from '../config/tenant'

export function LoginPage() {
  const { user, login } = useAuth()
  const { tenant } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ title: string; message: string; code?: string; credentials: boolean } | null>(null)

  if (user) return <Navigate to="/" replace />
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login({ email: email.trim(), password, remember_me: remember })
      navigate(from, { replace: true })
    } catch (err) {
      const d = describeError(err)
      const credentials = isApiError(err) && (err.code === 'CREDENCIALES' || err.status === 401)
      setError({ ...d, credentials })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lg">
      <form className="lg-form" onSubmit={submit} noValidate>
        <div className="lg-brand">
          <span className="lg-co">{tenant.shortName}</span>
          <span className="lg-prod">Bodega de mantenimiento</span>
        </div>
        <div className="lg-panel">
          <h1>Iniciar sesión</h1>
          <p className="lg-sub">Usa el correo que te asignó el coordinador de mantenimiento.</p>
          {error && (
            <Notice tone="danger" title={error.credentials ? 'Correo o contraseña incorrectos' : error.title} code={error.credentials ? undefined : error.code}>
              {error.credentials ? 'Revisa los datos e inténtalo de nuevo.' : error.message}
            </Notice>
          )}
          <Field label="Correo" htmlFor="email">
            <TextInput id="email" icon="envelope" type="email" autoComplete="username" placeholder="nombre@empresa.ec" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Field label="Contraseña" htmlFor="password" error={error?.credentials ? 'La contraseña no coincide con este correo.' : undefined}>
            <div className="lg-pw">
              <TextInput id="password" icon="lock" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <IconButton icon={showPw ? 'eye-slash' : 'eye'} label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPw ? 'true' : 'false'} onClick={() => setShowPw((s) => !s)} />
            </div>
          </Field>
          <Checkbox label="Recordarme en este equipo" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Button variant="primary" size="xl" block icon="box-arrow-in-right" type="submit" loading={busy} disabled={!email || !password}>Entrar</Button>
          <p className="lg-help">¿Olvidaste la contraseña? Pídele al coordinador que la restablezca.</p>
        </div>
        <span className="lg-foot">{APP_NAME} {APP_VERSION} · {tenant.name}</span>
      </form>
    </div>
  )
}
