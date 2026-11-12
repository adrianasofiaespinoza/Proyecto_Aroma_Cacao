// @card height=760 width=1760 subtitle="La misma pantalla con dos empresas: solo cambian los tokens de marca y el BrandMark."
import { B, Frame, ALERTS, COORD, PRODUCTS, render } from './_kit.jsx';
const { AppShell, PageHeader, KpiStrip, Panel, DataTable, StockMeter, Button, StatusBadge } = B;
const kpis = [
  { label: 'Productos activos', value: 212, icon: 'box-seam' },
  { label: 'Stock bajo', value: 3, icon: 'exclamation-triangle-fill', tone: 'danger' },
  { label: 'Por autorizar', value: 4, icon: 'hourglass-split', tone: 'pending' },
];
const TENANT_B = {
  '--brand': '#1d4e7a', '--brand-hover': '#163d60', '--on-brand': '#ffffff', '--brand-tint': '#dbe7f2', '--brand-ink': '#173f63',
  '--accent': '#e3b341', '--on-accent': '#1a1406', '--nav-bg': '#14212c', '--nav-active-bg': '#23384a', '--nav-ink': '#eef3f7', '--nav-ink-muted': '#b5c3cf',
};
const screen = brand => (
  <AppShell brand={brand} user={COORD} current="inicio" alerts={ALERTS} pendingCount={4}>
    <PageHeader title="Inicio" actions={<Button variant="primary" icon="plus-lg">Nueva solicitud</Button>} />
    <KpiStrip items={kpis} />
    <Panel title="Alertas de stock bajo" icon="exclamation-triangle-fill" tone="danger" flush>
      <DataTable rows={PRODUCTS.slice(0, 2)} rowTone={() => 'danger'} columns={[
        { key: 'name', header: 'Producto', render: r => <span className="bd-cell-title">{r.name}</span> },
        { key: 's', header: 'Stock', width: 170, render: r => <StockMeter current={r.stock} min={r.min} max={r.max} /> },
        { key: 'b', header: 'Estado', render: () => <StatusBadge status="stock-bajo" /> }]} />
    </Panel>
  </AppShell>
);
render(
  <div className="pv-devices">
    <Frame label="Aroma Cacao S.A." role="tokens por defecto" width={830} height={680}>{screen({ name: 'Aroma Cacao S.A.', shortName: 'Aroma Cacao', product: 'Mantenimiento' })}</Frame>
    <Frame label="Envases del Litoral (ejemplo)" role="11 tokens de marca sobrescritos" width={830} height={680}><div style={{ ...TENANT_B, height: '100%' }}>{screen({ name: 'Envases del Litoral S.A.', shortName: 'Envases Litoral', product: 'Mantenimiento' })}</div></Frame>
  </div>
);
