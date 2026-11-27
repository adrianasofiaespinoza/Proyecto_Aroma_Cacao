/**
 * Importar el inventario desde Excel o CSV (solo Coordinador).
 * 1. Descargar la plantilla. 2. Subir el archivo: vista previa sin guardar nada.
 * 3. Decidir qué hacer con lo que ya existe. 4. Confirmar: se carga todo o nada.
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  ImportFileError, ImportHasErrors, downloadImportTemplate, previewImport,
  type ImportKind, type ImportPreview, type ImportRow, type ImportSheet, type ImportSummary, type ImportUpload,
} from '../../api/endpoints'
import { useConfirmImport } from '../../api/hooks'
import { Button, Checkbox, ConfirmDialog, DataTable, Notice, PageHeader, Panel, useToast, type Column } from '../../components/ui'
import { describeError } from '../../lib/errors'

const MAX_MB = 2
const ACCEPT = '.xlsx,.csv'

/** Nombres de los campos que pueden cambiar en un registro existente. */
const FIELD_LABELS: Record<string, string> = {
  internal_code: 'Código', name: 'Nombre', brand: 'Marca', model: 'Modelo', part_number: 'Número de parte',
  minimum_stock: 'Stock mínimo', maximum_stock: 'Stock máximo', physical_location: 'Ubicación',
  category: 'Categoría', unit: 'Unidad', requires_lot: 'Usa lotes',
  identification_code: 'Código', location: 'Ubicación',
  company_name: 'Razón social', ruc: 'RUC', contact_person: 'Contacto', phone: 'Teléfono', address: 'Dirección', email: 'Correo',
}

/** Lo que identifica cada fila en la tabla, según la hoja. */
const ROW_TITLE: Record<ImportKind, (r: ImportRow) => string> = {
  products: (r) => String(r.values.name || '—'),
  stock: (r) => [r.values.cantidad, r.values.lote ? `lote ${r.values.lote}` : null].filter(Boolean).join(' · ') || '—',
  machines: (r) => String(r.values.name || '—'),
  suppliers: (r) => String(r.values.company_name || '—'),
}

type ErrorBox = { title: string; message: string; code?: string } | null

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'vacío'
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  return String(value)
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export function ImportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const confirm = useConfirmImport()
  const [upload, setUpload] = useState<ImportUpload | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [reading, setReading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<ErrorBox>(null)
  const [updates, setUpdates] = useState<Record<string, boolean>>({})
  const [asking, setAsking] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const reset = () => {
    setUpload(null)
    setPreview(null)
    setUpdates({})
    setSummary(null)
    setError(null)
  }

  const getTemplate = async () => {
    setDownloading(true)
    try {
      await downloadImportTemplate()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setDownloading(false)
    }
  }

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setError({ title: 'Formato no admitido', message: 'Sube un archivo .xlsx (Excel) o .csv. Si tienes un .xls antiguo, guárdalo como .xlsx.' })
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError({ title: 'El archivo pesa demasiado', message: `Pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_MB} MB.` })
      return
    }
    setReading(true)
    try {
      const next = { filename: file.name, data_base64: await readAsBase64(file) }
      setPreview(await previewImport(next))
      setUpload(next)
    } catch (err) {
      setError(err instanceof ImportFileError ? { title: 'No se pudo leer el archivo', message: err.message } : describeError(err))
    } finally {
      setReading(false)
    }
  }

  const updateKey = (kind: ImportKind, row: number) => `${kind}:${row}`
  const updateRows = () => {
    const rows: Partial<Record<ImportKind, number[]>> = {}
    for (const [key, chosen] of Object.entries(updates)) {
      if (!chosen) continue
      const [kind, row] = key.split(':') as [ImportKind, string]
      ;(rows[kind] ??= []).push(Number(row))
    }
    return rows
  }

  const runImport = async () => {
    if (!upload) return
    try {
      const result = await confirm.mutateAsync({ upload, updateRows: updateRows() })
      setAsking(false)
      setSummary(result)
      setPreview(null)
      toast.ok(<><b>Inventario importado.</b> Ya puedes verlo en Productos.</>)
    } catch (err) {
      setAsking(false)
      if (err instanceof ImportHasErrors) {
        setPreview(err.preview)
        setError({ title: 'El archivo ya no es válido', message: 'Algo cambió en el sistema desde la vista previa. Revisa los errores marcados.' })
      } else {
        setError(describeError(err))
      }
    }
  }

  const counts = (kind: ImportKind) => preview?.sheets.find((s) => s.kind === kind)?.counts ?? { new: 0, existing: 0, error: 0 }
  const chosenUpdates = (kind: ImportKind) => Object.entries(updates).filter(([k, v]) => v && k.startsWith(kind + ':')).length
  const totalErrors = preview ? preview.sheets.reduce((acc, s) => acc + s.counts.error + (s.error ? 1 : 0), 0) : 0
  const totalExisting = preview ? preview.sheets.reduce((acc, s) => acc + s.counts.existing, 0) : 0

  const consequences: [string, string][] = []
  const add = (label: string, kind: ImportKind) => {
    const c = counts(kind)
    const updated = chosenUpdates(kind)
    const parts = [c.new ? plural(c.new, 'nuevo', 'nuevos') : null, updated ? plural(updated, 'actualizado', 'actualizados') : null].filter(Boolean)
    if (parts.length) consequences.push([label, parts.join(' · ')])
  }
  add('Productos', 'products')
  add('Máquinas', 'machines')
  add('Proveedores', 'suppliers')
  if (counts('stock').new) consequences.push(['Stock inicial', `${plural(counts('stock').new, 'fila', 'filas')}, como una entrada «Carga inicial»`])
  if (preview?.new_categories.length) consequences.push(['Categorías nuevas', preview.new_categories.join(', ')])
  const skipped = totalExisting - Object.values(updates).filter(Boolean).length
  if (skipped > 0) consequences.push(['Se dejan como están', plural(skipped, 'registro existente', 'registros existentes')])

  return (
    <>
      <PageHeader title="Importar inventario" subtitle="Carga productos, stock inicial, máquinas y proveedores desde Excel o CSV" back="Productos" backTo="/productos" />

      <Panel title="1. Prepara el archivo" icon="file-earmark-text">
        <div className="im-step">
          <p>Descarga la plantilla, llena las hojas que necesites y no cambies los nombres de las columnas. La hoja «Instrucciones» explica cada columna con ejemplos.</p>
          <Button icon="box-arrow-in-down" loading={downloading} onClick={() => void getTemplate()}>Descargar plantilla</Button>
        </div>
      </Panel>

      <Panel title="2. Sube el archivo" icon="box-arrow-up">
        <div className="im-step">
          <p>Se aceptan archivos .xlsx o .csv de hasta {MAX_MB} MB. <b>Nada se guarda hasta que confirmes.</b></p>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={(e) => void pickFile(e)} />
          <Button variant={upload ? 'secondary' : 'primary'} icon="box-arrow-up" loading={reading} onClick={() => fileRef.current?.click()}>
            {upload ? 'Subir otro archivo' : 'Elegir archivo'}
          </Button>
          {upload && <span className="bd-muted im-filename">{upload.filename}</span>}
        </div>
      </Panel>

      {error && <Notice tone="danger" title={error.title} code={error.code}>{error.message}</Notice>}

      {summary && (
        <Notice
          tone="ok"
          title="Inventario importado"
          actions={<><Button variant="primary" icon="box-seam" onClick={() => navigate('/productos')}>Ver productos</Button><Button onClick={reset}>Importar otro archivo</Button></>}
        >
          {[
            summary.products_created && plural(summary.products_created, 'producto creado', 'productos creados'),
            summary.products_updated && plural(summary.products_updated, 'producto actualizado', 'productos actualizados'),
            summary.stock_rows && `stock inicial en ${plural(summary.stock_rows, 'fila', 'filas')}`,
            summary.categories_created && plural(summary.categories_created, 'categoría nueva', 'categorías nuevas'),
            summary.machines_created && plural(summary.machines_created, 'máquina creada', 'máquinas creadas'),
            summary.machines_updated && plural(summary.machines_updated, 'máquina actualizada', 'máquinas actualizadas'),
            summary.suppliers_created && plural(summary.suppliers_created, 'proveedor creado', 'proveedores creados'),
            summary.suppliers_updated && plural(summary.suppliers_updated, 'proveedor actualizado', 'proveedores actualizados'),
            summary.skipped && plural(summary.skipped, 'registro existente sin cambios', 'registros existentes sin cambios'),
          ].filter(Boolean).join(' · ')}.
          {summary.movement_id && <> El stock quedó registrado en el movimiento <a href={`/movimientos/${summary.movement_id}`} onClick={(e) => { e.preventDefault(); navigate(`/movimientos/${summary.movement_id}`) }}>#{summary.movement_id}</a>.</>}
        </Notice>
      )}

      {preview && (
        <>
          {totalErrors > 0 ? (
            <Notice tone="danger" title={`El archivo tiene ${plural(totalErrors, 'error', 'errores')}`}>
              Corrige las filas marcadas en tu archivo y vuelve a subirlo. No se cargará nada mientras haya errores.
            </Notice>
          ) : (
            <Notice tone="ok" title="El archivo está listo para importar">
              {totalExisting > 0
                ? `${plural(totalExisting, 'registro ya existe', 'registros ya existen')}: marca «Actualizar» en los que quieras reemplazar con los datos del archivo. Los demás se dejan como están.`
                : 'Revisa la vista previa y confirma la importación.'}
            </Notice>
          )}
          {preview.new_categories.length > 0 && (
            <Notice tone="info" title="Se crearán categorías nuevas">{preview.new_categories.join(', ')}. Si alguna es un error de escritura, corrígela en el archivo.</Notice>
          )}

          {preview.sheets.map((sheet) => (
            <SheetPreview
              key={sheet.kind}
              sheet={sheet}
              isChecked={(row) => !!updates[updateKey(sheet.kind, row)]}
              onToggle={(row, value) => setUpdates((u) => ({ ...u, [updateKey(sheet.kind, row)]: value }))}
            />
          ))}

          <div className="im-actions">
            <Button onClick={reset}>Cancelar</Button>
            <Button variant="primary" icon="check-lg" disabled={!preview.can_confirm} onClick={() => setAsking(true)}>Importar</Button>
          </div>
        </>
      )}

      {asking && (
        <ConfirmDialog
          title="¿Importar el inventario?"
          tone="brand"
          icon="box-arrow-in-down"
          consequences={consequences}
          confirmLabel="Importar"
          confirmIcon="check-lg"
          loading={confirm.isPending}
          onConfirm={() => void runImport()}
          onCancel={() => setAsking(false)}
        >
          Se carga todo o nada. El stock inicial queda autorizado a tu nombre.
        </ConfirmDialog>
      )}
    </>
  )
}

function SheetPreview({ sheet, isChecked, onToggle }: { sheet: ImportSheet; isChecked: (row: number) => boolean; onToggle: (row: number, value: boolean) => void }) {
  const title = ROW_TITLE[sheet.kind]
  const cols: Column<ImportRow>[] = [
    { key: 'row', header: 'Fila', width: 64, mobile: 'meta', mobileLabel: 'Fila', render: (r) => <span className="bd-mono">{r.row}</span> },
    {
      key: 'item', header: 'Registro', mobile: 'title',
      render: (r) => (
        <>
          <div className="bd-cell-title">{title(r)}</div>
          {r.key && <div className="bd-cell-sub bd-mono">{r.key}</div>}
        </>
      ),
    },
    {
      key: 'detail', header: 'Detalle', mobile: 'wide',
      render: (r) => (
        <div className="im-detail">
          {r.messages.map((m) => <div key={m} className={r.status === 'error' ? 'im-msg-error' : 'im-msg'}>{m}</div>)}
          {r.status === 'existing' && (
            <>
              {Object.keys(r.changes).length === 0
                ? <div className="bd-muted">Los datos del archivo son iguales a los del sistema.</div>
                : (
                  <ul className="im-changes">
                    {Object.entries(r.changes).map(([field, [before, after]]) => (
                      <li key={field}><b>{FIELD_LABELS[field] ?? field}:</b> {show(before)} → {show(after)}</li>
                    ))}
                  </ul>
                )}
              {Object.keys(r.changes).length > 0 && (
                <Checkbox label="Actualizar con los datos del archivo" checked={isChecked(r.row)} onChange={(e) => onToggle(r.row, e.target.checked)} />
              )}
            </>
          )}
          {r.status === 'new' && r.messages.length === 0 && <span className="bd-muted">Nuevo</span>}
        </div>
      ),
    },
    {
      key: 'state', header: 'Estado', width: 120, mobile: 'badge',
      render: (r) => <span className={`im-tag im-tag-${r.status}`}>{r.status === 'error' ? 'Error' : r.status === 'existing' ? 'Ya existe' : 'Nuevo'}</span>,
    },
  ]
  const { counts } = sheet
  const summary = [
    counts.new && plural(counts.new, 'nuevo', 'nuevos'),
    counts.existing && `${counts.existing} ya ${counts.existing === 1 ? 'existe' : 'existen'}`,
    counts.error && `${counts.error} con error`,
  ].filter(Boolean).join(' · ')

  return (
    <Panel title={sheet.title} count={summary || undefined} flush tone={sheet.error || counts.error ? 'danger' : undefined}>
      {sheet.error && <div className="im-sheet-note"><Notice tone="danger" title="No se puede importar esta hoja">{sheet.error}</Notice></div>}
      {sheet.unknown_columns.length > 0 && (
        <div className="im-sheet-note"><Notice tone="info" title="Columnas que se ignoran">{sheet.unknown_columns.join(', ')}. Revisa que no sea una columna de la plantilla mal escrita.</Notice></div>
      )}
      {!sheet.error && (
        <DataTable
          columns={cols}
          rows={sheet.rows}
          rowKey="row"
          rowTone={(r) => (r.status === 'error' ? 'danger' : r.status === 'existing' ? 'pending' : null)}
          caption={sheet.title}
          empty={{ icon: 'inbox', title: 'La hoja no tiene filas' }}
        />
      )}
    </Panel>
  )
}
