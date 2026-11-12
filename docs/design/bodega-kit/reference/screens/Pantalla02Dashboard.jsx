// @card height=900 width=1760 subtitle="Coordinador en escritorio; Operador en móvil con acciones grandes."
import { B, Devices, Shell, COORD, OPER, PRODUCTS, MOVES, render } from './_kit.jsx';
const { PageHeader, KpiStrip, Panel, DataTable, StockMeter, CodeTag, Button, TypeTag, StatusBadge, Icon } = B;
const kpis = [
  { label: 'Productos activos', value: 212, icon: 'box-seam', hint: 'En 9 categorías' },
  { label: 'Stock bajo', value: 3, icon: 'exclamation-triangle-fill', tone: 'danger', hint: 'Actual ≤ mínimo' },
  { label: 'Por autorizar', value: 4, icon: 'hourglass-split', tone: 'pending', hint: 'No aplicados al stock' },
  { label: 'Herramientas prestadas', value: 4, icon: 'tools', hint: '3 trabajadores' },
  { label: 'Lotes ≤ 30 días', value: 2, icon: 'calendar-x', tone: 'danger', hint: '1 ya vencido' },
];
const low = PRODUCTS.filter(p => p.active && p.stock <= p.min);
function PendingList({ items, review }) {
  return (
    <ul className="db-pend">
      {items.map(m => (
        <li key={m.id} className="bd-hatch">
          <div className="db-pend-top"><TypeTag type={m.type} /><CodeTag>{m.id}</CodeTag><span className="db-pend-time">{m.date}</span></div>
          <div className="db-pend-item"><b>{m.item}</b> · {m.qty}</div>
          <div className="db-pend-by">{m.by}{m.machine !== '—' ? ' → ' + m.machine : ''}</div>
          {review ? <Button variant="secondary" size="sm" iconRight="chevron-right">Revisar</Button> : <StatusBadge status="pendiente" explain />}
        </li>
      ))}
    </ul>
  );
}
const desktop = (
  <Shell user={COORD} current="inicio">
    <PageHeader title="Inicio" subtitle="Martes 10 de noviembre de 2026 · Bodega de mantenimiento" actions={<Button variant="primary" icon="plus-lg">Nueva solicitud</Button>} />
    <KpiStrip items={kpis} />
    <div className="bd-split">
      <Panel title="Alertas de stock bajo" icon="exclamation-triangle-fill" tone="danger" count={`${low.length} productos`} flush actions={<Button size="sm" variant="ghost" iconRight="chevron-right">Ver productos</Button>}>
        <DataTable rows={low} rowTone={() => 'danger'} caption="Productos con stock igual o menor al mínimo"
          columns={[
            { key: 'name', header: 'Producto', mobile: 'title', render: r => <><div className="bd-cell-title">{r.name}</div><div className="bd-cell-sub"><span className="bd-mono">{r.code}</span> · {r.brand}</div></> },
            { key: 'loc', header: 'Ubicación', render: r => <span className="bd-mono">{r.loc}</span> },
            { key: 'stock', header: 'Stock', width: 170, render: r => <StockMeter current={r.stock} min={r.min} max={r.max} unit={r.unit} /> },
          ]}
          actions={() => <Button size="sm" variant="secondary" icon="box-arrow-in-down">Pedir entrada</Button>} />
      </Panel>
      <Panel title="Por autorizar" icon="hourglass-split" tone="pending" count="4 solicitudes" actions={<Button size="sm" variant="ghost" iconRight="chevron-right">Ver todas</Button>}>
        <PendingList items={MOVES.filter(m => m.status === 'pendiente')} review />
      </Panel>
    </div>
  </Shell>
);
const mobile = (
  <Shell user={OPER} current="inicio">
    <div><div className="db-hello">Hola, Luis</div><div className="bd-muted">Martes 10/11 · Turno A</div></div>
    <div className="db-actions">
      <Button variant="primary" size="xl" icon="box-arrow-up">Pedir salida</Button>
      <Button variant="secondary" size="xl" icon="box-arrow-in-down">Pedir entrada</Button>
      <Button variant="secondary" size="xl" icon="tools">Prestar herramienta</Button>
      <Button variant="secondary" size="xl" icon="arrow-counterclockwise">Devolver</Button>
    </div>
    <Panel title="Mis solicitudes" icon="file-earmark-text" tone="pending" count="2 pendientes">
      <PendingList items={MOVES.filter(m => m.status === 'pendiente' && m.by === 'Luis Cedeño')} />
    </Panel>
    <KpiStrip items={[kpis[1], kpis[3]]} />
  </Shell>
);
render(<Devices desktop={desktop} mobile={mobile} dRole="Coordinador" mRole="Operador" />);
