import { useState } from 'react'
import {
  Button, Checkbox, Chip, CodeTag, ConfirmDialog, ConnectionError, DataTable, EmptyState, Field, FilterBar, IconButton, KpiStrip, LoadingRows,
  MovementFlow, Notice, PageHeader, Panel, QuantityStepper, SearchInput, Segmented, Select, StatusBadge, StockImpact, StockMeter, Textarea, TextInput, TypeTag, useToast,
  type Status,
} from '../components/ui'

const STATUSES: Status[] = ['pendiente', 'autorizado', 'rechazado', 'prestado', 'devuelto', 'activo', 'inactivo', 'stock-bajo', 'vencido', 'por-vencer', 'vigente', 'sin-lote', 'solo-lectura']
const ROWS = [
  { id: 1, code: 'ROD-0412', name: 'Rodamiento rígido de bolas 6205-2RS', stock: 4, min: 10, max: 40, status: 'stock-bajo' as Status },
  { id: 2, code: 'FIL-0090', name: 'Filtro de aceite hidráulico 10 µm', stock: 9, min: 4, max: 16, status: 'activo' as Status },
]

/** Solo en desarrollo (/dev/componentes): muestra todos los componentes con sus variantes. */
export function ComponentsDevPage() {
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const [seg, setSeg] = useState('pendiente')
  return (
    <div className="bd-dev-grid">
      <PageHeader title="Componentes" subtitle="Galería de desarrollo" actions={<Button variant="primary" icon="plus-lg">Primario</Button>} />
      <section className="bd-dev-section">
        <h2>Botones</h2>
        <div className="bd-row">
          <Button variant="primary" icon="plus-lg">Primario</Button><Button variant="secondary">Secundario</Button><Button variant="ghost">Ghost</Button>
          <Button variant="ok" icon="check-lg">Autorizar y aplicar al stock</Button><Button variant="danger" icon="x-lg">Rechazar</Button><Button variant="danger-outline">Peligro contorno</Button>
          <Button loading>Cargando</Button><Button disabled>Deshabilitado</Button>
          <Button size="sm">sm</Button><Button size="lg">lg</Button><Button size="xl">xl</Button>
          <IconButton icon="pencil" label="Editar" /><IconButton icon="x-lg" label="Cerrar" variant="outline" size="lg" />
        </div>
      </section>
      <section className="bd-dev-section">
        <h2>Insignias</h2>
        <div className="bd-row">{STATUSES.map((s) => <StatusBadge key={s} status={s} explain />)}</div>
        <div className="bd-row"><StatusBadge status="pendiente" explain size="lg" /><TypeTag type="entrada" /><TypeTag type="salida" /><TypeTag type="ajuste" /><CodeTag>MOV-0142</CodeTag></div>
      </section>
      <section className="bd-dev-section">
        <h2>Indicadores</h2>
        <KpiStrip items={[
          { label: 'Productos activos', value: 212, icon: 'box-seam', hint: 'En 9 categorías', href: '/productos' },
          { label: 'Stock bajo', value: 3, icon: 'exclamation-triangle-fill', tone: 'danger', hint: 'Actual ≤ mínimo' },
          { label: 'Por autorizar', value: 4, icon: 'hourglass-split', tone: 'pending', hint: 'No aplicados al stock' },
          { label: 'Lotes ≤ 30 días', value: 2, icon: 'calendar-x', tone: 'info', hint: '1 ya vencido' },
        ]} />
        <div className="bd-row"><StockMeter current={4} min={10} max={40} /><StockMeter current={9} min={4} max={16} /></div>
      </section>
      <section className="bd-dev-section">
        <h2>Tabla (se vuelve tarjetas bajo 640px)</h2>
        <Panel flush title="Productos" icon="box-seam" count="2">
          <FilterBar>
            <SearchInput placeholder="Buscar por código o nombre" />
            <Chip pressed>Todos</Chip><Chip icon="exclamation-triangle-fill" count={1}>Stock bajo</Chip>
            <Segmented label="Estado" value={seg} onChange={setSeg} options={[{ value: 'pendiente', label: 'Pendientes', icon: 'hourglass-split' }, { value: 'todos', label: 'Todos' }]} />
          </FilterBar>
          <DataTable
            columns={[
              { key: 'code', header: 'Código', mobile: 'subtitle', render: (r) => <CodeTag>{r.code}</CodeTag> },
              { key: 'name', header: 'Producto', mobile: 'title' },
              { key: 'stock', header: 'Stock', render: (r) => <StockMeter current={r.stock} min={r.min} max={r.max} /> },
              { key: 'status', header: 'Estado', mobile: 'badge', render: (r) => <StatusBadge status={r.status} /> },
            ]}
            rows={ROWS}
            rowTone={(r) => (r.status === 'stock-bajo' ? 'danger' : null)}
            actions={() => <Button size="sm" variant="secondary" icon="box-arrow-in-down">Pedir entrada</Button>}
          />
        </Panel>
        <Panel flush><LoadingRows rows={3} label="Cargando productos…" /></Panel>
        <Panel flush><EmptyState title="No hay productos" text="Crea el primero con «Nuevo producto»." action={<Button variant="primary" icon="plus-lg">Nuevo producto</Button>} /></Panel>
        <Panel flush><ConnectionError onRetry={() => toast.ok('Reintentando…')} /></Panel>
      </section>
      <section className="bd-dev-section">
        <h2>Formularios</h2>
        <div className="bd-form-grid">
          <Field label="Código" htmlFor="f1" required hint="Único en la bodega"><TextInput id="f1" className="bd-mono" defaultValue="ROD-0412" /></Field>
          <Field label="Stock actual" htmlFor="f2"><TextInput id="f2" readOnlyValue="4 u. · solo cambia con movimientos" /></Field>
          <Field label="Categoría" htmlFor="f3" required><Select id="f3" placeholder="Elige una" options={['Rodamientos', 'Filtros']} /></Field>
          <Field label="Con error" htmlFor="f4" error="Escribe el motivo: es obligatorio en salidas y ajustes."><Textarea id="f4" /></Field>
          <Field label="Cantidad" htmlFor="f5" required><QuantityStepper id="f5" defaultValue={2} /></Field>
          <Field label="Con sufijo" htmlFor="f6"><TextInput id="f6" suffix="kg" defaultValue="18" /></Field>
        </div>
        <Checkbox label="Este producto requiere trazabilidad por lote" defaultChecked />
      </section>
      <section className="bd-dev-section">
        <h2>Avisos</h2>
        <Notice tone="pending" title="Queda Pendiente">El stock no cambia hasta que el coordinador la autorice.</Notice>
        <Notice tone="danger" title="La salida supera lo disponible" code="STOCK_INSUFICIENTE · 400" actions={<Button variant="danger" icon="x-lg">Rechazar solicitud</Button>}>Se pidieron 4 u. y hay 2 u. El stock no cambió.</Notice>
        <Notice tone="ok" title="Guardado">Los cambios se aplicaron.</Notice>
        <Notice tone="info">Información neutra.</Notice>
        <div className="bd-row"><Button onClick={() => toast.ok(<><b>Salida autorizada.</b> El stock bajó de 4 a 2 u.</>)}>Toast ok</Button><Button onClick={() => toast.danger('No se pudo guardar.')}>Toast peligro</Button><Button onClick={() => setConfirm(true)}>Confirmar</Button></div>
      </section>
      <section className="bd-dev-section">
        <h2>Flujo e impacto</h2>
        <MovementFlow status="pendiente" requested={{ by: 'L. Cedeño', at: '10/11 08:12' }} />
        <MovementFlow status="autorizado" requested={{ by: 'L. Cedeño', at: '10/11 08:12' }} reviewed={{ by: 'M. Andrade', at: '10/11 09:41' }} />
        <MovementFlow status="rechazado" requested={{ by: 'D. Mero', at: '08/11 15:47' }} reviewed={{ by: 'M. Andrade', at: '08/11 16:02' }} />
        <div className="bd-row"><StockImpact before={4} after={2} /><StockImpact before={4} after={2} status="autorizado" /><StockImpact before={2} after={-2} status="rechazado" /><StockImpact before={2} after={-2} blocked label="Disponible" /></div>
      </section>
      {confirm && (
        <ConfirmDialog tone="ok" title="¿Autorizar la salida MOV-0142?" confirmLabel="Sí, autorizar y aplicar" confirmIcon="check-lg" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); toast.ok('Autorizada.') }}
          consequences={[['Producto', 'Rodamiento 6205-2RS'], ['Se descuentan', '2 u.'], ['Stock', '4 u. → 2 u.']]}>
          <p style={{ margin: 0 }}>El stock se actualizará en cuanto confirmes.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
