import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import * as api from '../api/endpoints'
import { useAuth, useSessionUser } from '../app/AuthProvider'
import { useTheme } from '../app/ThemeProvider'
import { Button, Field, Modal, Notice, PageHeader, Panel, TextInput, useToast } from '../components/ui'
import { describeError } from '../lib/errors'
import { RecoveryCodeView } from './password/RecoveryCode'

const MIN_PASSWORD = 8

/** Cambio de contraseña propio: pide la actual. Conserva esta sesión y cierra las demás. */
function ChangePasswordForm({ intro, submitLabel, onDone }: { intro: string; submitLabel: string; onDone: (recoveryCode: string | null) => Promise<void> | void }) {
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
      const res = await api.changePassword({ current_password: current, new_password: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      setTouched(false)
      await onDone(res.recovery_code ?? null)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <form className="bd-stack" onSubmit={submit} noValidate>
      <p className="bd-muted" style={{ margin: 0 }}>{intro}</p>
      {error && <Notice tone="danger" title={error.title} code={error.code}>{error.message}</Notice>}
      <div className="bd-form-grid">
        <Field label="Contraseña actual" htmlFor="pw-current" required info={intro.includes('entregaron') ? 'La contraseña con la que entraste hoy: la que te dio el coordinador o la temporal que te entregó al resetearla.' : undefined} error={touched ? errors.current : undefined}>
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
        <Button variant="primary" icon="check-lg" type="submit" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  )
}

/**
 * «Cambiar contraseña» para quien no tiene Configuración (operador y solo lectura).
 * El coordinador y soporte cambian la suya dentro de Configuración (decisión de la usuaria, 2026-11-25).
 */
export function AccountPage() {
  const user = useSessionUser()
  return (
    <>
      <PageHeader title="Cambiar contraseña" subtitle={user.name} />
      <PasswordPanel />
    </>
  )
}

/** Cambio de contraseña propio y código de recuperación. Lo usan AccountPage y Configuración. */
export function PasswordPanel() {
  const toast = useToast()
  const [code, setCode] = useState<string | null>(null)
  return (
    <>
      <Panel title="Cambiar contraseña" icon="lock">
        <ChangePasswordForm
          intro="Al cambiarla se cierran tus sesiones en otros equipos. En este sigues conectado."
          submitLabel="Cambiar contraseña"
          onDone={(recoveryCode) => {
            toast.ok(<><b>Contraseña actualizada.</b> Se cerraron tus sesiones en otros equipos.</>)
            // Quien todavía no tenía código de recuperación lo recibe ahora
            if (recoveryCode) setCode(recoveryCode)
          }}
        />
      </Panel>
      <RecoveryCodePanel />
      {code && (
        <Modal title="Tu código de recuperación" icon="lock" onClose={() => setCode(null)}>
          <RecoveryCodeView code={code} doneLabel="Listo" onDone={() => setCode(null)} />
        </Modal>
      )}
    </>
  )
}

/** Generar un código de recuperación nuevo (si se perdió o alguien más lo vio). */
function RecoveryCodePanel() {
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ title: string; message: string; code?: string } | null>(null)
  const [code, setCode] = useState<string | null>(null)

  const close = () => {
    setAsking(false)
    setPassword('')
    setError(null)
    setCode(null)
  }

  const generate = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      setCode((await api.newRecoveryCode(password)).recovery_code)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel title="Código de recuperación" icon="lock">
        <div className="bd-stack">
          <p className="bd-muted" style={{ margin: 0 }}>
            Con tu código de recuperación eliges una contraseña nueva desde el inicio de sesión si la olvidas, sin pedírsela al coordinador.
            Si lo perdiste o alguien más lo vio, genera uno nuevo: el anterior deja de servir.
          </p>
          <div><Button variant="secondary" icon="arrow-repeat" onClick={() => setAsking(true)}>Generar código nuevo</Button></div>
        </div>
      </Panel>
      {asking && (
        <Modal
          title={code ? 'Tu código de recuperación' : 'Generar código nuevo'}
          icon="lock"
          onClose={close}
          footer={code ? undefined : <><Button variant="secondary" size="lg" onClick={close}>Cancelar</Button><Button variant="primary" size="lg" icon="check-lg" type="submit" form="rc-new-form" loading={busy} disabled={!password}>Generar</Button></>}
        >
          {code ? (
            <RecoveryCodeView code={code} doneLabel="Listo" onDone={close} />
          ) : (
            <form id="rc-new-form" className="bd-stack" onSubmit={generate} noValidate>
              <p style={{ margin: 0 }}>Para confirmar que eres tú, escribe tu contraseña actual. Tu código anterior dejará de servir.</p>
              {error && <Notice tone="danger" title={error.title} code={error.code}>{error.message}</Notice>}
              <Field label="Contraseña actual" htmlFor="rc-current" required>
                <TextInput id="rc-current" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </Field>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}

/**
 * Primer ingreso (o tras un restablecimiento por consola): la contraseña la escribió otra persona,
 * así que antes de usar el sistema cada quien elige la suya. El backend responde 403 a todo lo demás.
 */
export function FirstPasswordPage() {
  const user = useSessionUser()
  const { logout, refreshUser } = useAuth()
  const { tenant } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [code, setCode] = useState<string | null>(null)
  const finish = async () => {
    await refreshUser()
    toast.ok(<><b>Listo.</b> Desde ahora solo tú conoces tu contraseña.</>)
    navigate('/', { replace: true })
  }
  return (
    <div className="lg">
      <div className="lg-form">
        <div className="lg-brand">
          {tenant.logoSrc ? <img className="lg-logo" src={tenant.logoSrc} alt={tenant.name} /> : <span className="lg-co">{tenant.shortName}</span>}
        </div>
        <div className="lg-panel">
          <h1>{code ? 'Contraseña guardada' : 'Elige tu contraseña'}</h1>
          {!code && (
            <Notice tone="info" title={`Hola, ${user.name}`}>
              Entraste con la contraseña que te dio el coordinador. Para que solo tú la conozcas, cámbiala antes de continuar.
            </Notice>
          )}
          {code ? (
            <RecoveryCodeView code={code} doneLabel="Entrar" onDone={() => void finish()} />
          ) : (
            <ChangePasswordForm
              intro="En «Contraseña actual» escribe la que te entregaron."
              submitLabel="Guardar y entrar"
              onDone={async (recoveryCode) => {
                // Primero se muestra su código de recuperación; refrescar la sesión desmonta esta pantalla
                if (recoveryCode) setCode(recoveryCode)
                else await finish()
              }}
            />
          )}
          <Button variant="ghost" icon="box-arrow-right" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>Cerrar sesión</Button>
        </div>
      </div>
    </div>
  )
}
