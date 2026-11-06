import React, { useEffect, useState } from 'react'
import Modal, { ErrorBox, inputClass } from './Modal.jsx'
import { formatExpiration, isLotExpired } from './lotUtils.js'
import { createLot, getLots, tokenStorage, updateLot } from '../services/api.js'

const emptyForm = { lot_number: '', expiration_date: '' }

const toPayload = (form) => ({
  lot_number: form.lot_number.trim(),
  expiration_date: form.expiration_date || null,
})

export default function LotsModal({ product, onClose }) {
  const role = tokenStorage.getUser()?.role
  // La interfaz solo oculta acciones; el backend valida el rol igualmente
  const canCreate = role === 'Operator' || role === 'Coordinator'
  const canEdit = role === 'Coordinator'

  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    getLots()
      .then((all) => setLots(all.filter((lot) => lot.product_id === product.id)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [product.id])

  const set = (setter, key) => (e) => setter((f) => ({ ...f, [key]: e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.lot_number.trim()) return setError('Indique el número de lote.')
    setWorking(true)
    setError(null)
    try {
      const lot = await createLot(product.id, toPayload(form))
      setLots((list) => [...list, lot])
      setForm(emptyForm)
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editing.lot_number.trim()) return setError('Indique el número de lote.')
    setWorking(true)
    setError(null)
    try {
      const saved = await updateLot(editing.id, toPayload(editing))
      setLots((list) => list.map((lot) => (lot.id === saved.id ? saved : lot)))
      setEditing(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      title={`Lotes de ${product.internal_code} · ${product.name}`}
      onClose={onClose}
      size="max-w-2xl"
      footer={<button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cerrar</button>}
    >
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-accent/40 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Lote</th>
              <th className="text-left font-medium px-3 py-2">Vencimiento</th>
              <th className="text-right font-medium px-3 py-2">Cantidad</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan="4" className="px-3 py-4 text-center text-muted-foreground">Cargando lotes...</td></tr>
            )}
            {!loading && lots.length === 0 && (
              <tr><td colSpan="4" className="px-3 py-4 text-center text-muted-foreground">Todavía no hay lotes registrados.</td></tr>
            )}
            {lots.map((lot) => {
              const isEditing = editing?.id === lot.id
              const expired = isLotExpired(lot)
              return (
                <tr key={lot.id}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {isEditing ? (
                      <input type="text" maxLength={30} value={editing.lot_number} onChange={set(setEditing, 'lot_number')} className={inputClass} />
                    ) : lot.lot_number}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="date" value={editing.expiration_date} onChange={set(setEditing, 'expiration_date')} className={inputClass} />
                    ) : (
                      <span className={expired ? 'text-destructive font-medium' : ''}>
                        {formatExpiration(lot)}{expired && ' (vencido)'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{lot.remaining_quantity}</td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button disabled={working} onClick={handleSaveEdit} className="text-muted-foreground hover:text-foreground p-1" title="Guardar lote">
                            <i className="bi bi-check-lg"></i>
                          </button>
                          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground p-1" title="Cancelar">
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditing({ id: lot.id, lot_number: lot.lot_number, expiration_date: lot.expiration_date || '' })}
                          className="text-muted-foreground hover:text-foreground p-1"
                          title="Corregir lote"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        La cantidad de un lote solo cambia con movimientos autorizados. Un lote vencido no admite entradas ni salidas; para retirarlo, registre un ajuste a 0.
      </p>

      {canCreate && (
        <form onSubmit={handleCreate}>
          <label className="text-sm font-medium block mb-1.5">Registrar lote nuevo</label>
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <input type="text" maxLength={30} placeholder="Número de lote" value={form.lot_number} onChange={set(setForm, 'lot_number')} className={inputClass} />
            <input type="date" aria-label="Fecha de vencimiento" value={form.expiration_date} onChange={set(setForm, 'expiration_date')} className={inputClass} />
            <button type="submit" disabled={working} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60 shrink-0">
              Registrar
            </button>
          </div>
        </form>
      )}
      <ErrorBox message={error} />
    </Modal>
  )
}
