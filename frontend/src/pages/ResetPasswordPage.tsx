import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import * as api from '../api/endpoints'
import { useTheme } from '../app/ThemeProvider'
import { Button, Field, LoadingRows, Notice, TextInput, useToast } from '../components/ui'
import { describeError } from '../lib/errors'

const MIN_PASSWORD = 8

type LinkState = { status: 'checking' } | { status: 'valid'; name: string; email: string } | { status: 'invalid'; title: string; message: string }

/**
 * /restablecer?token=…: la persona elige su contraseña con el enlace de un solo uso que le dio el coordinador.
 * No necesita sesión. El coordinador nunca conoce la contraseña elegida.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { tenant } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [link, setLink] = useState<LinkState>({ status: 'checking' })
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ title: string; message: string } | null>(null)

  useEffect(() => {
    if (!token) {
      setLink({ status: 'invalid', title: 'Falta el enlace', message: 'Abre el enlace completo que te dio el coordinador.' })
      return
    }
    let cancelled = false
    api
      .checkPasswordReset(token)
      .then((info) => !cancelled && setLink({ status: 'valid', name: info.full_name, email: info.email }))
      .catch((err) => {
        if (cancelled) return
        const d = describeError(err)
        setLink({ status: 'invalid', title: d.title, message: d.message })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const errors = {
    next: next.length < MIN_PASSWORD ? `Debe tener al menos ${MIN_PASSWORD} caracteres.` : undefined,
    confirm: confirm !== next ? 'No coincide con la contraseña nueva.' : undefined,
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (errors.next || errors.confirm) return
    setBusy(true)
    try {
      await api.completePasswordReset(token, next)
      toast.ok(<><b>Contraseña guardada.</b> Ya puedes iniciar sesión con ella.</>)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <div className="lg">
      <form className="lg-form" onSubmit={submit} noValidate>
        <div className="lg-brand">
          {tenant.logoSrc ? <img className="lg-logo" src={tenant.logoSrc} alt={tenant.name} /> : <span className="lg-co">{tenant.shortName}</span>}
        </div>
        <div className="lg-panel">
          <h1>Nueva contraseña</h1>
          {link.status === 'checking' && <LoadingRows rows={2} label="Comprobando el enlace…" />}
          {link.status === 'invalid' && (
            <>
              <Notice tone="danger" title={link.title}>{link.message}</Notice>
              <Button variant="secondary" icon="box-arrow-in-right" onClick={() => navigate('/login')}>Ir a iniciar sesión</Button>
            </>
          )}
          {link.status === 'valid' && (
            <>
              <p className="lg-sub">Para <b>{link.name}</b> ({link.email}). Elige una contraseña que solo tú conozcas. El enlace sirve una sola vez.</p>
              {error && <Notice tone="danger" title={error.title}>{error.message}</Notice>}
              <Field label="Contraseña nueva" htmlFor="rp-new" required hint={`Al menos ${MIN_PASSWORD} caracteres.`} error={touched ? errors.next : undefined}>
                <TextInput id="rp-new" icon="lock" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} autoFocus />
              </Field>
              <Field label="Repite la contraseña" htmlFor="rp-confirm" required error={touched ? errors.confirm : undefined}>
                <TextInput id="rp-confirm" icon="lock" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              <Button variant="ghost" icon={show ? 'eye-slash' : 'eye'} onClick={() => setShow((s) => !s)}>{show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Button>
              <Button variant="primary" size="xl" block icon="check-lg" type="submit" loading={busy}>Guardar contraseña</Button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
