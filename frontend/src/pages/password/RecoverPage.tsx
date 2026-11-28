import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import * as api from '../../api/endpoints'
import { useTheme } from '../../app/ThemeProvider'
import { Button, Field, Notice, TextInput, useToast } from '../../components/ui'
import { describeError } from '../../lib/errors'
import { RecoveryCodeView } from './RecoveryCode'

const MIN_PASSWORD = 8

/**
 * /recuperar: «¿Olvidaste la contraseña?». La persona elige una nueva con su correo y su
 * código de recuperación, sin depender del coordinador (decisión de la usuaria, 2026-11-27).
 */
export function RecoverPage() {
  const { tenant } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ title: string; message: string; code?: string } | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)

  const errors = {
    email: !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Escribe tu correo.' : undefined,
    code: code.replace(/[^a-z0-9]/gi, '').length < 12 ? 'El código tiene 12 letras y números, por ejemplo ABCD-EFGH-JKMN.' : undefined,
    next: next.length < MIN_PASSWORD ? `Debe tener al menos ${MIN_PASSWORD} caracteres.` : undefined,
    confirm: confirm !== next ? 'No coincide con la contraseña nueva.' : undefined,
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (Object.values(errors).some(Boolean)) return
    setBusy(true)
    try {
      setNewCode(await api.recoverPassword({ email: email.trim(), recovery_code: code.trim(), new_password: next }))
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
          {newCode ? (
            <>
              <h1>Contraseña cambiada</h1>
              <p className="lg-sub">Ya puedes entrar con tu contraseña nueva. Tu código anterior dejó de servir: este es el nuevo.</p>
              <RecoveryCodeView
                code={newCode}
                doneLabel="Ir a iniciar sesión"
                onDone={() => {
                  toast.ok(<><b>Listo.</b> Entra con tu contraseña nueva.</>)
                  navigate('/login', { replace: true })
                }}
              />
            </>
          ) : (
            <>
              <h1>Recuperar contraseña</h1>
              <p className="lg-sub">Usa el código de recuperación que guardaste al elegir tu contraseña.</p>
              {error && <Notice tone="danger" title={error.title} code={error.code}>{error.message}</Notice>}
              <Field label="Correo" htmlFor="rc-email" required error={touched ? errors.email : undefined}>
                <TextInput id="rc-email" icon="envelope" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </Field>
              <Field
                label="Código de recuperación"
                htmlFor="rc-code"
                required
                info="Te lo mostró el sistema cuando elegiste tu contraseña. Tiene 12 letras y números en 3 grupos. Da igual si lo escribes en mayúsculas o minúsculas, con o sin guiones."
                error={touched ? errors.code : undefined}
              >
                <TextInput id="rc-code" icon="lock" className="bd-mono" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} placeholder="ABCD-EFGH-JKMN" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
              </Field>
              <Field label="Contraseña nueva" htmlFor="rc-new" required hint={`Al menos ${MIN_PASSWORD} caracteres.`} error={touched ? errors.next : undefined}>
                <TextInput id="rc-new" icon="lock" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
              </Field>
              <Field label="Repite la contraseña" htmlFor="rc-confirm" required error={touched ? errors.confirm : undefined}>
                <TextInput id="rc-confirm" icon="lock" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
              <Button variant="ghost" icon={show ? 'eye-slash' : 'eye'} onClick={() => setShow((s) => !s)}>{show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Button>
              <Button variant="primary" size="xl" block icon="check-lg" type="submit" loading={busy}>Cambiar contraseña</Button>
              <p className="lg-help">¿No tienes el código? Pídele al coordinador que resetee tu contraseña.</p>
              <Button variant="ghost" icon="chevron-left" onClick={() => navigate('/login')}>Volver a iniciar sesión</Button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
