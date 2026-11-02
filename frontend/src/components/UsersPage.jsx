import React, { useEffect, useMemo, useState } from 'react'
import Modal, { ErrorBox, Notice, TableStatusRow, inputClass } from './Modal.jsx'
import { createUser, getUsers, tokenStorage, updateUser } from '../services/api.js'

const ROLES = ['Coordinator', 'Operator', 'Read-only']

export default function UsersPage() {
  const currentUser = tokenStorage.getUser()
  // El backend devuelve 403 a otros roles; la interfaz lo explica en lugar de fallar
  const isCoordinator = currentUser?.role === 'Coordinator'

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(isCoordinator)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState(null)

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await getUsers())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isCoordinator) loadUsers()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (statusFilter && String(u.is_active) !== statusFilter) return false
      if (!term) return true
      return [u.full_name, u.email, u.username].some((v) => v.toLowerCase().includes(term))
    })
  }, [users, search, roleFilter, statusFilter])

  if (!isCoordinator) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
        <i className="bi bi-lock mr-2"></i>La gestión de usuarios está disponible solo para el rol Coordinator.
      </div>
    )
  }

  const handleSaved = (saved, isEdit) => {
    setUsers((list) => (isEdit ? list.map((u) => (u.id === saved.id ? saved : u)) : [...list, saved]))
    setEditing(null)
    setNotice(isEdit ? `Usuario ${saved.full_name} actualizado.` : `Usuario ${saved.full_name} creado.`)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-medium">Usuarios del sistema</h2>
        <button
          onClick={() => setEditing({ user: null })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm px-4 py-2 hover:opacity-90 transition"
        >
          <i className="bi bi-person-plus"></i>Nuevo usuario
        </button>
      </div>

      <Notice message={notice} onClose={() => setNotice(null)} />

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre, usuario o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg bg-input-background border border-border px-3 py-2 text-sm md:col-span-2"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg bg-input-background border border-border px-3 py-2 text-sm">
            <option value="">Todos los roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg bg-input-background border border-border px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Nombre</th>
                <th className="text-left font-medium px-4 py-2">Usuario</th>
                <th className="text-left font-medium px-4 py-2">Correo</th>
                <th className="text-left font-medium px-4 py-2">Rol</th>
                <th className="text-left font-medium px-4 py-2">Estado</th>
                <th className="text-right font-medium px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <TableStatusRow
                colSpan="6" loading={loading} error={error} onRetry={loadUsers}
                empty={filtered.length === 0} emptyText="No hay usuarios con los filtros seleccionados."
              />
              {!loading && !error && filtered.map((u) => (
                <tr key={u.id} className={u.is_active ? 'hover:bg-accent/30' : 'opacity-60 hover:bg-accent/30'}>
                  <td className="px-4 py-3 font-medium">
                    {u.full_name}
                    {u.id === currentUser.id && <span className="ml-2 text-xs text-muted-foreground">(usted)</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3"><span className="inline-flex rounded-full bg-muted text-xs px-2 py-0.5">{u.role}</span></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full text-xs px-2 py-0.5 ${u.is_active ? 'bg-chart-2/20' : 'bg-muted text-muted-foreground'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing({ user: u })} className="text-muted-foreground hover:text-foreground p-1" title="Editar usuario">
                      <i className="bi bi-pencil"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Mostrando {filtered.length} de {users.length} usuarios
          </div>
        )}
      </div>

      {editing && (
        <UserFormModal
          user={editing.user}
          isSelf={editing.user?.id === currentUser.id}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

function UserFormModal({ user, isSelf, onClose, onSaved }) {
  const isEdit = Boolean(user)
  const [form, setForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'Operator',
    is_active: user ? user.is_active : true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim() || (!isEdit && !form.username.trim())) {
      return setError('Complete todos los campos obligatorios.')
    }
    if (!isEdit && form.password.length < 8) {
      return setError('La contraseña inicial debe tener al menos 8 caracteres.')
    }

    setSaving(true)
    setError(null)
    try {
      const common = { full_name: form.full_name.trim(), email: form.email.trim(), role: form.role, is_active: form.is_active }
      const saved = isEdit
        ? await updateUser(user.id, common)
        : await createUser({ ...common, username: form.username.trim(), password: form.password })
      onSaved(saved, isEdit)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title={isEdit ? `Editar usuario ${user.username}` : 'Nuevo usuario'}
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar usuario'}
            </button>
          </>
        }
      >
        <div>
          <label className="text-sm font-medium block mb-1.5">Nombre completo *</label>
          <input type="text" maxLength={100} value={form.full_name} onChange={set('full_name')} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Usuario *</label>
            <input type="text" maxLength={50} value={form.username} onChange={set('username')} disabled={isEdit} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Correo electrónico *</label>
            <input type="email" maxLength={100} value={form.email} onChange={set('email')} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isEdit && (
            <div>
              <label className="text-sm font-medium block mb-1.5">Contraseña inicial *</label>
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={form.password} onChange={set('password')} className={inputClass} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1.5">Rol</label>
            <select value={form.role} onChange={set('role')} disabled={isSelf} className={inputClass}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        {!isEdit && <p className="text-xs text-muted-foreground">Se guardará cifrada (hash Argon2id), nunca en texto plano.</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} disabled={isSelf} className="rounded border-border" />
          Usuario activo
        </label>
        {isSelf && (
          <p className="text-xs text-muted-foreground">No puede cambiar su propio rol ni desactivarse.</p>
        )}
        {isEdit && !isSelf && user.is_active && !form.is_active && (
          <ErrorBox message="Al desactivarlo se cerrarán sus sesiones persistentes y no podrá iniciar sesión." />
        )}
        <ErrorBox message={error} />
      </Modal>
    </form>
  )
}
