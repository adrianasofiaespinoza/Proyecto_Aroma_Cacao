import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useInventory } from '../../api/useInventory'
import { useSessionUser } from '../../app/AuthProvider'
import { Button, ConnectionError, LoadingRows, Notice, PageHeader, Panel, RoleGate } from '../../components/ui'
import { can } from '../../lib/permissions'
import { MachineFormModal } from './MachineFormModal'
import { MachineParts } from './MachineParts'

export function MachineDetailPage() {
  const { id } = useParams()
  const user = useSessionUser()
  const navigate = useNavigate()
  const inv = useInventory({ loans: false })
  const [editing, setEditing] = useState(false)
  const machine = inv.machineById.get(Number(id))
  if (inv.isLoading) return <Panel flush><LoadingRows rows={3} label="Cargando la máquina…" /></Panel>
  if (!machine) {
    if (inv.offline) return <Panel flush><ConnectionError onRetry={inv.refetch} /></Panel>
    return <Notice tone="danger" title="No se encontró la máquina"><Button size="sm" variant="secondary" onClick={() => navigate('/maquinas')}>Volver a máquinas</Button></Notice>
  }
  const admin = can(user.role, 'administrar')
  return (
    <>
      <PageHeader
        back="Máquinas"
        backTo="/maquinas"
        title={machine.name}
        subtitle={[machine.identification_code, machine.location, `${machine.product_ids.length} repuestos`].filter(Boolean).join(' · ')}
        actions={<RoleGate role={user.role} action="administrar"><Button variant="secondary" icon="pencil" onClick={() => setEditing(true)}>Editar</Button></RoleGate>}
      />
      <Panel title="Repuestos compatibles" icon="box-seam" flush>
        <MachineParts machine={machine} inv={inv} admin={admin} canRequest={can(user.role, 'solicitar')} />
      </Panel>
      {editing && <MachineFormModal machine={machine} onClose={() => setEditing(false)} />}
    </>
  )
}
