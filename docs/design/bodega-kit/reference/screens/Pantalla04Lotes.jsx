// @card height=760 width=1760 subtitle="Lotes de un producto: vencidos y por vencer marcados."
import { B, Devices, Shell, COORD, OPER, LOTS, render } from './_kit.jsx';
const { PageHeader, Panel, DataTable, StatusBadge, CodeTag, Notice, Button, Icon } = B;
const cols = [
  { key: 'lot', header: 'Lote', mobile: 'title', render: r => <CodeTag>{r.lot}</CodeTag> },
  { key: 'exp', header: 'Vencimiento', render: r => <span className="bd-num">{r.exp}</span> },
  { key: 'days', header: 'Días', render: r => <b className="bd-num" style={{ color: r.state === 'vencido' ? 'var(--danger-ink)' : r.state === 'por-vencer' ? 'var(--pending-ink)' : undefined }}>{r.days}</b> },
  { key: 'left', header: 'Cantidad restante', align: 'right', mobileLabel: 'Restante', render: r => <b className="bd-num">{r.left} kg</b> },
  { key: 'state', header: 'Estado', mobile: 'badge', render: r => <StatusBadge status={r.state} /> },
];
const tone = r => r.state === 'vencido' ? 'danger' : null;
const body = (
  <>
    <PageHeader back="Productos" title="Grasa grado alimenticio H1" subtitle="LUB-0021 · Klüber UH1 14-151 · C-02-1 · 18 kg en 3 lotes" actions={<Button variant="secondary" icon="box-arrow-in-down">Pedir entrada con lote</Button>} />
    <Notice tone="danger" title="Lote G-2407 vencido el 30/10/2026">Quedan 2 kg. No lo uses en líneas de producto; pide un ajuste para darlo de baja.</Notice>
    <Panel title="Lotes" icon="layers" count="Primero en vencer, primero en salir" flush>
      <DataTable columns={cols} rows={LOTS} rowTone={tone} caption="Lotes del producto" />
    </Panel>
    <div className="lt-legend"><span><StatusBadge status="vencido" /> fecha pasada</span><span><StatusBadge status="por-vencer" /> vence en 30 días o menos</span><span><StatusBadge status="vigente" /> más de 30 días</span></div>
  </>
);
render(<Devices height={680} desktop={<Shell user={COORD} current="productos">{body}</Shell>} mobile={<Shell user={OPER} current="productos">{body}</Shell>} dRole="Coordinador" mRole="Operador" />);
