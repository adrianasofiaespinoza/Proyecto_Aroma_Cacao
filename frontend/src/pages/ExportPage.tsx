/**
 * Exportar a Excel o CSV (cualquier rol: son los mismos datos que ya ve en pantalla).
 * Decisión de la usuaria: una sola pantalla con el inventario completo y el historial de movimientos.
 */
import { useState } from 'react'
import { exportInventory, exportMovements, type ExportFormat, type InventoryExportKind } from '../api/endpoints'
import type { MovementStatus, MovementType } from '../api/types'
import { useModules } from '../app/ThemeProvider'
import { Button, Field, Notice, PageHeader, Panel, Segmented, Select, TextInput, useToast } from '../components/ui'
import { describeError } from '../lib/errors'

const FORMATS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV' },
]

const TYPES = [
  { value: '', label: 'Todos los tipos' },
  { value: 'ENTRY', label: 'Entradas' },
  { value: 'EXIT', label: 'Salidas' },
  { value: 'ADJUSTMENT', label: 'Ajustes' },
]

const STATUSES = [
  { value: '', label: 'Todos los estados' },
  { value: 'authorized', label: 'Autorizados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'rejected', label: 'Rechazados' },
]

const pad = (x: number) => String(x).padStart(2, '0')
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

type ErrorBox = { title: string; message: string; code?: string } | null

export function ExportPage() {
  const toast = useToast()
  const modules = useModules()

  const kinds: { value: InventoryExportKind; label: string }[] = [
    { value: 'products', label: 'Productos' },
    { value: 'stock', label: 'Stock (con lotes)' },
    ...(modules.machines ? [{ value: 'machines' as const, label: 'Máquinas' }] : []),
    ...(modules.suppliers ? [{ value: 'suppliers' as const, label: 'Proveedores' }] : []),
  ]

  const [invFormat, setInvFormat] = useState<ExportFormat>('xlsx')
  const [kind, setKind] = useState<InventoryExportKind>('products')
  const [invBusy, setInvBusy] = useState(false)
  const [invError, setInvError] = useState<ErrorBox>(null)

  const today = new Date()
  const [movFormat, setMovFormat] = useState<ExportFormat>('xlsx')
  const [dateFrom, setDateFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [dateTo, setDateTo] = useState(isoDate(today))
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [movBusy, setMovBusy] = useState(false)
  const [movError, setMovError] = useState<ErrorBox>(null)
  const rangeError = dateFrom && dateTo && dateFrom > dateTo ? 'La fecha «Desde» no puede ser posterior a «Hasta».' : undefined

  const downloaded = (filename: string) => toast.ok(<><b>Archivo descargado.</b> {filename}</>)

  const runInventory = async () => {
    setInvError(null)
    setInvBusy(true)
    try {
      downloaded(await exportInventory(invFormat, kind))
    } catch (err) {
      setInvError(describeError(err))
    } finally {
      setInvBusy(false)
    }
  }

  const runMovements = async () => {
    setMovError(null)
    if (rangeError) return
    setMovBusy(true)
    try {
      downloaded(await exportMovements(movFormat, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        type: (type || undefined) as MovementType | undefined,
        status: (status || undefined) as MovementStatus | undefined,
      }))
    } catch (err) {
      setMovError(describeError(err))
    } finally {
      setMovBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Exportar" subtitle="Descarga el inventario o el historial de movimientos en Excel o CSV" />

      <Panel title="Inventario completo" icon="box-seam">
        <div className="ex-form">
          <p className="ex-help">
            Productos, stock actual con sus lotes{modules.machines ? ', máquinas' : ''}{modules.suppliers ? ' y proveedores' : ''}.
            Tiene el mismo formato que la plantilla de importación: sirve de respaldo y se puede importar en otra instalación.
          </p>
          <Field label="Formato">
            <Segmented label="Formato del inventario" value={invFormat} onChange={(v) => setInvFormat(v as ExportFormat)} options={FORMATS} />
          </Field>
          {invFormat === 'csv' && (
            <Field label="Datos" htmlFor="ex-kind" hint="Un CSV tiene un solo tipo de dato. En Excel van todos, una hoja por tipo.">
              <Select id="ex-kind" value={kind} onChange={(e) => setKind(e.target.value as InventoryExportKind)} options={kinds} />
            </Field>
          )}
          {invError && <Notice tone="danger" title={invError.title} code={invError.code}>{invError.message}</Notice>}
          <div><Button variant="primary" icon="box-arrow-in-down" loading={invBusy} onClick={() => void runInventory()}>Descargar inventario</Button></div>
        </div>
      </Panel>

      <Panel title="Historial de movimientos" icon="arrow-left-right">
        <div className="ex-form">
          <p className="ex-help">Una fila por producto de cada movimiento: fecha, tipo, estado, cantidad, lote, máquina, motivo, quién pidió y quién revisó.</p>
          <div className="ex-grid">
            <Field label="Desde" htmlFor="ex-from" error={rangeError}><TextInput id="ex-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} /></Field>
            <Field label="Hasta" htmlFor="ex-to"><TextInput id="ex-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
            <Field label="Tipo" htmlFor="ex-type"><Select id="ex-type" value={type} onChange={(e) => setType(e.target.value)} options={TYPES} /></Field>
            <Field label="Estado" htmlFor="ex-status"><Select id="ex-status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUSES} /></Field>
          </div>
          <Field label="Formato">
            <Segmented label="Formato de los movimientos" value={movFormat} onChange={(v) => setMovFormat(v as ExportFormat)} options={FORMATS} />
          </Field>
          {movError && <Notice tone="danger" title={movError.title} code={movError.code}>{movError.message}</Notice>}
          <div><Button variant="primary" icon="box-arrow-in-down" loading={movBusy} disabled={!!rangeError} onClick={() => void runMovements()}>Descargar movimientos</Button></div>
        </div>
      </Panel>

      <p className="bd-muted ex-note">Las fechas salen en la hora de este dispositivo, igual que en pantalla. Si dejas «Desde» o «Hasta» vacío, se incluye todo el historial en ese sentido.</p>
    </>
  )
}
