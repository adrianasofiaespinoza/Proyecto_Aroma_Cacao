import { useState, type FormEvent } from 'react'
import { useSaveSupplier } from '../../api/hooks'
import type { Supplier } from '../../api/types'
import { Button, Field, Modal, Notice, TextInput, useToast } from '../../components/ui'
import { describeError } from '../../lib/errors'

export function SupplierFormModal({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved?: (s: Supplier) => void }) {
  const toast = useToast()
  const save = useSaveSupplier()
  const [f, setF] = useState({ company_name: supplier?.company_name ?? '', ruc: supplier?.ruc ?? '', contact_person: supplier?.contact_person ?? '', phone: supplier?.phone ?? '', address: supplier?.address ?? '', email: supplier?.email ?? '' })
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }))
  const emailBad = f.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!f.company_name.trim() || emailBad) return
    try {
      const saved = await save.mutateAsync({ id: supplier?.id ?? null, input: { company_name: f.company_name.trim(), ruc: f.ruc.trim() || null, contact_person: f.contact_person.trim() || null, phone: f.phone.trim() || null, address: f.address.trim() || null, email: f.email.trim() || null } })
      toast.ok(<><b>{supplier ? 'Proveedor actualizado.' : 'Proveedor creado.'}</b> {saved.company_name}</>)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const d = describeError(err)
      setError(`${d.title}. ${d.message}`)
    }
  }
  return (
    <Modal title={supplier ? `Editar ${supplier.company_name}` : 'Nuevo proveedor'} icon="building" onClose={onClose} footer={<><Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button><Button variant="primary" size="lg" icon="check-lg" form="supplier-form" type="submit" loading={save.isPending}>{supplier ? 'Guardar' : 'Crear proveedor'}</Button></>}>
      <form id="supplier-form" onSubmit={submit} noValidate className="bd-form-grid">
        {error && <div className="bd-span"><Notice tone="danger">{error}</Notice></div>}
        <Field label="Empresa" htmlFor="s-name" required className="bd-span" error={tried && !f.company_name.trim() ? 'Escribe el nombre de la empresa.' : undefined}><TextInput id="s-name" value={f.company_name} onChange={(e) => set('company_name', e.target.value)} maxLength={100} autoFocus /></Field>
        <Field label="RUC" htmlFor="s-ruc" optional><TextInput id="s-ruc" className="bd-mono" inputMode="numeric" value={f.ruc} onChange={(e) => set('ruc', e.target.value)} maxLength={20} /></Field>
        <Field label="Contacto" htmlFor="s-contact" optional><TextInput id="s-contact" value={f.contact_person} onChange={(e) => set('contact_person', e.target.value)} maxLength={100} /></Field>
        <Field label="Teléfono" htmlFor="s-phone" optional><TextInput id="s-phone" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={20} /></Field>
        <Field label="Correo" htmlFor="s-email" optional error={tried && emailBad ? 'Escribe un correo válido.' : undefined}><TextInput id="s-email" type="email" icon="envelope" value={f.email} onChange={(e) => set('email', e.target.value)} maxLength={100} /></Field>
        <Field label="Dirección" htmlFor="s-addr" optional className="bd-span"><TextInput id="s-addr" value={f.address} onChange={(e) => set('address', e.target.value)} maxLength={150} /></Field>
      </form>
    </Modal>
  )
}
