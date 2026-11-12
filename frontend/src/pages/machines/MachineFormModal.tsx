import { useState, type FormEvent } from 'react'
import { useSaveMachine } from '../../api/hooks'
import type { Machine } from '../../api/types'
import { Button, Field, Modal, Notice, TextInput, useToast } from '../../components/ui'
import { describeError } from '../../lib/errors'

export function MachineFormModal({ machine, onClose, onSaved }: { machine: Machine | null; onClose: () => void; onSaved?: (m: Machine) => void }) {
  const toast = useToast()
  const save = useSaveMachine()
  const [name, setName] = useState(machine?.name ?? '')
  const [code, setCode] = useState(machine?.identification_code ?? '')
  const [location, setLocation] = useState(machine?.location ?? '')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!name.trim() || !code.trim()) return
    try {
      const saved = await save.mutateAsync({ id: machine?.id ?? null, input: { name: name.trim(), identification_code: code.trim().toUpperCase(), location: location.trim() || null } })
      toast.ok(<><b>{machine ? 'Máquina actualizada.' : 'Máquina creada.'}</b> {saved.identification_code} · {saved.name}</>)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const d = describeError(err)
      setError(`${d.title}. ${d.message}`)
    }
  }
  return (
    <Modal
      title={machine ? `Editar ${machine.identification_code}` : 'Nueva máquina'}
      icon="gear-wide-connected"
      onClose={onClose}
      footer={<><Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button><Button variant="primary" size="lg" icon="check-lg" form="machine-form" type="submit" loading={save.isPending}>{machine ? 'Guardar' : 'Crear máquina'}</Button></>}
    >
      <form id="machine-form" onSubmit={submit} noValidate className="bd-form-grid">
        {error && <div className="bd-span"><Notice tone="danger">{error}</Notice></div>}
        <Field label="Código" htmlFor="m-code" required hint="Como está rotulada en planta, p. ej. T-01" error={tried && !code.trim() ? 'Escribe el código.' : undefined}><TextInput id="m-code" className="bd-mono" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} autoFocus /></Field>
        <Field label="Nombre" htmlFor="m-name" required error={tried && !name.trim() ? 'Escribe el nombre.' : undefined}><TextInput id="m-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
        <Field label="Ubicación en planta" htmlFor="m-loc" optional className="bd-span" hint="Nave y área, p. ej. Nave 1 · Tostado"><TextInput id="m-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} /></Field>
      </form>
    </Modal>
  )
}
