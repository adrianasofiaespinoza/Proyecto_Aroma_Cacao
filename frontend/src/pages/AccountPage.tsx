import { useState, type FormEvent } from 'react'
import * as api from '../api/endpoints'
import { useSessionUser } from '../app/AuthProvider'
import { Button, Field, Notice, PageHeader, Panel, TextInput, useToast } from '../components/ui'
import { describeError } from '../lib/errors'
import { ROLES } from '../lib/permissions'

const MIN_PASSWORD = 8

/** Mi cuenta: datos de la sesión y cambio de contraseña propio (todos los roles). */
export function AccountPage() {
  const user = useSessionUser()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<{ title: string; message: string; code?: string } | null>(null)

  const errors = {
    current: !current ? 'Escribe tu contraseña actual.' : undefined,
    next: next.length < MIN_PASSWORD ? `Debe tener al menos ${MIN_PASSWORD} caracteres.` : next === current ? 'Debe ser distinta de la actual.' : undefined,
    confirm: confirm !== next ? 'No coincide con la contraseña nueva.' : undefined,
  }
  const valid = !errors.current && !errors.next && !errors.confirm

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!valid) return
    setBusy(true)
    try {
      await api.changePassword({ current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setTouched(false)
      toast.ok(<><b>Contraseña actualizada.</b> Se cerraron tus sesiones en otros equipos.</>)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={`${user.name} · ${ROLES[user.role].label}`} />
      <Panel title="Cambiar contraseña" icon="lock">
        <form className="bd-stack" onSubmit={submit} noValidate>
          <p className="bd-muted" style={{ margin: 0 }}>
            Al cambiarla se cierran tus sesiones en otros equipos. En este sigues conectado.
          </p>
          {error && <Notice tone="danger" title={error.title} code={error.code}>{error.message}</Notice>}
          <div className="bd-form-grid">
            <Field label="Contraseña actual" htmlFor="pw-current" required error={touched ? errors.current : undefined}>
              <TextInput id="pw-current" type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label="Contraseña nueva" htmlFor="pw-new" required hint={`Al menos ${MIN_PASSWORD} caracteres.`} error={touched ? errors.next : undefined}>
              <TextInput id="pw-new" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <Field label="Repite la contraseña nueva" htmlFor="pw-confirm" required error={touched ? errors.confirm : undefined}>
              <TextInput id="pw-confirm" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </div>
          <div className="bd-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <Button variant="ghost" icon={show ? 'eye-slash' : 'eye'} onClick={() => setShow((s) => !s)}>{show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Button>
            <Button variant="primary" icon="check-lg" type="submit" loading={busy}>Cambiar contraseña</Button>
          </div>
        </form>
      </Panel>
    </>
  )
}
