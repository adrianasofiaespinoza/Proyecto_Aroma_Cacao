import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useCreateUser, useUpdateUser, useUsers } from '../api/hooks'
import type { BackendRole, User } from '../api/types'
import { useSessionUser } from '../app/AuthProvider'
import { Button, ConfirmDialog, DataTable, Field, FilterBar, Icon, IconButton, Modal, Notice, PageHeader, Panel, SearchInput, Segmented, Select, StatusBadge, TextInput, useToast, type Column } from '../components/ui'
import { ROLE_TO_BACKEND, uiRole } from '../lib/domain'
import { describeError, isConnectionError } from '../lib/errors'
import { ROLES, type Role } from '../lib/permissions'

const RoleTag = ({ role }: { role: BackendRole }) => {
  const r = ROLES[uiRole(role)]
  return <span className="us-role"><Icon name={r.icon} />{r.label}</span>
}
const ROLE_OPTIONS = (['operador', 'coordinador', 'lectura'] as Role[]).map((r) => ({ value: r, label: ROLES[r].label }))
const ROLE_HINT: Record<Role, string> = {
  operador: 'Operador: pide entradas y salidas y registra préstamos. No autoriza.',
  coordinador: 'Coordinador: autoriza movimientos y administra productos, máquinas, proveedores y usuarios.',
  lectura: 'Solo lectura: consulta el inventario sin cambiar nada.',
}

interface FormState { username: string; full_name: string; email: string; password: string; role: Role }
const EMPTY: FormState = { username: '', full_name: '', email: '', password: '', role: 'operador' }

export function UsersPage() {
  const me = useSessionUser()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const users = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const q = params.get('q') ?? ''
  const rol = params.get('rol') ?? 'todos'
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'todos') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<User | null>(null)

  const open = (u: User | 'new') => {
    setEditing(u)
    setForm(u === 'new' ? EMPTY : { username: u.username, full_name: u.full_name, email: u.email, password: '', role: uiRole(u.role) })
    setTried(false)
    setError(null)
  }
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const emailBad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const isNew = editing === 'new'
  const errors = {
    username: tried && isNew && !/^[a-z0-9._-]{3,50}$/i.test(form.username.trim()) ? 'De 3 a 50 letras, números, punto, guion o guion bajo.' : undefined,
    name: tried && !form.full_name.trim() ? 'Escribe el nombre completo.' : undefined,
    email: tried && emailBad ? 'Escribe un correo válido.' : undefined,
    password: tried && isNew && form.password.length < 8 ? 'Mínimo 8 caracteres.' : undefined,
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    setError(null)
    if (!form.full_name.trim() || emailBad || (isNew && (form.password.length < 8 || !/^[a-z0-9._-]{3,50}$/i.test(form.username.trim())))) return
    try {
      if (isNew) {
        const u = await createUser.mutateAsync({ username: form.username.trim(), full_name: form.full_name.trim(), email: form.email.trim(), password: form.password, role: ROLE_TO_BACKEND[form.role], is_active: true })
        toast.ok(<><b>Usuario creado.</b> {u.full_name} ({ROLES[uiRole(u.role)].label}). Entrégale la contraseña en persona.</>)
      } else if (editing) {
        const u = await updateUser.mutateAsync({ id: editing.id, input: { full_name: form.full_name.trim(), email: form.email.trim(), role: ROLE_TO_BACKEND[form.role], is_active: editing.is_active } })
        toast.ok(<><b>Usuario actualizado.</b> {u.full_name}</>)
      }
      setEditing(null)
    } catch (err) {
      const d = describeError(err)
      setError(`${d.title}. ${d.message}`)
    }
  }
  const toggleActive = async (u: User) => {
    try {
      await updateUser.mutateAsync({ id: u.id, input: { full_name: u.full_name, email: u.email, role: u.role, is_active: !u.is_active } })
      toast.ok(u.is_active ? <><b>{u.full_name} desactivado.</b> Sus sesiones quedaron cerradas.</> : <><b>{u.full_name} reactivado.</b> Ya puede iniciar sesión.</>)
      setToggling(null)
    } catch (err) {
      setToggling(null)
      const d = describeError(err)
      toast.danger(<><b>{d.title}</b> {d.message}</>)
    }
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (users.data ?? [])
      .filter((u) => rol === 'todos' || uiRole(u.role) === rol)
      .filter((u) => !needle || `${u.username} ${u.full_name} ${u.email}`.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name))
  }, [users.data, q, rol])
  const inactive = (users.data ?? []).filter((u) => !u.is_active).length

  const cols: Column<User>[] = [
    { key: 'username', header: 'Usuario', mobile: 'subtitle', render: (u) => <span className="bd-mono">{u.username}</span> },
    { key: 'full_name', header: 'Nombre completo', mobile: 'title', render: (u) => <span className="bd-cell-title">{u.full_name}{u.id === me.id ? <span className="bd-cell-sub"> · tú</span> : ''}</span> },
    { key: 'email', header: 'Correo', mobile: 'wide' },
    { key: 'role', header: 'Rol', mobile: 'meta', render: (u) => <RoleTag role={u.role} /> },
    { key: 'active', header: 'Estado', mobile: 'badge', render: (u) => <StatusBadge status={u.is_active ? 'activo' : 'inactivo'} /> },
  ]
  const toggleBtn = (u: User, mobile: boolean) => {
    if (u.id === me.id) return null
    if (mobile) return u.is_active ? <Button variant="danger-outline" icon="power" onClick={() => setToggling(u)}>Desactivar</Button> : <Button variant="secondary" icon="arrow-counterclockwise" onClick={() => void toggleActive(u)}>Reactivar</Button>
    return u.is_active ? <IconButton icon="power" label={'Desactivar ' + u.full_name} onClick={() => setToggling(u)} /> : <IconButton icon="arrow-counterclockwise" label={'Reactivar ' + u.full_name} onClick={() => void toggleActive(u)} />
  }

  return (
    <>
      <PageHeader title="Usuarios" subtitle={users.isLoading ? 'Cargando…' : `${users.data?.length ?? 0} usuarios · ${inactive} ${inactive === 1 ? 'inactivo' : 'inactivos'}`} actions={<Button variant="primary" icon="plus-lg" onClick={() => open('new')}>Nuevo usuario</Button>} />
      <Panel flush>
        <FilterBar>
          <SearchInput placeholder="Buscar por nombre, usuario o correo" value={q} onChange={(e) => setParam('q', e.target.value)} />
          <Segmented label="Rol" value={rol} onChange={(v) => setParam('rol', v)} options={[{ value: 'todos', label: 'Todos' }, ...ROLE_OPTIONS]} />
        </FilterBar>
        <DataTable
          columns={cols}
          rows={rows}
          rowTone={(u) => (u.is_active ? null : 'muted')}
          caption="Usuarios"
          state={users.isLoading ? 'loading' : users.isError ? 'error' : 'ready'}
          onRetry={() => void users.refetch()}
          loadingLabel="Cargando usuarios…"
          empty={{ icon: 'people', title: q ? `Sin resultados para “${q}”` : 'No hay usuarios con ese rol' }}
          actions={(u) => <><IconButton icon="pencil" label={'Editar ' + u.full_name} onClick={() => open(u)} />{toggleBtn(u, false)}</>}
          mobileActions={(u) => <><Button variant="secondary" icon="pencil" onClick={() => open(u)}>Editar</Button>{toggleBtn(u, true)}</>}
        />
      </Panel>
      {users.isError && !isConnectionError(users.error) && <Notice tone="danger" title="No se pudo cargar la lista">{describeError(users.error).message}</Notice>}

      {editing && (
        <Modal
          title={isNew ? 'Nuevo usuario' : `Editar ${editing.full_name}`}
          icon="person-badge"
          onClose={() => setEditing(null)}
          footer={<><Button variant="secondary" size="lg" onClick={() => setEditing(null)}>Cancelar</Button><Button variant="primary" size="lg" icon="check-lg" form="user-form" type="submit" loading={createUser.isPending || updateUser.isPending}>{isNew ? 'Crear usuario' : 'Guardar'}</Button></>}
        >
          <form id="user-form" onSubmit={submit} noValidate className="bd-form-grid">
            {error && <div className="bd-span"><Notice tone="danger">{error}</Notice></div>}
            <Field label="Usuario" htmlFor="u-user" required error={errors.username} hint={isNew ? 'Corto y sin espacios, p. ej. lcedeno' : 'No se puede cambiar.'}>
              {isNew ? <TextInput id="u-user" className="bd-mono" value={form.username} onChange={(e) => set('username', e.target.value)} maxLength={50} autoFocus autoComplete="off" /> : <TextInput readOnlyValue={form.username} />}
            </Field>
            <Field label="Nombre completo" htmlFor="u-name" required error={errors.name}><TextInput id="u-name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} maxLength={100} /></Field>
            <Field label="Correo" htmlFor="u-email" required className="bd-span" error={errors.email}><TextInput id="u-email" type="email" icon="envelope" value={form.email} onChange={(e) => set('email', e.target.value)} maxLength={100} autoComplete="off" /></Field>
            {isNew && (
              <Field label="Contraseña inicial" htmlFor="u-pass" required className="bd-span" error={errors.password} hint="Mínimo 8 caracteres. Entrégasela en persona.">
                <TextInput id="u-pass" type="password" icon="lock" value={form.password} onChange={(e) => set('password', e.target.value)} maxLength={128} autoComplete="new-password" />
              </Field>
            )}
            <Field label="Rol" htmlFor="u-role" required className="bd-span" hint={ROLE_HINT[form.role]}>
              <Select id="u-role" value={form.role} onChange={(e) => set('role', e.target.value as Role)} options={ROLE_OPTIONS} disabled={!isNew && editing.id === me.id} />
            </Field>
          </form>
        </Modal>
      )}
      {toggling && (
        <ConfirmDialog
          tone="danger"
          icon="power"
          title={`¿Desactivar a ${toggling.full_name}?`}
          confirmLabel="Sí, desactivar"
          confirmIcon="power"
          loading={updateUser.isPending}
          onCancel={() => setToggling(null)}
          onConfirm={() => void toggleActive(toggling)}
          consequences={[['Usuario', `${toggling.username} · ${toggling.email}`], ['Rol', ROLES[uiRole(toggling.role)].label], ['Sesiones abiertas', 'Se cierran ahora']]}
        >
          <p style={{ margin: 0 }}>No podrá iniciar sesión. Su historial de solicitudes y préstamos se conserva, y puedes reactivarlo cuando quieras.</p>
        </ConfirmDialog>
      )}
    </>
  )
}
