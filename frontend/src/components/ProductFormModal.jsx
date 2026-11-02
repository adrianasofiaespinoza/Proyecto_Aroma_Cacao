import React, { useState } from 'react'
import Modal, { ErrorBox, inputClass } from './Modal.jsx'
import { createProduct, updateProduct } from '../services/api.js'

const emptyForm = {
  internal_code: '',
  name: '',
  brand: '',
  model: '',
  part_number: '',
  current_stock: '0',
  minimum_stock: '0',
  maximum_stock: '',
  physical_location: '',
  category_id: '',
  unit_of_measure_id: '',
}

function toForm(product) {
  if (!product) return emptyForm
  const form = {}
  Object.keys(emptyForm).forEach((key) => {
    form[key] = product[key] == null ? '' : String(product[key])
  })
  return form
}

// Convierte el formulario al cuerpo esperado por ProductCreate / ProductUpdate
function toPayload(form, isEdit) {
  const optional = (value) => (value.trim() === '' ? null : value.trim())
  const payload = {
    internal_code: form.internal_code.trim(),
    name: form.name.trim(),
    brand: optional(form.brand),
    model: optional(form.model),
    part_number: optional(form.part_number),
    minimum_stock: form.minimum_stock || '0',
    maximum_stock: optional(form.maximum_stock),
    physical_location: optional(form.physical_location),
    category_id: Number(form.category_id),
    unit_of_measure_id: Number(form.unit_of_measure_id),
  }
  // current_stock solo se define al crear; después cambia mediante movimientos
  if (!isEdit) payload.current_stock = form.current_stock || '0'
  return payload
}

function validate(form) {
  if (!form.internal_code.trim()) return 'El código interno es obligatorio.'
  if (!form.name.trim()) return 'El nombre es obligatorio.'
  if (!form.category_id) return 'Seleccione una categoría.'
  if (!form.unit_of_measure_id) return 'Seleccione una unidad de medida.'
  if (form.maximum_stock !== '' && Number(form.maximum_stock) < Number(form.minimum_stock || 0)) {
    return 'El stock máximo no puede ser menor que el mínimo.'
  }
  return null
}

export default function ProductFormModal({ product, categories, units, onClose, onSaved }) {
  const isEdit = Boolean(product)
  const [form, setForm] = useState(() => toForm(product))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = toPayload(form, isEdit)
      const saved = isEdit ? await updateProduct(product.id, payload) : await createProduct(payload)
      onSaved(saved, isEdit)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title={isEdit ? `Editar producto ${product.internal_code}` : 'Nuevo producto'}
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar producto'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Código interno *</label>
            <input type="text" maxLength={30} placeholder="REP-045" value={form.internal_code} onChange={set('internal_code')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Categoría *</label>
            <select value={form.category_id} onChange={set('category_id')} className={inputClass}>
              <option value="">Seleccione...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Nombre *</label>
          <input type="text" maxLength={100} value={form.name} onChange={set('name')} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Marca</label>
            <input type="text" maxLength={50} value={form.brand} onChange={set('brand')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Modelo</label>
            <input type="text" maxLength={50} value={form.model} onChange={set('model')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">N.º de parte</label>
            <input type="text" maxLength={50} value={form.part_number} onChange={set('part_number')} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-sm font-medium block mb-1.5">Unidad *</label>
            <select value={form.unit_of_measure_id} onChange={set('unit_of_measure_id')} className={inputClass}>
              <option value="">...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.abbreviation} · {u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Stock actual</label>
            <input
              type="number" min="0" step="0.01"
              value={form.current_stock} onChange={set('current_stock')}
              disabled={isEdit}
              title={isEdit ? 'El stock solo cambia mediante movimientos autorizados' : undefined}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Mínimo</label>
            <input type="number" min="0" step="0.01" value={form.minimum_stock} onChange={set('minimum_stock')} className={inputClass} />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Máximo</label>
            <input type="number" min="0" step="0.01" value={form.maximum_stock} onChange={set('maximum_stock')} className={inputClass} />
          </div>
        </div>
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            El stock actual solo se modifica mediante movimientos de inventario autorizados.
          </p>
        )}
        <div>
          <label className="text-sm font-medium block mb-1.5">Ubicación física</label>
          <input type="text" maxLength={100} placeholder="Estante A-3" value={form.physical_location} onChange={set('physical_location')} className={inputClass} />
        </div>
        <ErrorBox message={error} />
      </Modal>
    </form>
  )
}
