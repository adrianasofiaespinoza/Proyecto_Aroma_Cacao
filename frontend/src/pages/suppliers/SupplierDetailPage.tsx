import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSuppliers } from '../../api/hooks'
import { useInventory } from '../../api/useInventory'
import { useSessionUser } from '../../app/AuthProvider'
import { Button, ConnectionError, LoadingRows, Notice, PageHeader, Panel } from '../../components/ui'
import { isConnectionError } from '../../lib/errors'
import { can } from '../../lib/permissions'
import { SupplierDetail } from './SupplierDetail'
import { SupplierFormModal } from './SupplierFormModal'

export function SupplierDetailPage() {
  const { id } = useParams()
  const user = useSessionUser()
  const navigate = useNavigate()
  const inv = useInventory({ lots: false, machines: false, loans: false })
  const suppliers = useSuppliers()
  const [editing, setEditing] = useState(false)
  const supplier = suppliers.data?.find((s) => s.id === Number(id))
  if (suppliers.isLoading || inv.isLoading) return <Panel flush><LoadingRows rows={3} label="Cargando el proveedor…" /></Panel>
  if (!supplier) {
    if (isConnectionError(suppliers.error)) return <Panel flush><ConnectionError onRetry={() => void suppliers.refetch()} /></Panel>
    return <Notice tone="danger" title="No se encontró el proveedor"><Button size="sm" variant="secondary" onClick={() => navigate('/proveedores')}>Volver a proveedores</Button></Notice>
  }
  const admin = can(user.role, 'administrar')
  return (
    <>
      <PageHeader back="Proveedores" backTo="/proveedores" title="Proveedor" />
      <SupplierDetail supplier={supplier} inv={inv} admin={admin} onEdit={() => setEditing(true)} />
      {editing && <SupplierFormModal supplier={supplier} onClose={() => setEditing(false)} />}
    </>
  )
}
