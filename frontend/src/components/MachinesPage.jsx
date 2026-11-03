import React, { useEffect, useMemo, useState } from 'react'
import Modal, { ErrorBox, Notice, inputClass } from './Modal.jsx'
import {
  addMachineProduct,
  getMachines,
  getProducts,
  removeMachineProduct,
  saveMachine,
  tokenStorage,
} from '../services/api.js'

export default function MachinesPage() {
  // La interfaz solo oculta acciones; el backend exige Coordinator igualmente
  const canManage = tokenStorage.getUser()?.role === 'Coordinator'

  const [machines, setMachines] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [partsOf, setPartsOf] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [machineData, productData] = await Promise.all([getMachines(), getProducts()])
      setMachines(machineData)
      setProducts(productData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return machines
    return machines.filter((m) =>
      [m.name, m.identification_code, m.location].filter(Boolean).some((v) => v.toLowerCase().includes(term)),
    )
  }, [machines, search])

  const replaceMachine = (saved) =>
    setMachines((list) => {
      const exists = list.some((m) => m.id === saved.id)
      return exists ? list.map((m) => (m.id === saved.id ? saved : m)) : [...list, saved]
    })

  const handleSaved = (saved, isEdit) => {
    replaceMachine(saved)
    setEditing(null)
    setNotice(isEdit ? `Máquina ${saved.name} actualizada.` : `Máquina ${saved.name} registrada.`)
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-medium">Máquinas de planta</h2>
        {canManage && (
          <button
            onClick={() => setEditing({ machine: null })}
            disabled={loading || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm px-4 py-2 hover:opacity-90 transition disabled:opacity-60"
          >
            <i className="bi bi-plus-lg"></i>Nueva máquina
          </button>
        )}
      </div>

      <Notice message={notice} onClose={() => setNotice(null)} />

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, código o ubicación"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg bg-input-background border border-border px-3 py-2 text-sm"
        />
      </div>

      {loading && (
        <p className="text-center text-muted-foreground py-8"><i className="bi bi-arrow-repeat animate-spin mr-2"></i>Cargando máquinas...</p>
      )}
      {!loading && error && (
        <div className="text-center text-destructive py-6">
          <p>{error}</p>
          <button onClick={loadData} className="text-xs underline text-primary hover:opacity-80 mt-2">Reintentar</button>
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-6">
          {machines.length === 0 ? 'Todavía no hay máquinas registradas.' : 'No hay máquinas que coincidan con la búsqueda.'}
        </p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium">{m.name}</h3>
                {canManage && (
                  <button onClick={() => setEditing({ machine: m })} className="text-muted-foreground hover:text-foreground" title="Editar máquina">
                    <i className="bi bi-pencil"></i>
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mb-1">Código: {m.identification_code}</p>
              <p className="text-sm text-muted-foreground mb-4">
                <i className="bi bi-geo-alt mr-1"></i>{m.location || 'Sin ubicación'}
              </p>
              <button
                onClick={() => setPartsOf(m.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-border text-sm px-3 py-1.5 hover:bg-accent"
              >
                <i className="bi bi-gear"></i>Repuestos compatibles ({m.product_ids.length})
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <MachineFormModal machine={editing.machine} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}

      {partsOf && (
        <CompatiblePartsModal
          machine={machines.find((m) => m.id === partsOf)}
          products={products}
          canManage={canManage}
          onClose={() => setPartsOf(null)}
          onChanged={replaceMachine}
        />
      )}
    </>
  )
}

function MachineFormModal({ machine, onClose, onSaved }) {
  const isEdit = Boolean(machine)
  const [form, setForm] = useState({
    name: machine?.name || '',
    identification_code: machine?.identification_code || '',
    location: machine?.location || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.identification_code.trim()) {
      return setError('El nombre y el código son obligatorios.')
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await saveMachine(machine?.id, {
        name: form.name.trim(),
        identification_code: form.identification_code.trim(),
        location: form.location.trim() || null,
      })
      onSaved(saved, isEdit)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title={isEdit ? `Editar ${machine.name}` : 'Nueva máquina'}
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar máquina'}
            </button>
          </>
        }
      >
        <div>
          <label className="text-sm font-medium block mb-1.5">Nombre *</label>
          <input type="text" maxLength={100} placeholder="Ej. Molino M-1" value={form.name} onChange={set('name')} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Código *</label>
            <input type="text" maxLength={30} placeholder="MAQ-004" value={form.identification_code} onChange={set('identification_code')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Ubicación</label>
            <input type="text" maxLength={100} placeholder="Planta de procesamiento, nivel 1" value={form.location} onChange={set('location')} className={inputClass} />
          </div>
        </div>
        <ErrorBox message={error} />
      </Modal>
    </form>
  )
}

function CompatiblePartsModal({ machine, products, canManage, onClose, onChanged }) {
  const [selected, setSelected] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(null)

  const linked = products.filter((p) => machine.product_ids.includes(p.id))
  const available = products.filter((p) => p.status === 'active' && !machine.product_ids.includes(p.id))

  const run = async (action) => {
    setWorking(true)
    setError(null)
    try {
      onChanged(await action())
      setSelected('')
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      title={`Repuestos compatibles con ${machine.name}`}
      onClose={onClose}
      size="max-w-xl"
      footer={<button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cerrar</button>}
    >
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Código</th>
              <th className="text-left font-medium px-3 py-2">Repuesto</th>
              <th className="text-right font-medium px-3 py-2">Stock</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linked.length === 0 && (
              <tr><td colSpan="4" className="px-3 py-4 text-center text-muted-foreground">Sin repuestos asociados.</td></tr>
            )}
            {linked.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-mono text-xs">{p.internal_code}</td>
                <td className="px-3 py-2">{p.name}{p.status !== 'active' && <span className="text-xs text-muted-foreground"> (inactivo)</span>}</td>
                <td className="px-3 py-2 text-right">{p.current_stock}</td>
                {canManage && (
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={working}
                      onClick={() => run(() => removeMachineProduct(machine.id, p.id))}
                      className="text-muted-foreground hover:text-destructive"
                      title="Quitar asociación"
                    >
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div>
          <label className="text-sm font-medium block mb-1.5">Asociar repuesto compatible</label>
          <div className="flex gap-2">
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className={inputClass}>
              <option value="">Seleccione un producto...</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>{p.internal_code} · {p.name}</option>
              ))}
            </select>
            <button
              disabled={!selected || working}
              onClick={() => run(() => addMachineProduct(machine.id, Number(selected)))}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60 shrink-0"
            >
              Asociar
            </button>
          </div>
        </div>
      )}
      <ErrorBox message={error} />
    </Modal>
  )
}
